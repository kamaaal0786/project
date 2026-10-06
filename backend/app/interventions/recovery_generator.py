"""
recovery_generator.py — AI-Powered Personalized Academic Recovery Generator.

Generates:
1. Tailored 4-Week Milestone Recovery Roadmap based on student's exact academic profile,
   failed heads, attendance deficit, and credit gap.
2. 1-Click Personalized Mentor Outreach Email/Message draft for immediate action.

Hybrid Architecture:
- Uses Google Gemini API if GEMINI_API_KEY is configured in .env / os.environ.
- Uses an Intelligent Academic Recovery Algorithm when offline (zero external API keys needed).
"""
import os
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.models import (
    StudentProfile, AcademicRecord, CreditRecord, RiskHistory, CourseResult,
    Intervention, InterventionStatus, InterventionType, InterventionPriority, User
)

logger = logging.getLogger(__name__)


def _build_context(student_id: int, db: Session) -> Dict[str, Any]:
    """Gather complete student context for recovery generation, including course-level diagnostics."""
    profile = db.query(StudentProfile).filter(StudentProfile.student_id == student_id).first()
    if not profile:
        raise ValueError("Student not found")

    acad = (
        db.query(AcademicRecord)
        .filter(AcademicRecord.student_id == student_id)
        .order_by(desc(AcademicRecord.recorded_at), desc(AcademicRecord.id))
        .first()
    )

    credit = (
        db.query(CreditRecord)
        .filter(CreditRecord.student_id == student_id)
        .order_by(desc(CreditRecord.id))
        .first()
    )

    risk = (
        db.query(RiskHistory)
        .filter(RiskHistory.student_id == student_id)
        .order_by(desc(RiskHistory.calculated_at), desc(RiskHistory.id))
        .first()
    )

    mentor_user = db.query(User).filter(User.id == profile.mentor_id).first() if profile.mentor_id else None

    # Query course results for fine-grained per-subject diagnosis
    crs = (
        db.query(CourseResult)
        .filter(CourseResult.student_id == student_id)
        .order_by(desc(CourseResult.semester), desc(CourseResult.is_failed), desc(CourseResult.id))
        .all()
    )

    failed_courses = [
        {
            "course_code": c.course_code,
            "course_name": c.course_name or c.course_code,
            "semester": c.semester,
            "is_ese_failed": bool(c.is_ese_failed),
            "is_tw_failed": bool(c.is_tw_failed),
            "is_pr_failed": bool(c.is_pr_failed),
            "attendance": c.attendance_percentage,
            "total_marks": c.total_marks,
        }
        for c in crs
        if c.is_failed or c.is_ese_failed or c.is_tw_failed or c.is_pr_failed or (c.grade in ("F", "FF"))
    ]

    weak_courses = [
        {
            "course_code": c.course_code,
            "course_name": c.course_name or c.course_code,
            "semester": c.semester,
            "attendance": c.attendance_percentage,
            "total_marks": c.total_marks,
        }
        for c in crs
        if (c.total_marks is not None and c.total_marks < 45) or (c.attendance_percentage is not None and c.attendance_percentage < 75.0)
    ]

    # Determine primary recovery target course
    if failed_courses:
        target_course_code = failed_courses[0]["course_code"]
        target_course_name = failed_courses[0]["course_name"]
    elif weak_courses:
        target_course_code = weak_courses[0]["course_code"]
        target_course_name = weak_courses[0]["course_name"]
    elif crs:
        target_course_code = crs[0].course_code
        target_course_name = crs[0].course_name or crs[0].course_code
    else:
        target_course_code = "CS-CORE"
        target_course_name = "Core Curricular Subjects"

    return {
        "student_id": profile.student_id,
        "name": profile.user.name if profile.user else "Student",
        "email": profile.user.email if profile.user else "",
        "roll_no": profile.roll_no,
        "program": profile.program,
        "branch": profile.branch or profile.program.replace("B.Tech ", ""),
        "semester": profile.semester,
        "mentor_name": mentor_user.name if mentor_user else "Academic Mentor",
        "attendance": acad.attendance if acad and acad.attendance is not None else 75.0,
        "marks": acad.marks if acad and acad.marks is not None else 65.0,
        "gpa": acad.gpa if acad and acad.gpa is not None else 6.5,
        "assignment_completion": acad.assignment_completion if acad and acad.assignment_completion is not None else 70.0,
        "failed_subjects": acad.failed_subjects if acad and acad.failed_subjects is not None else 0,
        "failed_heads": acad.failed_heads if acad and acad.failed_heads is not None else 0,
        "backlog_credits": acad.backlog_credits if acad and acad.backlog_credits is not None else 0,
        "earned_credits": credit.earned_credits if credit else 20.0,
        "expected_credits": credit.expected_credits if credit else 24.0,
        "credit_deficit": credit.deficit if credit else 0.0,
        "risk_level": risk.risk_level.value.upper() if risk else "MEDIUM",
        "risk_probability": risk.probability if risk else 0.35,
        "target_course_code": target_course_code,
        "target_course_name": target_course_name,
        "failed_courses": failed_courses,
        "weak_courses": weak_courses,
    }


def generate_recovery_plan(student_id: int, db: Session) -> Dict[str, Any]:
    """Generate 4-week recovery roadmap, checklist, and mentor message."""
    ctx = _build_context(student_id, db)

    # Check for live Gemini API
    api_key = os.environ.get("GEMINI_API_KEY")
    if api_key:
        try:
            return _generate_with_gemini(ctx, api_key)
        except Exception as e:
            logger.warning("Gemini API call failed, falling back to local reasoning engine: %s", e)

    return _generate_with_reasoning_engine(ctx)


def _generate_with_reasoning_engine(ctx: Dict[str, Any]) -> Dict[str, Any]:
    """Deterministic, high-quality personalized academic recovery plan."""
    att = ctx["attendance"]
    failed = ctx["failed_heads"]
    deficit = ctx["credit_deficit"]
    asgn = ctx["assignment_completion"]
    name = ctx["name"]
    sem = ctx["semester"]
    branch = ctx["branch"]
    tgt_code = ctx["target_course_code"]
    tgt_name = ctx["target_course_name"]
    failed_courses = ctx.get("failed_courses", [])

    # Focus priorities
    priorities = []
    if failed_courses:
        names_str = ", ".join([c["course_code"] for c in failed_courses[:2]])
        priorities.append(f"Clearance of Backlog in {names_str}")
    elif failed > 0:
        priorities.append(f"Clearance of {failed} Failed Heads / KT")

    if att < 75.0:
        priorities.append(f"Ordinance 6086 Attendance Recovery ({att:.1f}% -> >=75%)")
    if deficit > 0:
        priorities.append(f"Credit Recovery Gap ({deficit:.1f} credits deficit)")
    if asgn < 65.0:
        priorities.append("Continuous Internal Assessment (ISE/Lab) Catch-up")
    if not priorities:
        priorities.append("Academic Distinction & Capstone Preparation")

    # Milestone Goal
    if failed > 0:
        milestone_goal = f"Clear all {failed} KT heads in {tgt_code} ({tgt_name}) and attain passing threshold (>=40%)."
    elif att < 75.0:
        milestone_goal = f"Attend mandatory remedial sessions to restore Ordinance 6086 compliance (target >= 75%)."
    elif deficit > 0:
        milestone_goal = f"Eliminate {deficit:.1f} credit deficit through structured makeup tests and lab completion."
    else:
        milestone_goal = f"Target SGPA >= 8.0 in {branch} Semester {sem} core subjects."

    # Weekly milestone definitions
    week1_action = f"Attend 100% of lectures in {tgt_name} ({tgt_code}). Complete initial diagnostic review with mentor {ctx['mentor_name']}."
    week1_target = f"Restore weekly attendance to >90% and finalize remediation schedule."

    week2_action = f"Submit pending continuous evaluation assignments and Term Work journals for {tgt_code}."
    week2_target = f"Achieve >85% lab submission completion and attend doubt clearing sessions."

    week3_action = f"Solve previous 3 years' KT / ESE examination question banks for {tgt_name} ({tgt_code})."
    week3_target = f"Score minimum 60% in timed self-evaluation under exam conditions."

    week4_action = f"Appear for comprehensive departmental mock examination for {tgt_code} and obtain mentor sign-off."
    week4_target = f"Validate exam clearance readiness and close active academic recovery cycle."

    weeks = [
        {
            "week_number": 1,
            "title": "Attendance & Habit Stabilization",
            "primary_focus": f"Attendance & Diagnostics in {tgt_code}",
            "daily_study_hours": 2.5 if failed == 0 else 3.5,
            "action_items": [
                week1_action,
                f"Audit missing lecture notes and textbook chapters for {tgt_name}.",
                "Establish a fixed 2-hour daily evening study routine.",
            ],
            "milestone_goal": week1_target,
            "mentor_checkpoint": "30-minute 1-on-1 goal-setting session on Friday.",
        },
        {
            "week_number": 2,
            "title": "Continuous Assessment & Lab Catch-Up",
            "primary_focus": f"Term Work & ISE for {tgt_code}",
            "daily_study_hours": 3.0 if failed == 0 else 4.0,
            "action_items": [
                week2_action,
                "Form peer-study partnership for challenging technical modules.",
                f"Consult course faculty during office hours for doubt resolution in {tgt_code}.",
            ],
            "milestone_goal": week2_target,
            "mentor_checkpoint": "Review completed assignments before faculty submission.",
        },
        {
            "week_number": 3,
            "title": "Backlog Remediation & Technical Deep-Dive",
            "primary_focus": f"Core Exam Concepts in {tgt_code}",
            "daily_study_hours": 3.5 if failed == 0 else 4.5,
            "action_items": [
                week3_action,
                "Attend departmental remedial coaching and tutorial sessions.",
                "Practice high-weightage numerical problems and theoretical derivations.",
            ],
            "milestone_goal": week3_target,
            "mentor_checkpoint": "Evaluate practice test scores and adjust weak areas.",
        },
        {
            "week_number": 4,
            "title": "Exam Readiness & Clearance Confirmation",
            "primary_focus": "Mock Evaluation & Consolidation",
            "daily_study_hours": 3.0,
            "action_items": [
                week4_action,
                "Review formula sheets, cheat-sheets, and essential theorems.",
                "Final clearance interview; sign-off on completed recovery plan.",
            ],
            "milestone_goal": week4_target,
            "mentor_checkpoint": "Final clearance interview; sign-off on completed recovery plan.",
        },
    ]

    # Structured Action Checklist for tracking progress
    checklist = [
        {
            "id": 1,
            "week": 1,
            "task": f"Meet mentor {ctx['mentor_name']} for 1-on-1 review and attendance commitment in {tgt_name}",
            "completed": False,
        },
        {
            "id": 2,
            "week": 1,
            "task": f"Obtain syllabus audit checklist and lecture notes for {tgt_code} ({tgt_name})",
            "completed": False,
        },
        {
            "id": 3,
            "week": 2,
            "task": f"Submit pending continuous assessment (ISE) assignments and lab journals for {tgt_code}",
            "completed": False,
        },
        {
            "id": 4,
            "week": 2,
            "task": f"Attend departmental remedial doubt-clearing sessions for {tgt_code}",
            "completed": False,
        },
        {
            "id": 5,
            "week": 3,
            "task": f"Solve previous 3 years' KT / ESE examination papers for {tgt_name}",
            "completed": False,
        },
        {
            "id": 6,
            "week": 4,
            "task": f"Complete timed 60-mark mock examination and secure final clearance sign-off from mentor {ctx['mentor_name']}",
            "completed": False,
        },
    ]

    # Personalized Outreach Email Draft
    outreach_subject = f"Support & Action Plan for Semester {sem} — {name} ({ctx['roll_no']})"
    outreach_body = (
        f"Dear {name},\n\n"
        f"I am reaching out regarding your academic progress in Semester {sem} of {ctx['program']}.\n\n"
        f"Our recent evaluation highlights key areas where timely action will protect your semester standing:\n"
        f"• Primary Target Subject: {tgt_name} ({tgt_code})\n"
        f"• Current Attendance: {att:.1f}% " + ("(below Ordinance 6086 minimum 75% requirement)" if att < 75 else "(compliant)") + "\n"
        f"• Grade Standing: {ctx['gpa']} GPA ({ctx['marks']}%)" + (f" with {failed} failed heads requiring clearance" if failed > 0 else "") + "\n"
        f"• Credit Progress: {ctx['earned_credits']}/{ctx['expected_credits']} credits earned" + (f" (credit gap: {deficit:.1f})" if deficit > 0 else "") + "\n\n"
        f"To ensure you stay on track for graduation, the department has structured a 4-Week Academic Recovery Plan for you. "
        f"We will review your weekly milestones together every Friday.\n\n"
        f"Please schedule a brief 15-minute meeting with me this week so we can review this roadmap together.\n\n"
        f"Warm regards,\n"
        f"{ctx['mentor_name']}\n"
        f"Academic Mentor, Department of {branch}\n"
        f"SIES Graduate School of Technology"
    )

    return {
        "student_id": ctx["student_id"],
        "student_name": name,
        "roll_no": ctx["roll_no"],
        "target_course_code": tgt_code,
        "target_course_name": tgt_name,
        "milestone_goal": milestone_goal,
        "action_checklist": checklist,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "engine_type": "Deterministic Academic Reasoning Engine",
        "primary_priorities": priorities,
        "roadmap": weeks,
        "outreach": {
            "subject": outreach_subject,
            "recipient_email": ctx["email"],
            "body": outreach_body,
        },
    }


def _generate_with_gemini(ctx: Dict[str, Any], api_key: str) -> Dict[str, Any]:
    """Generate plan using Google Gemini API if key is supplied."""
    import httpx
    prompt = f"""
You are an expert college academic counselor at SIES GST. Create a personalized 4-week academic recovery plan and mentor outreach email for:
Student Name: {ctx['name']}
Roll Number: {ctx['roll_no']}
Program: {ctx['program']}, Semester {ctx['semester']}
Attendance: {ctx['attendance']}% (College minimum is 75%)
GPA: {ctx['gpa']} / 10.0 (Marks: {ctx['marks']}%)
Failed Heads/KT: {ctx['failed_heads']}
Credit Deficit: {ctx['credit_deficit']}
Primary Target Subject: {ctx['target_course_name']} ({ctx['target_course_code']})
Mentor Name: {ctx['mentor_name']}

Return a JSON object with:
- "target_course_code": string
- "target_course_name": string
- "milestone_goal": string
- "primary_priorities": list of 2-3 key focus areas
- "action_checklist": array of 4-6 objects, each with "id" (int), "week" (int 1-4), "task" (string), "completed" (false)
- "roadmap": array of 4 objects, each containing:
  - "week_number": 1, 2, 3, or 4
  - "title": short string
  - "primary_focus": string
  - "daily_study_hours": number
  - "action_items": array of 3 specific actionable bullet points
  - "milestone_goal": string
  - "mentor_checkpoint": string
- "outreach": object with "subject", "recipient_email", and "body" (empathetic mentor email draft)
"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"response_mime_type": "application/json"}
    }
    with httpx.Client(timeout=25.0) as client:
        resp = client.post(url, json=payload)
        resp.raise_for_status()
        text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
        parsed["student_id"] = ctx["student_id"]
        parsed["student_name"] = ctx["name"]
        parsed["roll_no"] = ctx["roll_no"]
        parsed.setdefault("target_course_code", ctx["target_course_code"])
        parsed.setdefault("target_course_name", ctx["target_course_name"])
        parsed["generated_at"] = datetime.now(timezone.utc).isoformat()
        parsed["engine_type"] = "Google Gemini 1.5 Flash"
        return parsed
