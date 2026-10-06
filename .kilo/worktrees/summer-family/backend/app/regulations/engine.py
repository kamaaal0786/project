"""
Regulation Rule Engine (Engine A) - SIES GST Academic Rules.

Simple dict-based config. NOT an enterprise rule-management system.
Rules are stored as a Python dict for easy modification.
The engine evaluates attendance, failed heads, ESE, credits, and progression.

IMPORTANT: This engine determines OFFICIAL academic status.
The ML model (Engine B) provides PREDICTIVE risk only.
Engine A results NEVER get overridden by Engine B.
"""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session


# ── R19 Regulation Config ──────────────────────────────────────────────────
# Single source of truth. Change values here, not scattered in code.
# To support a new regulation, add another key to REGULATIONS dict.

REGULATIONS = {
    "R19": {
        "code": "R19",
        "name": "SIES GST R19 Regulations",
        "version": "SIES-R19-2024",
        "programmes": ["B.Tech CS", "B.Tech ME", "B.Tech ECE", "B.Tech EEE",
                        "B.Tech Civil", "BCA", "MCA", "MBA"],
        "admission_years": {"from": 2019, "to": 2030},
        "rules": {
            "pass_threshold": 40.0,           # percentage to pass a course
            "attendance_threshold": 75.0,      # minimum attendance %
            "attendance_warning": 80.0,        # AT_RISK if below this
            "max_failed_heads": 8,             # max allowed failed heads
            "max_ese_failed_heads": 5,         # max ESE failed heads
            "previous_year_clearance": True,    # must clear previous year
            "credit_on_track_pct": 90.0,       # ON_TRACK threshold
            "credit_deficient_pct": 70.0,      # DEFICIENT threshold
            "credit_critical_pct": 50.0,       # CRITICAL threshold
        },
        "official_source": "SIES GST Academic Regulations",
        "effective_date": "2019-06-01",
    },
}

# Default regulation when student has no regulation set
DEFAULT_REGULATION = "R19"


def get_regulation(code: Optional[str] = None) -> Optional[dict]:
    """Get regulation config by code. Returns None if not found."""
    if not code:
        code = DEFAULT_REGULATION
    return REGULATIONS.get(code)


def get_rules(code: Optional[str] = None) -> Optional[dict]:
    """Get just the rules dict for a regulation."""
    reg = get_regulation(code)
    return reg["rules"] if reg else None


def list_regulations() -> list[dict]:
    """List all available regulations (for API)."""
    return [
        {
            "code": r["code"],
            "name": r["name"],
            "version": r["version"],
            "programmes": r["programmes"],
            "admission_years": r["admission_years"],
            "official_source": r["official_source"],
        }
        for r in REGULATIONS.values()
    ]


# ── Evaluation Functions ───────────────────────────────────────────────────

def evaluate_attendance(attendance_pct: Optional[float], regulation_code: Optional[str] = None) -> dict:
    """
    Evaluate attendance against regulation threshold.
    Returns: {status, percentage, shortage, reason}
    """
    rules = get_rules(regulation_code)
    if not rules:
        return {
            "status": "REGULATION_UNRESOLVED",
            "percentage": attendance_pct,
            "shortage": None,
            "reason": f"Regulation '{regulation_code}' not found in system.",
        }

    if attendance_pct is None:
        return {
            "status": "UNKNOWN",
            "percentage": None,
            "shortage": None,
            "reason": "Attendance data not available.",
        }

    threshold = rules["attendance_threshold"]
    warning = rules["attendance_warning"]

    if attendance_pct >= warning:
        return {
            "status": "COMPLIANT",
            "percentage": round(attendance_pct, 1),
            "shortage": 0.0,
            "reason": None,
        }
    elif attendance_pct >= threshold:
        return {
            "status": "AT_RISK",
            "percentage": round(attendance_pct, 1),
            "shortage": round(warning - attendance_pct, 1),
            "reason": f"Attendance {attendance_pct:.1f}% is below {warning}% warning level.",
        }
    else:
        return {
            "status": "BLOCKED",
            "percentage": round(attendance_pct, 1),
            "shortage": round(threshold - attendance_pct, 1),
            "reason": (
                f"Attendance {attendance_pct:.1f}% is below the required "
                f"{threshold}% under applicable regulation."
            ),
        }


def evaluate_course_pass(total_marks_pct: Optional[float], regulation_code: Optional[str] = None) -> dict:
    """Check if a course result meets pass threshold."""
    rules = get_rules(regulation_code)
    if not rules:
        return {"passed": None, "reason": "Regulation unresolved"}

    if total_marks_pct is None:
        return {"passed": None, "reason": "Marks not available"}

    threshold = rules["pass_threshold"]
    passed = total_marks_pct >= threshold
    return {
        "passed": passed,
        "threshold": threshold,
        "reason": None if passed else f"Marks {total_marks_pct:.1f}% below pass threshold {threshold}%",
    }


def evaluate_failed_heads(
    failed_heads: int = 0,
    ese_failed_heads: int = 0,
    regulation_code: Optional[str] = None,
) -> dict:
    """
    Check failed heads against regulation limits.
    Returns status and whether limits are exceeded.
    """
    rules = get_rules(regulation_code)
    if not rules:
        return {
            "status": "REGULATION_UNRESOLVED",
            "failed_heads": failed_heads,
            "ese_failed_heads": ese_failed_heads,
            "reasons": [f"Regulation '{regulation_code}' not found."],
        }

    max_fh = rules["max_failed_heads"]
    max_ese = rules["max_ese_failed_heads"]
    reasons = []

    if failed_heads > max_fh:
        reasons.append(
            f"Failed heads ({failed_heads}) exceed applicable limit ({max_fh})."
        )
    if ese_failed_heads > max_ese:
        reasons.append(
            f"ESE failed heads ({ese_failed_heads}) exceed applicable limit ({max_ese})."
        )

    return {
        "status": "BLOCKED" if reasons else "CLEAR",
        "failed_heads": failed_heads,
        "allowed_failed_heads": max_fh,
        "ese_failed_heads": ese_failed_heads,
        "allowed_ese_failed_heads": max_ese,
        "reasons": reasons,
    }


def evaluate_progression(
    student_id: int,
    db: Session,
    regulation_code: Optional[str] = None,
) -> dict:
    """
    Full progression evaluation for a student.
    Combines attendance, failed heads, ESE, credits, previous year clearance.
    Saves an audit log in ProgressionEvaluation table.

    Returns the complete progression assessment.
    """
    from app.db.models import (
        StudentProfile, AcademicRecord, CreditRecord, ProgressionEvaluation
    )
    from sqlalchemy import desc

    # Load student
    profile = db.query(StudentProfile).filter(
        StudentProfile.student_id == student_id
    ).first()
    if not profile:
        return {"eligible": None, "status": "STUDENT_NOT_FOUND", "blocking_reasons": []}

    reg_code = regulation_code or profile.regulation or DEFAULT_REGULATION
    rules = get_rules(reg_code)
    reg = get_regulation(reg_code)

    if not rules:
        return {
            "eligible": None,
            "status": "REGULATION_UNRESOLVED",
            "regulation": reg_code,
            "blocking_reasons": [f"Regulation '{reg_code}' not configured in the system."],
        }

    # Latest academic record
    academic = (
        db.query(AcademicRecord)
        .filter(AcademicRecord.student_id == student_id)
        .order_by(desc(AcademicRecord.recorded_at))
        .first()
    )

    # Latest credit record
    credit = (
        db.query(CreditRecord)
        .filter(CreditRecord.student_id == student_id)
        .order_by(desc(CreditRecord.period))
        .first()
    )

    blocking_reasons = []

    # 1. Attendance check
    att_pct = float(academic.attendance) if academic and academic.attendance is not None else None
    att_result = evaluate_attendance(att_pct, reg_code)
    attendance_met = att_result["status"] != "BLOCKED"
    if not attendance_met:
        blocking_reasons.append(att_result["reason"])

    # 2. Failed heads check
    fh = int(academic.failed_heads or 0) if academic else 0
    ese_fh = int(academic.ese_failed_heads or 0) if academic else 0
    fh_result = evaluate_failed_heads(fh, ese_fh, reg_code)
    failed_heads_ok = fh_result["status"] != "BLOCKED"
    if not failed_heads_ok:
        blocking_reasons.extend(fh_result["reasons"])

    # 3. Credit check
    credit_met = True
    credit_completion_pct = None
    if credit:
        earned = float(credit.earned_credits or 0)
        expected = max(float(credit.expected_credits or 1), 1.0)
        credit_completion_pct = round(earned / expected * 100, 1)
        if credit_completion_pct < rules["credit_critical_pct"]:
            credit_met = False
            blocking_reasons.append(
                f"Credit completion ({credit_completion_pct}%) is below "
                f"critical threshold ({rules['credit_critical_pct']}%)."
            )

    # 4. Previous year clearance (simplified — uses previous_backlogs field)
    prev_year_met = True
    if rules.get("previous_year_clearance") and academic:
        prev_backlogs = int(academic.previous_backlogs or 0)
        prev_fh = int(academic.previous_failed_heads or 0)
        if prev_fh > rules["max_failed_heads"]:
            prev_year_met = False
            blocking_reasons.append(
                f"Previous year failed heads ({prev_fh}) exceed limit ({rules['max_failed_heads']})."
            )

    eligible = attendance_met and failed_heads_ok and credit_met and prev_year_met

    # Determine academic status
    if not eligible:
        if not attendance_met:
            status = "ATTENDANCE_BLOCKED"
        else:
            status = "PROGRESSION_BLOCKED"
    elif fh > 0 or (credit_completion_pct and credit_completion_pct < rules["credit_on_track_pct"]):
        status = "ACADEMIC_RISK"
    else:
        status = "CLEAR"

    # Build result
    result = {
        "eligible": eligible,
        "status": status,
        "regulation": reg_code,
        "rule_version": reg.get("version") if reg else None,
        "failed_heads": fh,
        "allowed_failed_heads": rules["max_failed_heads"],
        "ese_failed_heads": ese_fh,
        "allowed_ese_failed_heads": rules["max_ese_failed_heads"],
        "attendance_met": attendance_met,
        "attendance_pct": att_pct,
        "attendance_status": att_result["status"],
        "previous_year_cleared": prev_year_met,
        "credit_requirement_met": credit_met,
        "credit_completion_pct": credit_completion_pct,
        "blocking_reasons": blocking_reasons,
    }

    # Save audit log
    inputs_log = {
        "student_id": student_id,
        "attendance": att_pct,
        "failed_heads": fh,
        "ese_failed_heads": ese_fh,
        "earned_credits": float(credit.earned_credits) if credit else None,
        "expected_credits": float(credit.expected_credits) if credit else None,
        "previous_backlogs": int(academic.previous_backlogs or 0) if academic else None,
    }
    eval_log = ProgressionEvaluation(
        student_id=student_id,
        regulation_code=reg_code,
        rule_version=reg.get("version") if reg else None,
        evaluation_inputs=inputs_log,
        evaluation_outputs=result,
        evaluated_at=datetime.now(timezone.utc),
    )
    db.add(eval_log)

    # Update student's academic_status
    profile.academic_status = status
    db.flush()

    return result
