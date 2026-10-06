"""
velocity.py — Proactive Early-Warning Velocity & Trajectory Engine.

Analyzes the rate-of-change (velocity) across consecutive academic and risk records.
Detects:
1. RAPID_DECLINE: Students plummeting in performance before official semester results.
2. SILENT_AT_RISK: Students who currently appear LOW/MEDIUM risk, but have sharp drops
   in assignment completion or attendance trajectory.
3. Priority Urgency Score (0-100) to rank which students mentors must contact immediately.
"""
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.models import (
    StudentProfile, AcademicRecord, RiskHistory, UserRole, User
)


def compute_student_velocity(student_id: int, db: Session) -> Dict[str, Any]:
    """
    Compute performance trajectory and velocity metrics for a single student.
    """
    profile = db.query(StudentProfile).filter(StudentProfile.student_id == student_id).first()
    if not profile:
        return {}

    # Get last 2 academic records ordered by recorded_at
    acads = (
        db.query(AcademicRecord)
        .filter(AcademicRecord.student_id == student_id)
        .order_by(desc(AcademicRecord.recorded_at), desc(AcademicRecord.id))
        .limit(2)
        .all()
    )

    # Get last 2 risk history records
    risks = (
        db.query(RiskHistory)
        .filter(RiskHistory.student_id == student_id)
        .order_by(desc(RiskHistory.calculated_at), desc(RiskHistory.id))
        .limit(2)
        .all()
    )

    latest_acad = acads[0] if len(acads) > 0 else None
    prev_acad = acads[1] if len(acads) > 1 else None

    latest_risk = risks[0] if len(risks) > 0 else None
    prev_risk = risks[1] if len(risks) > 1 else None

    # Calculate Deltas
    att_now = latest_acad.attendance if latest_acad and latest_acad.attendance is not None else 75.0
    att_prev = prev_acad.attendance if prev_acad and prev_acad.attendance is not None else att_now
    att_delta = round(att_now - att_prev, 1)

    marks_now = latest_acad.marks if latest_acad and latest_acad.marks is not None else 65.0
    marks_prev = prev_acad.marks if prev_acad and prev_acad.marks is not None else marks_now
    marks_delta = round(marks_now - marks_prev, 1)

    gpa_now = latest_acad.gpa if latest_acad and latest_acad.gpa is not None else 6.5
    gpa_prev = prev_acad.gpa if prev_acad and prev_acad.gpa is not None else gpa_now
    gpa_delta = round(gpa_now - gpa_prev, 2)

    risk_prob = latest_risk.probability if latest_risk else 0.35
    prev_risk_prob = prev_risk.probability if prev_risk else risk_prob
    risk_delta = round(risk_prob - prev_risk_prob, 3)

    asgn_now = latest_acad.assignment_completion if latest_acad and latest_acad.assignment_completion is not None else 70.0
    failed_heads = latest_acad.failed_heads if latest_acad and latest_acad.failed_heads is not None else 0

    # Determine Trajectory
    reasons = []
    if risk_delta >= 0.10 or att_delta <= -10.0 or gpa_delta <= -0.8:
        trajectory = "RAPID_DECLINE"
        if att_delta <= -10.0:
            reasons.append(f"Attendance dropped by {abs(att_delta):.1f}%")
        if gpa_delta <= -0.8:
            reasons.append(f"GPA decayed by {abs(gpa_delta):.2f} pts")
        if risk_delta >= 0.10:
            reasons.append(f"Risk spiked +{risk_delta*100:.1f}%")
    elif risk_delta >= 0.04 or att_delta <= -5.0 or gpa_delta <= -0.4:
        trajectory = "MODERATE_DECLINE"
        if att_delta <= -5.0:
            reasons.append(f"Attendance slipping ({att_delta:.1f}%)")
        if marks_delta <= -8.0:
            reasons.append(f"Marks down ({marks_delta:.1f}%)")
    elif risk_delta <= -0.05 or att_delta >= 6.0 or gpa_delta >= 0.5:
        trajectory = "IMPROVING"
        reasons.append(f"Positive momentum (+{att_delta:.1f}% attendance, +{gpa_delta:.2f} GPA)")
    else:
        trajectory = "STABLE"
        reasons.append("Performance stable across recent evaluations")

    # Silent At-Risk Flag:
    # Not yet marked HIGH risk, but has stealth warning signals
    is_silent = False
    current_level = latest_risk.risk_level.value.upper() if latest_risk else "LOW"
    if current_level in ["LOW", "MEDIUM"]:
        if asgn_now < 55.0 and att_now >= 75.0:
            is_silent = True
            reasons.append(f"Silent warning: assignments at {asgn_now}% despite high attendance")
        elif att_delta <= -8.0 and att_now >= 75.0:
            is_silent = True
            reasons.append(f"Silent warning: steep attendance loss ({att_delta}%) before threshold breach")
        elif marks_delta <= -12.0:
            is_silent = True
            reasons.append(f"Silent warning: sharp mark plunge ({marks_delta}%)")

    # Urgency Score (0 - 100)
    urgency = int(risk_prob * 50)
    if trajectory == "RAPID_DECLINE":
        urgency += 25
    elif trajectory == "MODERATE_DECLINE":
        urgency += 12
    if is_silent:
        urgency += 18
    if failed_heads > 0:
        urgency += min(failed_heads * 4, 15)
    urgency = min(max(urgency, 5), 99)

    return {
        "student_id": student_id,
        "roll_no": profile.roll_no,
        "name": profile.user.name if profile.user else "Unknown",
        "program": profile.program,
        "branch": profile.branch or profile.program,
        "semester": profile.semester,
        "current_risk_level": current_level,
        "risk_probability": round(risk_prob, 3),
        "trajectory": trajectory,
        "is_silent_risk": is_silent,
        "urgency_score": urgency,
        "attendance": att_now,
        "attendance_delta": att_delta,
        "gpa": gpa_now,
        "gpa_delta": gpa_delta,
        "marks": marks_now,
        "marks_delta": marks_delta,
        "assignment_completion": asgn_now,
        "failed_heads": failed_heads,
        "primary_alert": reasons[0] if reasons else "Normal academic progress",
        "alert_reasons": reasons,
    }


def get_all_velocity_alerts(current_user: User, db: Session) -> List[Dict[str, Any]]:
    """
    Get ranked early-warning velocity alerts for permitted students.
    """
    from app.db.models import StudentFaculty

    query = db.query(StudentProfile)

    # RBAC filtering
    if current_user.role == UserRole.student:
        query = query.filter(StudentProfile.user_id == current_user.id)
    elif current_user.role == UserRole.mentor:
        query = query.filter(StudentProfile.mentor_id == current_user.id)
    elif current_user.role == UserRole.faculty:
        assigned_ids = [
            sf.student_id for sf in db.query(StudentFaculty).filter(StudentFaculty.faculty_id == current_user.id).all()
        ]
        query = query.filter(StudentProfile.student_id.in_(assigned_ids))

    students = query.all()
    results = []
    for s in students:
        vel = compute_student_velocity(s.student_id, db)
        if vel:
            results.append(vel)

    # Sort descending by urgency_score
    results.sort(key=lambda x: x["urgency_score"], reverse=True)
    return results
