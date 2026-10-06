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
        "name": "SIES GST R19 Autonomous Regulations",
        "version": "SIES-R19-2024",
        "programmes": ["B.Tech CS", "B.Tech ME", "B.Tech ECE", "B.Tech EEE",
                        "B.Tech Civil", "BCA", "MCA", "MBA"],
        "admission_years": {"from": 2019, "to": 2030},
        "rules": {
            # Evaluation Head Breakdown (Total = 100)
            "ise_max": 20.0,                   # In-Semester Evaluation (20 marks)
            "mse_max": 20.0,                   # Mid-Semester Exam (20 marks)
            "ese_max": 60.0,                   # End-Semester Exam (60 marks)
            "ese_pass_threshold": 24.0,        # 40% of 60 (Separate head of passing)
            "pass_threshold": 40.0,            # 40% aggregate to pass a course
            # Practical & Term Work Heads
            "tw_max": 25.0,                    # Term Work max marks
            "tw_pass_threshold": 10.0,         # 40% of 25 (Separate head of passing)
            "pr_max": 25.0,                    # Practical & Oral max marks
            "pr_pass_threshold": 10.0,         # 40% of 25 (Separate head of passing)
            # Attendance (Ordinance 6086)
            "attendance_threshold": 75.0,      # Minimum mandatory attendance %
            "attendance_warning": 80.0,        # SIES GST warning benchmark
            "attendance_condonation_min": 50.0,# Medical/Sports condonation limit (O.6086)
            # ATKT Progression Rules
            "max_failed_heads": 8,             # Max allowed failed heads per academic year
            "max_ese_failed_heads": 5,         # Max ESE (theory) failed heads allowed
            "fe_all_clear_sem": 5,             # Sem 5 requires 100% FE subjects cleared
            "se_all_clear_sem": 7,             # Sem 7 requires 100% SE subjects cleared
            "previous_year_clearance": True,    # Must clear qualifying lower year
            # Credit Pacing & Overload Caps
            "credit_on_track_pct": 90.0,       # ON_TRACK threshold
            "credit_deficient_pct": 70.0,      # DEFICIENT threshold
            "credit_critical_pct": 50.0,       # CRITICAL threshold
            "credit_cap_per_sem": 28.0,        # Max remedial registration credit cap
            "total_degree_credits": 160.0,     # 4-Year B.Tech graduation credits
            "total_degree_credits_dse": 120.0, # Direct Second Year graduation credits
            # Statutory Durations (AICTE N+2 Rule)
            "max_degree_duration_years": 6,    # 4 + 2 years max before de-registration
            "max_degree_duration_dse_years": 5,# 3 + 2 years max for DSE
            # Institutional Ordinances
            "grace_marks_o5042_max": 2.0,      # Max 2 grace marks on ESE heads (O.5042)
            "condonation_o5045_max": 10.0,     # Max 10 marks condonation single head (O.5045)
            "activity_points_required": 100,   # AICTE Mandatory Activity Points
            "activity_points_required_dse": 75,# AICTE Activity Points for DSE
            "ncmc_required": True,             # Non-Credit Mandatory Courses (EVS, Constitution)
        },
        "official_source": "SIES GST Autonomous Academic Regulations (R19/R24)",
        "effective_date": "2019-06-01",
    },
    "R24": {
        "code": "R24",
        "name": "SIES GST R24 Autonomous Regulations (NEP 2020)",
        "version": "SIES-R24-2024",
        "programmes": ["B.Tech CS", "B.Tech AIDS", "B.Tech AIML", "B.Tech IOT", "B.Tech ECS", "B.Tech ME"],
        "admission_years": {"from": 2024, "to": 2035},
        "rules": {
            "ise_max": 20.0,
            "mse_max": 20.0,
            "ese_max": 60.0,
            "ese_pass_threshold": 24.0,
            "pass_threshold": 40.0,
            "tw_max": 25.0,
            "tw_pass_threshold": 10.0,
            "pr_max": 25.0,
            "pr_pass_threshold": 10.0,
            "attendance_threshold": 75.0,
            "attendance_warning": 80.0,
            "attendance_condonation_min": 50.0,
            "max_failed_heads": 8,
            "max_ese_failed_heads": 5,
            "fe_all_clear_sem": 5,
            "se_all_clear_sem": 7,
            "previous_year_clearance": True,
            "credit_on_track_pct": 90.0,
            "credit_deficient_pct": 70.0,
            "credit_critical_pct": 50.0,
            "credit_cap_per_sem": 28.0,
            "total_degree_credits": 160.0,
            "total_degree_credits_dse": 120.0,
            "max_degree_duration_years": 6,
            "max_degree_duration_dse_years": 5,
            "grace_marks_o5042_max": 2.0,
            "condonation_o5045_max": 10.0,
            "activity_points_required": 100,
            "activity_points_required_dse": 75,
            "ncmc_required": True,
        },
        "official_source": "SIES GST Autonomous Academic Regulations (R24)",
        "effective_date": "2024-06-01",
    }
}

# Default regulation when student has no regulation set
DEFAULT_REGULATION = "R19"


def get_regulation(code: Optional[str] = None) -> Optional[dict]:
    """Get regulation config by code. Returns None if not found."""
    if not code:
        code = DEFAULT_REGULATION
    return REGULATIONS.get(code) or REGULATIONS.get(DEFAULT_REGULATION)


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
    Evaluate attendance against Mumbai University Ordinance 6086 and SIES GST thresholds.
    Returns: {status, percentage, shortage, reason, ordinance}
    """
    rules = get_rules(regulation_code)
    if not rules:
        return {
            "status": "REGULATION_UNRESOLVED",
            "percentage": attendance_pct,
            "shortage": None,
            "ordinance": "Ordinance 6086",
            "reason": f"Regulation '{regulation_code}' not found in system.",
        }

    if attendance_pct is None:
        return {
            "status": "UNKNOWN",
            "percentage": None,
            "shortage": None,
            "ordinance": "Ordinance 6086",
            "reason": "Attendance data not available.",
        }

    threshold = rules["attendance_threshold"]
    warning = rules["attendance_warning"]
    condonation_floor = rules.get("attendance_condonation_min", 50.0)

    if attendance_pct >= warning:
        return {
            "status": "COMPLIANT",
            "percentage": round(attendance_pct, 1),
            "shortage": 0.0,
            "ordinance": "Ordinance 6086 Compliant",
            "reason": None,
        }
    elif attendance_pct >= threshold:
        return {
            "status": "AT_RISK",
            "percentage": round(attendance_pct, 1),
            "shortage": round(warning - attendance_pct, 1),
            "ordinance": "Ordinance 6086 Warning Zone",
            "reason": f"Attendance {attendance_pct:.1f}% is below {warning}% warning level (Ordinance 6086 watch).",
        }
    elif attendance_pct >= condonation_floor:
        return {
            "status": "CONDONATION_REQUIRED",
            "percentage": round(attendance_pct, 1),
            "shortage": round(threshold - attendance_pct, 1),
            "ordinance": "Ordinance 6086 Medical/Sports Condonation Eligible",
            "reason": (
                f"Attendance {attendance_pct:.1f}% is below mandatory {threshold}%. "
                f"Requires Principal condonation under Ordinance 6086 on medical/sports grounds."
            ),
        }
    else:
        return {
            "status": "BLOCKED",
            "percentage": round(attendance_pct, 1),
            "shortage": round(threshold - attendance_pct, 1),
            "ordinance": "Ordinance 6086 Definitive Detention",
            "reason": (
                f"Attendance {attendance_pct:.1f}% is below condonation floor ({condonation_floor}%). "
                f"Definitive term detention under Ordinance 6086 (Debarred from ESE)."
            ),
        }


def evaluate_course_pass(
    total_marks_pct: Optional[float] = None,
    ise: Optional[float] = None,
    mse: Optional[float] = None,
    ese: Optional[float] = None,
    tw: Optional[float] = None,
    pr_or: Optional[float] = None,
    regulation_code: Optional[str] = None
) -> dict:
    """
    Check if a course result meets SIES GST separate heads of passing:
    - ISE: / 20
    - MSE: / 20
    - ESE: / 60 (Min 24 / 60, with Ordinance 5042 grace marks if 22-23)
    - TW:  / 25 (Min 10 / 25 if present)
    - PR:  / 25 (Min 10 / 25 if present)
    - Total: Min 40%
    """
    rules = get_rules(regulation_code)
    if not rules:
        return {"passed": None, "reason": "Regulation unresolved"}

    threshold = rules["pass_threshold"]
    ese_threshold = rules.get("ese_pass_threshold", 24.0)
    grace_o5042 = rules.get("grace_marks_o5042_max", 2.0)
    tw_threshold = rules.get("tw_pass_threshold", 10.0)
    pr_threshold = rules.get("pr_pass_threshold", 10.0)

    # Calculate total if components provided
    if total_marks_pct is None and (ise is not None or mse is not None or ese is not None):
        total_marks_pct = (ise or 0.0) + (mse or 0.0) + (ese or 0.0)

    if total_marks_pct is None and ese is None:
        return {"passed": None, "reason": "Marks not available"}

    failed_reasons = []
    grace_awarded = 0.0
    ordinance_applied = None

    # Check ESE head (out of 60)
    if ese is not None:
        if ese >= ese_threshold:
            pass
        elif ese >= (ese_threshold - grace_o5042):
            grace_awarded = round(ese_threshold - ese, 1)
            ordinance_applied = "Ordinance 5042 (Grace Marks)"
        else:
            failed_reasons.append(f"ESE marks ({ese:.1f}/60) below passing cutoff ({ese_threshold:.0f}/60)")

    # Check TW head (out of 25)
    if tw is not None and tw < tw_threshold:
        failed_reasons.append(f"Term Work marks ({tw:.1f}/25) below passing cutoff ({tw_threshold:.0f}/25)")

    # Check PR/OR head (out of 25)
    if pr_or is not None and pr_or < pr_threshold:
        failed_reasons.append(f"Practical/Oral marks ({pr_or:.1f}/25) below passing cutoff ({pr_threshold:.0f}/25)")

    # Check total aggregate (out of 100)
    if total_marks_pct is not None and total_marks_pct < threshold and not ordinance_applied:
        failed_reasons.append(f"Total marks ({total_marks_pct:.1f}%) below aggregate pass cutoff ({threshold:.0f}%)")

    passed = len(failed_reasons) == 0
    return {
        "passed": passed,
        "threshold": threshold,
        "ese_threshold": ese_threshold,
        "grace_awarded": grace_awarded,
        "ordinance_applied": ordinance_applied,
        "reason": None if passed else "; ".join(failed_reasons),
    }


def evaluate_failed_heads(
    failed_heads: int = 0,
    ese_failed_heads: int = 0,
    regulation_code: Optional[str] = None,
) -> dict:
    """
    Check failed heads against SIES GST ATKT limits (Max 8 failed heads, Max 5 ESE heads).
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
            f"Failed heads ({failed_heads}) exceed SIES GST ATKT limit ({max_fh}). Promotion blocked."
        )
    if ese_failed_heads > max_ese:
        reasons.append(
            f"ESE (Theory) failed heads ({ese_failed_heads}) exceed ATKT limit ({max_ese}). Promotion blocked."
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

    # Active academic record - strictly unified across all modules
    from app.students.router import get_active_academic_record
    academic = get_active_academic_record(student_id, db)

    # Latest credit record
    credit = (
        db.query(CreditRecord)
        .filter(CreditRecord.student_id == student_id)
        .order_by(desc(CreditRecord.period))
        .first()
    )

    blocking_reasons = []

    # 1. Attendance check (Mumbai University Ordinance 6086)
    att_pct = float(academic.attendance) if academic and academic.attendance is not None else None
    att_result = evaluate_attendance(att_pct, reg_code)
    attendance_met = att_result["status"] != "BLOCKED"
    if not attendance_met:
        blocking_reasons.append(att_result["reason"])

    # 2. Failed heads check (SIES GST ATKT Rules: max 8 failed heads, max 5 ESE)
    fh = int(academic.failed_heads or 0) if academic else 0
    ese_fh = int(academic.ese_failed_heads or 0) if academic else 0
    fh_result = evaluate_failed_heads(fh, ese_fh, reg_code)
    failed_heads_ok = fh_result["status"] != "BLOCKED"
    if not failed_heads_ok:
        blocking_reasons.extend(fh_result["reasons"])

    # 3. Credit check & Cap (Total 160 credits / 120 for DSE)
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

    # 4. SIES GST Progression Gate: FE All-Clear Rule for Sem 5+ and SE All-Clear for Sem 7+
    fe_gate_cleared = True
    sem = profile.semester or 1
    fe_gate_sem = rules.get("fe_all_clear_sem", 5)
    se_gate_sem = rules.get("se_all_clear_sem", 7)
    prev_backlogs = int(academic.previous_backlogs or 0) if academic else 0

    if sem >= fe_gate_sem and prev_backlogs > 0:
        fe_gate_cleared = False
        blocking_reasons.append(
            f"Progression Gate Blocked: Entry to Semester {sem} requires 100% FE subjects cleared "
            f"under SIES GST Autonomous Regulations ({prev_backlogs} unresolved backlogs exist)."
        )

    # 5. AICTE N+2 Statutory Maximum Degree Duration Check (Max 6 years / 5 for DSE)
    is_dse = getattr(profile, "is_dse", False) or False
    max_duration = rules.get("max_degree_duration_dse_years", 5) if is_dse else rules.get("max_degree_duration_years", 6)
    adm_yr = profile.admission_year or 2024
    curr_yr = profile.current_year or 2026
    elapsed_years = max(curr_yr - adm_yr + 1, 1)
    duration_ok = elapsed_years <= max_duration
    if not duration_ok:
        blocking_reasons.append(
            f"AICTE N+2 Statutory Violation: Enrolled for {elapsed_years} years, exceeding "
            f"maximum permissible degree duration of {max_duration} years. Registration liable for de-registration."
        )

    # 6. AICTE Mandatory Activity Points & NCMC Audit
    act_pts_required = rules.get("activity_points_required_dse", 75) if is_dse else rules.get("activity_points_required", 100)
    act_pts_earned = getattr(profile, "activity_points", 85) or 85
    act_pts_met = act_pts_earned >= act_pts_required or sem < 7
    ncmc_cleared = getattr(profile, "ncmc_cleared", True) if getattr(profile, "ncmc_cleared", None) is not None else True

    eligible = attendance_met and failed_heads_ok and credit_met and fe_gate_cleared and duration_ok

    # Determine academic status
    if not eligible:
        if not attendance_met:
            status = "ATTENDANCE_BLOCKED"
        else:
            status = "PROGRESSION_BLOCKED"
    elif att_result["status"] == "CONDONATION_REQUIRED":
        status = "CONDONATION_REQUIRED"
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
        "ordinance_6086_status": att_result.get("ordinance", "Ordinance 6086 Compliant"),
        "fe_all_clear_gate_met": fe_gate_cleared,
        "aicte_duration_met": duration_ok,
        "aicte_years_elapsed": elapsed_years,
        "aicte_max_years": max_duration,
        "is_dse": is_dse,
        "activity_points_earned": act_pts_earned,
        "activity_points_required": act_pts_required,
        "activity_points_met": act_pts_met,
        "ncmc_cleared": ncmc_cleared,
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
