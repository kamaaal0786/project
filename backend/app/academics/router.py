"""
Academics router — PATCH /api/students/{id}/academic (manual update).
"""
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.base import get_db
from app.db.models import (
    User, StudentProfile, AcademicRecord, CreditRecord,
    RiskHistory, RiskLevel, Intervention, InterventionStatus, UserRole
)
from app.auth.dependencies import get_current_user, require_role
from app.credits.engine import compute_credits
from app.risk.inference import ModelService
from app.interventions.engine import evaluate_rules

router = APIRouter(prefix='/api/students', tags=['academics'])


class AcademicUpdateRequest(BaseModel):
    # Core fields
    attendance:            float
    marks:                 float
    gpa:                   float
    assignment_completion: float
    failed_subjects:       int
    earned_credits:        float
    expected_credits:      float
    required_credits:      float
    term:                  Optional[str] = None
    # SIES GST extended fields
    ise_marks:             Optional[float] = None
    mse_marks:             Optional[float] = None
    ese_marks:             Optional[float] = None
    tw_marks:              Optional[float] = None
    pr_or_marks:           Optional[float] = None
    grace_marks:           Optional[float] = 0.0
    ordinance_applied:     Optional[str]   = None
    failed_heads:          Optional[int]   = 0
    ese_failed_heads:      Optional[int]   = 0
    backlog_credits:       Optional[float] = 0.0
    previous_backlogs:     Optional[int]   = 0
    previous_failed_heads: Optional[int]   = 0


@router.patch('/{student_id}/academic')
def update_academic(
    student_id: int,
    body: AcademicUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role('admin', 'faculty')),
):
    """Manual academic update → persist → recompute credits → run inference → append risk history."""
    profile = db.query(StudentProfile).filter(StudentProfile.student_id == student_id).first()
    if not profile:
        raise HTTPException(404, 'Student not found')

    # Faculty can only update their assigned students
    if current_user.role == UserRole.faculty:
        from app.db.models import StudentFaculty
        assignment = db.query(StudentFaculty).filter(
            StudentFaculty.student_id == student_id,
            StudentFaculty.faculty_id == current_user.id,
        ).first()
        if not assignment:
            raise HTTPException(403, 'Not your assigned student')

    now  = datetime.now(timezone.utc)
    term = body.term or f"SEM{profile.semester or 1}"

    # Statutory limits clamping
    ise_val = min(20.0, max(0.0, float(body.ise_marks))) if body.ise_marks is not None else None
    mse_val = min(20.0, max(0.0, float(body.mse_marks))) if body.mse_marks is not None else None
    ese_val = min(60.0, max(0.0, float(body.ese_marks))) if body.ese_marks is not None else None
    tw_val = min(25.0, max(0.0, float(body.tw_marks))) if body.tw_marks is not None else None
    pr_or_val = min(25.0, max(0.0, float(body.pr_or_marks))) if body.pr_or_marks is not None else None

    # Persist academic record with SIES GST autonomous components
    academic = AcademicRecord(
        student_id=student_id,
        term=term,
        attendance=min(100.0, max(0.0, body.attendance)),
        marks=min(100.0, max(0.0, body.marks)),
        gpa=min(10.0, max(0.0, body.gpa)),
        assignment_completion=min(100.0, max(0.0, body.assignment_completion)),
        failed_subjects=max(0, body.failed_subjects),
        ise_marks=ise_val,
        mse_marks=mse_val,
        ese_marks=ese_val,
        tw_marks=tw_val,
        pr_or_marks=pr_or_val,
        grace_marks=body.grace_marks or 0.0,
        ordinance_applied=body.ordinance_applied,
        failed_heads=body.failed_heads or 0,
        ese_failed_heads=body.ese_failed_heads or 0,
        backlog_credits=body.backlog_credits or 0.0,
        previous_backlogs=body.previous_backlogs or 0,
        previous_failed_heads=body.previous_failed_heads or 0,
        recorded_at=now,
    )
    db.add(academic)
    db.flush()

    # Credit record
    cs = compute_credits(body.earned_credits, body.expected_credits, body.required_credits)
    credit = CreditRecord(
        student_id=student_id,
        period=term,
        earned_credits=cs['earned'],
        expected_credits=cs['expected'],
        required_credits=cs['required'],
        deficit=cs['deficit'],
        backlog_credits=body.backlog_credits or 0.0,
        credit_gap=cs['deficit'],
        credit_completion_pct=cs['completion_pct'],
    )
    db.add(credit)
    db.flush()

    # Run regulation engine (Engine A) and update academic_status
    from app.regulations.engine import evaluate_progression
    try:
        prog_result = evaluate_progression(student_id, db, profile.regulation)
        profile.academic_status = prog_result.get('status', 'CLEAR')
        db.flush()
    except Exception:
        pass  # Non-fatal: regulation eval failure should not block record save

    # Inference with complete SIES GST autonomous features
    features = {
        'attendance':                       body.attendance,
        'attendance_percentage':            body.attendance,
        'marks':                            body.marks,
        'gpa':                              body.gpa,
        'assignment_completion':            body.assignment_completion,
        'assignment_completion_percentage': body.assignment_completion,
        'failed_subjects':                  body.failed_subjects,
        'failed_heads':                     body.failed_heads or 0,
        'ese_failed_heads':                 body.ese_failed_heads or 0,
        'backlog_credits':                  body.backlog_credits or 0.0,
        'previous_backlogs':                body.previous_backlogs or 0,
        'previous_failed_heads':            body.previous_failed_heads or 0,
        'earned_credits':                   cs['earned'],
        'expected_credits':                 cs['expected'],
    }
    svc    = ModelService.get()
    result = svc.predict(features)
    level_map = {
        'LOW':      RiskLevel.low,
        'MEDIUM':   RiskLevel.medium,
        'HIGH':     RiskLevel.high,
        'CRITICAL': RiskLevel.critical,
    }

    snapshot = RiskHistory(
        student_id=student_id,
        probability=result['risk_probability'],
        risk_level=level_map.get(result['risk_level'], RiskLevel.low),
        model_version=result['model_version'],
        risk_type='ML',
        calculated_at=now,
    )
    db.add(snapshot)
    db.flush()

    # Auto-interventions
    triggered = evaluate_rules(academic, credit, snapshot)
    for rule in triggered:
        existing = db.query(Intervention).filter(
            Intervention.student_id == student_id,
            Intervention.type == rule['type'],
            Intervention.status.in_([InterventionStatus.pending, InterventionStatus.in_progress]),
        ).first()
        if not existing:
            db.add(Intervention(
                student_id=student_id,
                type=rule['type'],
                reason=rule['reason'],
                priority=rule['priority'],
                status=InterventionStatus.pending,
                assigned_to=profile.mentor_id,
                created_at=now,
            ))

    db.commit()

    return {
        'student_id':              student_id,
        'risk_probability':        result['risk_probability'],
        'risk_level':              result['risk_level'],
        'credit_status':           cs['status'],
        'completion_pct':          cs['completion_pct'],
        'interventions_triggered': len(triggered),
        'academic_status':         profile.academic_status,
        'updated_at':              now.isoformat(),
    }
