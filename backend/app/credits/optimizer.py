"""
optimizer.py — Automated Credit Graduation Path Optimizer.

Calculates the optimal semester-by-semester course registration and backlog clearance pathway
for a student to graduate on time (Semester 8), respecting the maximum credit load cap (28 credits/term).
"""
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.models import StudentProfile, CreditRecord, AcademicRecord


def optimize_graduation_path(student_id: int, db: Session) -> Dict[str, Any]:
    """
    Compute optimal semester-by-semester degree completion plan.
    """
    profile = db.query(StudentProfile).filter(StudentProfile.student_id == student_id).first()
    if not profile:
        raise ValueError("Student not found")

    from app.db.models import CourseResult
    courses = db.query(CourseResult).filter(CourseResult.student_id == student_id).all()
    if courses:
        passed = [c for c in courses if not c.is_failed and c.grade != 'F']
        failed = [c for c in courses if c.is_failed or c.grade == 'F']
        earned = float(sum(c.credits for c in passed))
        backlog = float(sum(c.credits for c in failed))
    else:
        credit = (
            db.query(CreditRecord)
            .filter(CreditRecord.student_id == student_id)
            .order_by(desc(CreditRecord.calculated_at), desc(CreditRecord.id))
            .first()
        )
        acad = (
            db.query(AcademicRecord)
            .filter(AcademicRecord.student_id == student_id)
            .order_by(desc(AcademicRecord.recorded_at), desc(AcademicRecord.id))
            .first()
        )
        earned = float(credit.earned_credits) if credit and credit.earned_credits is not None else 20.0 * (current_sem - 1)
        backlog = float(acad.backlog_credits) if acad and acad.backlog_credits is not None else (float(credit.deficit) if credit else 0.0)

    current_sem = profile.semester or 3
    total_degree_semesters = 8
    total_degree_credits = 160.0
    max_credits_per_term = 28.0

    remaining_credits = max(total_degree_credits - earned, 0.0)
    remaining_sems = list(range(current_sem + 1, total_degree_semesters + 1))

    if not remaining_sems:
        remaining_sems = [current_sem]

    n_terms = len(remaining_sems)
    needed_regular = max(remaining_credits - backlog, 0.0)
    regular_per_term = round(needed_regular / n_terms, 1) if n_terms > 0 else 20.0
    regular_term_load = min(max_credits_per_term, max(16.0, regular_per_term))

    semesters_plan: List[Dict[str, Any]] = []
    backlog_to_clear = backlog
    cumulative = earned

    for sem_num in remaining_sems:
        if sem_num == total_degree_semesters:
            needed = max(total_degree_credits - cumulative - backlog_to_clear, 0.0)
            regular_credits = round(min(needed, max_credits_per_term), 1)
        else:
            regular_credits = min(regular_term_load, max(total_degree_credits - cumulative, 0.0))

        # Backlog slots available in this term
        backlog_capacity = max(max_credits_per_term - regular_credits, 0.0)
        backlog_cleared_this_term = min(backlog_to_clear, backlog_capacity)
        backlog_to_clear -= backlog_cleared_this_term

        total_term = regular_credits + backlog_cleared_this_term
        cumulative += total_term

        semesters_plan.append({
            "semester": sem_num,
            "semester_name": f"Semester {sem_num}",
            "regular_credits": round(regular_credits, 1),
            "backlog_cleared": round(backlog_cleared_this_term, 1),
            "total_term_credits": round(total_term, 1),
            "max_allowed": round(max_credits_per_term, 1),
            "cumulative_credits": round(min(cumulative, total_degree_credits), 1),
            "capacity_usage_pct": round((total_term / max_credits_per_term) * 100.0, 1),
            "status": "CLEAR" if backlog_to_clear == 0 else "RECOVERY",
        })

    # Feasibility evaluation
    on_time = (backlog_to_clear == 0) and (cumulative >= total_degree_credits)

    if on_time:
        feasibility = "ON_TIME_FEASIBLE"
        badge_color = "#10b981"
        if backlog > 0:
            rec = (
                f"On-time graduation in Semester {total_degree_semesters} is fully feasible. "
                f"By taking up to {max([p['total_term_credits'] for p in semesters_plan] or [24])} credits in upcoming terms, "
                f"all {int(backlog)} backlog credits will be completely cleared without exceeding the {int(max_credits_per_term)} credit cap."
            )
        else:
            rec = (
                f"On-time graduation in Semester {total_degree_semesters} is fully feasible. "
                f"The student is on-track with 0 backlog credits. Maintaining a regular load of ~{int(round(regular_term_load))} credits/semester "
                f"will fulfill all {int(total_degree_credits)} curriculum credits on schedule."
            )
    else:
        feasibility = "CREDIT_OVERLOAD_RISK"
        badge_color = "#f43f5e"
        rec = (
            f"High credit backlog ({int(backlog)} credits remaining). "
            f"Clearing all credits within Semester {total_degree_semesters} requires exceeding the term credit cap of {int(max_credits_per_term)}. "
            f"Recommended: consult mentor to enroll in summer remedial term or fast-track KT examinations."
        )

    return {
        "student_id": profile.student_id,
        "roll_no": profile.roll_no,
        "student_name": profile.user.name if profile.user else "Student",
        "current_semester": current_sem,
        "total_degree_credits": total_degree_credits,
        "earned_credits": round(earned, 1),
        "backlog_credits": round(backlog, 1),
        "remaining_credits": round(remaining_credits, 1),
        "completion_pct": round((earned / total_degree_credits) * 100.0, 1),
        "feasibility": feasibility,
        "badge_color": badge_color,
        "max_credits_per_term": max_credits_per_term,
        "projected_completion_semester": total_degree_semesters if on_time else total_degree_semesters + 1,
        "semesters_plan": semesters_plan,
        "recommendation": rec,
    }
