"""
Regulation router - API endpoints for regulation config and progression evaluation.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models import User, StudentProfile, UserRole
from app.auth.dependencies import get_current_user
from app.regulations.engine import (
    list_regulations, get_regulation, evaluate_progression,
    evaluate_attendance, evaluate_failed_heads,
)

router = APIRouter(prefix='/api/regulations', tags=['regulations'])


@router.get('')
def get_regulations():
    """List all available regulation configurations."""
    return list_regulations()


@router.get('/{code}/rules')
def get_regulation_rules(code: str):
    """Get the full regulation config for a specific code."""
    reg = get_regulation(code)
    if not reg:
        raise HTTPException(404, f"Regulation '{code}' not found")
    return reg


# ── Progression evaluation endpoints (mounted on /api/students) ────────────

progression_router = APIRouter(prefix='/api/students', tags=['progression'])


@progression_router.get('/{student_id}/progression')
def get_student_progression(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Evaluate and return the official progression status for a student.
    This uses Engine A (regulation rules), NOT Engine B (ML).
    """
    profile = db.query(StudentProfile).filter(
        StudentProfile.student_id == student_id
    ).first()
    if not profile:
        raise HTTPException(404, "Student not found")

    # Access control: students can only see their own
    if current_user.role == UserRole.student:
        if profile.user_id != current_user.id:
            raise HTTPException(403, "Access denied")

    result = evaluate_progression(student_id, db, profile.regulation)
    db.commit()
    return result


@progression_router.post('/{student_id}/evaluate')
def evaluate_student_full(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Full evaluation: runs both Engine A (regulation) and Engine B (ML).
    Returns combined result with clear separation.

    This does NOT allow ML to override official progression status.
    """
    from app.risk.router import predict_risk
    from sqlalchemy import desc
    from app.db.models import AcademicRecord, CreditRecord, RiskHistory

    profile = db.query(StudentProfile).filter(
        StudentProfile.student_id == student_id
    ).first()
    if not profile:
        raise HTTPException(404, "Student not found")

    # Access control
    if current_user.role == UserRole.student:
        if profile.user_id != current_user.id:
            raise HTTPException(403, "Access denied")

    # Engine A: Official progression
    progression = evaluate_progression(student_id, db, profile.regulation)

    # Engine B: ML prediction (call the existing predict endpoint logic)
    ml_result = predict_risk(student_id, db, current_user)

    # Latest credit info
    credit = (
        db.query(CreditRecord)
        .filter(CreditRecord.student_id == student_id)
        .order_by(desc(CreditRecord.period))
        .first()
    )

    credit_info = None
    if credit:
        earned = float(credit.earned_credits or 0)
        expected = max(float(credit.expected_credits or 1), 1.0)
        credit_info = {
            "earned": earned,
            "expected": expected,
            "required": float(credit.required_credits or 0),
            "completion_pct": round(earned / expected * 100, 1),
            "gap": round(expected - earned, 1),
            "backlog_credits": float(credit.backlog_credits or 0),
            "status": (
                "ON_TRACK" if earned / expected >= 0.9
                else "DEFICIENT" if earned / expected >= 0.7
                else "CRITICAL"
            ),
        }

    db.commit()

    return {
        "student_id": student_id,
        "official_status": progression,
        "ml_prediction": ml_result,
        "credit_status": credit_info,
        "disclaimer": (
            "AI risk prediction and official progression status are evaluated "
            "independently. ML predictions do not determine official eligibility."
        ),
    }
