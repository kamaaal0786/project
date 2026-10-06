"""Credits router — GET /api/credits/{student_id}."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.base import get_db
from app.db.models import StudentProfile, CreditRecord, User, UserRole
from app.auth.dependencies import get_current_user
from app.credits.engine import compute_credits

router = APIRouter(prefix='/api/credits', tags=['credits'])


@router.get('/{student_id}')
def get_credits(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(StudentProfile).filter(StudentProfile.student_id == student_id).first()
    if not profile:
        raise HTTPException(404, 'Student not found')

    # Students can only see their own credits
    if current_user.role == UserRole.student and profile.user_id != current_user.id:
        raise HTTPException(403, 'Access denied')

    from app.db.models import CourseResult
    courses = db.query(CourseResult).filter(CourseResult.student_id == student_id).all()
    if courses:
        passed = [c for c in courses if not c.is_failed and c.grade != 'F']
        failed = [c for c in courses if c.is_failed or c.grade == 'F']
        earned = float(sum(c.credits for c in passed))
        backlog = float(sum(c.credits for c in failed))
        expected = earned + backlog
        required = 160.0
        deficit = max(expected - earned, 0.0)
        completion_pct = round((earned / required) * 100.0, 1) if required > 0 else 0.0
        status = 'ON_TRACK' if deficit == 0 and backlog == 0 else ('DEFICIENT' if deficit <= 8 else 'CRITICAL')
        period = f"SEM{profile.semester or 1}"
        return {
            'student_id':      student_id,
            'period':          period,
            'earned':          round(earned, 1),
            'expected':        round(expected, 1),
            'required':        round(required, 1),
            'completion_pct':  completion_pct,
            'deficit':         round(deficit, 1),
            'credit_gap':      round(deficit, 1),
            'backlog_credits': round(backlog, 1),
            'status':          status,
        }

    record = (
        db.query(CreditRecord)
        .filter(CreditRecord.student_id == student_id)
        .order_by(desc(CreditRecord.calculated_at), desc(CreditRecord.id))
        .first()
    )
    if not record:
        return {
            'student_id': student_id,
            'period': None,
            'earned': 0,
            'expected': 0,
            'required': 160.0,
            'completion_pct': 0,
            'deficit': 0,
            'status': 'NO_DATA',
        }

    cs = compute_credits(record.earned_credits, record.expected_credits, record.required_credits or 160.0)
    return {
        'student_id':      student_id,
        'period':          record.period,
        'earned':          cs['earned'],
        'expected':        cs['expected'],
        'required':        cs['required'],
        'completion_pct':  cs['completion_pct'],
        'deficit':         cs['deficit'],
        'credit_gap':      cs['deficit'],
        'backlog_credits': float(record.backlog_credits or 0),
        'status':          cs['status'],
    }


@router.get('/{student_id}/optimized-path')
@router.get('/{student_id}/optimizer')
def get_optimized_graduation_path(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Calculate the optimal semester-by-semester credit clearance pathway
    and graduation feasibility up to Semester 8.
    """
    profile = db.query(StudentProfile).filter(StudentProfile.student_id == student_id).first()
    if not profile:
        raise HTTPException(404, 'Student not found')

    if current_user.role == UserRole.student and profile.user_id != current_user.id:
        raise HTTPException(403, 'Access denied')

    from app.credits.optimizer import optimize_graduation_path
    try:
        return optimize_graduation_path(student_id, db)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Graduation path optimization failed: {e}")

