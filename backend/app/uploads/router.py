"""
Upload router - POST /api/academic/upload (CSV or XLSX).
Pipeline: validate schema -> row validation -> persist -> Engine A -> Engine B -> interventions.
"""
import io
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.base import get_db
from app.db.models import (
    User, StudentProfile, AcademicRecord, CreditRecord, RiskHistory, RiskLevel, CourseResult
)
from app.auth.dependencies import get_current_user, require_role
from app.credits.engine import compute_credits
from app.risk.inference import ModelService
from app.interventions.engine import evaluate_rules
from app.regulations.engine import evaluate_progression, get_regulation
from app.db.models import Intervention, InterventionStatus, UserRole

router = APIRouter(prefix='/api/academic', tags=['uploads'])

REQUIRED_COLS = {
    'roll_no', 'branch', 'admission_year', 'current_year', 'semester', 'regulation',
    'attendance_percentage', 'gpa', 'ise_marks', 'mse_marks', 'ese_marks',
    'assignment_completion_percentage', 'earned_credits', 'expected_credits'
}

OPTIONAL_COLS = {
    'course_code', 'course_name', 'credits', 'failed_subjects', 'failed_heads',
    'ese_failed_heads', 'previous_backlogs', 'tw_marks', 'pr_or_marks', 'is_dse',
    'activity_points'
}

def _parse_file(file: UploadFile) -> Any:
    """Return a pandas DataFrame from CSV or XLSX."""
    import pandas as pd
    content = file.file.read()
    if file.filename and file.filename.endswith('.xlsx'):
        return pd.read_excel(io.BytesIO(content))
    else:
        try:
            return pd.read_csv(io.BytesIO(content))
        except Exception:
            return pd.read_csv(io.BytesIO(content), sep=';')

def _validate_row(row: dict) -> list[str]:
    """Return list of errors for a single row, or empty list if valid."""
    errors = []
    
    # Numeric bounds checks
    try:
        sem = int(row.get('semester', -1))
        if sem <= 0:
            errors.append('semester must be > 0')
    except (TypeError, ValueError):
        errors.append('semester is missing or not an integer')
        
    try:
        cur_year = int(row.get('current_year', -1))
        if cur_year <= 0:
            errors.append('current_year must be > 0')
    except (TypeError, ValueError):
        errors.append('current_year is missing or not an integer')

    try:
        att = float(row.get('attendance_percentage', -1))
        if not (0 <= att <= 100):
            errors.append('attendance_percentage must be 0-100')
    except (TypeError, ValueError):
        errors.append('attendance_percentage is missing or not numeric')

    limits = {
        'ise_marks': 20.0,
        'mse_marks': 20.0,
        'ese_marks': 60.0,
        'tw_marks': 25.0,
        'pr_or_marks': 25.0,
    }
    for mark_col, max_val in limits.items():
        if mark_col in row and row.get(mark_col) not in ('', None, 'nan'):
            try:
                val = float(row.get(mark_col, 0))
                if not (0 <= val <= max_val):
                    errors.append(f'{mark_col} must be between 0 and {max_val}')
            except (TypeError, ValueError):
                errors.append(f'{mark_col} is missing or not numeric')
            
    for cred_col in ['earned_credits', 'expected_credits']:
        try:
            val = float(row.get(cred_col, -1))
            if val < 0:
                errors.append(f'{cred_col} must be >= 0')
        except (TypeError, ValueError):
            errors.append(f'{cred_col} is missing or not numeric')

    return errors


@router.post('/upload')
def upload_academic(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role('admin', 'faculty')),
):
    """
    Accept CSV or XLSX, validate structure and rows, persist valid rows,
    run Engine A (regulation) + Engine B (inference) for each affected student,
    return import summary.
    """
    if not file.filename:
        raise HTTPException(400, 'No file uploaded')
    if not (file.filename.endswith('.csv') or file.filename.endswith('.xlsx')):
        raise HTTPException(400, 'Only .csv and .xlsx files are accepted')

    try:
        df = _parse_file(file)
    except Exception as exc:
        raise HTTPException(400, f'Could not parse file: {exc}')

    # Validate columns
    missing_cols = REQUIRED_COLS - set(df.columns)
    if missing_cols:
        raise HTTPException(
            400,
            f'File is missing required columns: {sorted(missing_cols)}. '
            f'Required: {sorted(REQUIRED_COLS)}'
        )

    rows_imported = 0
    rows_failed   = 0
    row_errors    = []
    svc           = ModelService.get()
    now           = datetime.now(timezone.utc)

    for idx, row in df.iterrows():
        row_dict = row.to_dict()
        row_num  = idx + 2   # 1-indexed, header is row 1

        # Find student by roll_no
        roll_no = str(row_dict.get('roll_no', '')).strip()
        if not roll_no:
            row_errors.append({'row': row_num, 'errors': ['roll_no is required']})
            rows_failed += 1
            continue

        profile = db.query(StudentProfile).filter(StudentProfile.roll_no == roll_no).first()
        if not profile:
            row_errors.append({'row': row_num, 'roll_no': roll_no, 'errors': [f'No student with roll_no={roll_no}']})
            rows_failed += 1
            continue

        # Faculty can only update their own students
        if current_user.role == UserRole.faculty:
            from app.db.models import StudentFaculty
            assignment = db.query(StudentFaculty).filter(
                StudentFaculty.student_id == profile.student_id,
                StudentFaculty.faculty_id == current_user.id,
            ).first()
            if not assignment:
                row_errors.append({'row': row_num, 'roll_no': roll_no, 'errors': ['Not your assigned student']})
                rows_failed += 1
                continue

        # Validate row values
        errors = _validate_row(row_dict)
        if errors:
            row_errors.append({'row': row_num, 'roll_no': roll_no, 'errors': errors})
            rows_failed += 1
            continue

        # Profile Update
        profile.branch = str(row_dict.get('branch', profile.branch))
        
        try:
            profile.admission_year = int(row_dict.get('admission_year'))
        except:
            pass
            
        try:
            profile.current_year = int(row_dict.get('current_year'))
        except:
            pass

        try:
            profile.semester = int(row_dict.get('semester'))
        except:
            pass
            
        regulation = str(row_dict.get('regulation', '')).strip()
        if regulation:
            profile.regulation = regulation
            if not get_regulation(regulation):
                row_errors.append({'row': row_num, 'roll_no': roll_no, 'warning': f'Regulation {regulation} is unresolved.'})

        term = f"{profile.current_year}-S{profile.semester}"

        # Persist academic record
        academic = AcademicRecord(
            student_id=profile.student_id,
            term=term,
            attendance=float(row_dict['attendance_percentage']),
            marks=float(row_dict['gpa']) * 10, # rough approximation if marks not provided
            gpa=float(row_dict['gpa']),
            assignment_completion=min(100.0, max(0.0, float(row_dict['assignment_completion_percentage']))),
            ise_marks=min(20.0, max(0.0, float(row_dict['ise_marks']))),
            mse_marks=min(20.0, max(0.0, float(row_dict['mse_marks']))),
            ese_marks=min(60.0, max(0.0, float(row_dict['ese_marks']))),
            tw_marks=min(25.0, max(0.0, float(row_dict['tw_marks']))) if 'tw_marks' in row_dict and row_dict['tw_marks'] != '' and str(row_dict['tw_marks']) != 'nan' else None,
            pr_or_marks=min(25.0, max(0.0, float(row_dict['pr_or_marks']))) if 'pr_or_marks' in row_dict and row_dict['pr_or_marks'] != '' and str(row_dict['pr_or_marks']) != 'nan' else None,
            failed_subjects=int(float(row_dict.get('failed_subjects', 0))),
            failed_heads=int(float(row_dict.get('failed_heads', 0))),
            ese_failed_heads=int(float(row_dict.get('ese_failed_heads', 0))),
            previous_backlogs=int(float(row_dict.get('previous_backlogs', 0))),
            recorded_at=now,
        )
        db.add(academic)
        db.flush()
        
        # Course results (optional, upsert to prevent duplicates)
        course_code = str(row_dict.get('course_code', '')).strip()
        if course_code and course_code != 'nan':
            cr = db.query(CourseResult).filter(
                CourseResult.student_id == profile.student_id,
                CourseResult.course_code == course_code,
                CourseResult.semester == profile.semester
            ).first()
            if not cr:
                cr = CourseResult(
                    student_id=profile.student_id,
                    semester=profile.semester,
                    course_code=course_code,
                    course_name=str(row_dict.get('course_name', '')),
                )
                db.add(cr)
            cr.credits = int(float(row_dict.get('credits', 3)))
            cr.ise_marks = min(20.0, max(0.0, float(row_dict.get('ise_marks', 0))))
            cr.mse_marks = min(20.0, max(0.0, float(row_dict.get('mse_marks', 0))))
            cr.ese_marks = min(60.0, max(0.0, float(row_dict.get('ese_marks', 0))))
            cr.tw_marks = min(25.0, max(0.0, float(row_dict['tw_marks']))) if 'tw_marks' in row_dict and row_dict['tw_marks'] != '' and str(row_dict['tw_marks']) != 'nan' else None
            cr.pr_or_marks = min(25.0, max(0.0, float(row_dict['pr_or_marks']))) if 'pr_or_marks' in row_dict and row_dict['pr_or_marks'] != '' and str(row_dict['pr_or_marks']) != 'nan' else None
            cr.attendance_percentage = float(row_dict.get('attendance_percentage', 100))
            cr.recorded_at = now
            db.flush()

        # Persist credit record
        earned   = float(row_dict['earned_credits'])
        expected = float(row_dict['expected_credits'])
        # If required_credits is not in row, we can default to expected
        required = float(row_dict.get('required_credits', expected)) 
        
        cs = compute_credits(earned, expected, required, regulation_code=profile.regulation)

        credit = CreditRecord(
            student_id=profile.student_id,
            period=term,
            earned_credits=cs['earned'],
            expected_credits=cs['expected'],
            required_credits=cs['required'],
            deficit=cs['deficit'],
            credit_completion_pct=cs['completion_pct'],
            credit_gap=cs['credit_gap'],
            backlog_credits=cs['backlog_credits'],
        )
        db.add(credit)
        db.flush()

        # Engine A: Official Progression
        # Note: evaluate_progression saves audit log and updates profile.academic_status
        prog_result = evaluate_progression(profile.student_id, db, profile.regulation)

        # Engine B: ML Inference
        features = {
            'attendance':           academic.attendance,
            'attendance_percentage': academic.attendance,
            'marks':                academic.marks,
            'gpa':                  academic.gpa,
            'assignment_completion': academic.assignment_completion,
            'assignment_completion_percentage': academic.assignment_completion,
            'failed_subjects':      academic.failed_subjects,
            'failed_heads':         academic.failed_heads,
            'ese_failed_heads':     academic.ese_failed_heads,
            'previous_backlogs':    academic.previous_backlogs,
            'earned_credits':       credit.earned_credits,
            'expected_credits':     credit.expected_credits,
            'backlog_credits':      credit.backlog_credits,
        }
        
        result = svc.predict(features)
        
        level_map = {
            'LOW': RiskLevel.low, 
            'MEDIUM': RiskLevel.medium, 
            'HIGH': RiskLevel.high,
            'CRITICAL': RiskLevel.critical
        }

        snapshot = RiskHistory(
            student_id=profile.student_id,
            probability=result['risk_probability'],
            risk_level=level_map[result['risk_level']],
            model_version=result['model_version'],
            calculated_at=now,
            risk_type='ML'
        )
        db.add(snapshot)
        db.flush()

        # Auto-generate interventions from rules (skip if already pending/in-progress)
        triggered = evaluate_rules(academic, credit, snapshot)
        for rule in triggered:
            existing = db.query(Intervention).filter(
                Intervention.student_id == profile.student_id,
                Intervention.type == rule['type'],
                Intervention.status.in_([InterventionStatus.pending, InterventionStatus.in_progress]),
            ).first()
            if not existing:
                db.add(Intervention(
                    student_id=profile.student_id,
                    type=rule['type'],
                    reason=rule['reason'],
                    priority=rule['priority'],
                    status=InterventionStatus.pending,
                    assigned_to=profile.mentor_id,
                    created_at=now,
                ))

        rows_imported += 1

    db.commit()

    return {
        'rows_imported': rows_imported,
        'rows_failed':   rows_failed,
        'errors':        row_errors,
        'message':       f'Import complete. {rows_imported} rows imported, {rows_failed} failed.',
    }
