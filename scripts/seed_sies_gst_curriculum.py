#!/usr/bin/env python3
"""
seed_sies_gst_curriculum.py — Comprehensive SIES GST Autonomous Multi-Year Seeder.

Expands:
1. Complete SIES GST Autonomous 8-Semester Course Catalog (42 courses across Sem 1-8).
2. Multi-Semester Historical Gradebooks & Course Results for all students (FE, SE, TE, BE).
3. Student-specific Intervention Plans with target courses, milestone objectives, progress %,
   and interactive weekly action checklists.
4. Generates CSV datasets in data/ matching the project schema.
"""
import sys
import os
import csv
import random
from datetime import datetime, timezone, timedelta

# Allow running from root or backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.base import Base, SessionLocal, engine
from app.db.models import (
    User, StudentProfile, Course, StudentFaculty,
    AcademicRecord, CourseResult, CreditRecord, RiskHistory, RiskLevel,
    Intervention, InterventionStatus, InterventionType, InterventionPriority,
    UserRole, UserStatus
)
from app.curriculum.sies_gst import SIES_GST_CURRICULUM, get_all_courses

# Ensure tables are created
Base.metadata.create_all(bind=engine)


def seed_curriculum_and_history():
    db = SessionLocal()
    try:
        print("\n=======================================================")
        print("  SIES GST Autonomous Multi-Year Curriculum & Audit Seed")
        print("=======================================================\n")

        # ── 1. Seed All 8-Semester Courses ────────────────────────────────
        print("> Seeding complete 8-semester course catalog...")
        faculty_users = db.query(User).filter(User.role == UserRole.faculty).all()
        if not faculty_users:
            print("  [!] Warning: No faculty found, creating default faculty")
            from passlib.context import CryptContext
            pwd = CryptContext(schemes=['bcrypt'], deprecated='auto')
            fac = User(
                email="faculty1@college.edu",
                name="Dr. Ramesh Kumar",
                password_hash=pwd.hash("Demo@1234"),
                role=UserRole.faculty,
                status=UserStatus.active
            )
            db.add(fac)
            db.flush()
            faculty_users = [fac]

        all_courses = get_all_courses()
        course_map = {}
        course_rows_for_csv = []

        for idx, c_data in enumerate(all_courses):
            code = c_data["code"]
            assigned_fac = faculty_users[idx % len(faculty_users)]
            course = db.query(Course).filter(Course.code == code).first()
            if not course:
                course = Course(
                    code=code,
                    name=c_data["name"],
                    credits=c_data["credits"],
                    semester=c_data["semester"],
                    faculty_id=assigned_fac.id,
                )
                db.add(course)
                db.flush()
                print(f"  [+] Course Sem {c_data['semester']}: {code} - {c_data['name']} ({c_data['credits']} cr)")
            else:
                course.name = c_data["name"]
                course.credits = c_data["credits"]
                course.semester = c_data["semester"]
                course.faculty_id = assigned_fac.id
                db.flush()

            course_map[code] = course
            course_rows_for_csv.append({
                "course_code": code,
                "course_name": c_data["name"],
                "semester": c_data["semester"],
                "credits": c_data["credits"],
                "ise_max": 20,
                "mse_max": 20,
                "ese_max": 60,
                "tw_max": c_data.get("tw", 25),
                "pr_or_max": c_data.get("pr_or", 25),
                "faculty_email": assigned_fac.email,
            })

        db.commit()
        print(f"  [OK] Total catalog courses active: {len(all_courses)}")

        # ── 2. Seed Multi-Semester Historical Gradebook & CourseResults ─────
        print("\n> Generating multi-semester historical audit for student cohorts...")
        profiles = db.query(StudentProfile).all()
        print(f"  Found {len(profiles)} students to enrich with historical semester data.")

        now = datetime.now(timezone.utc)
        acad_rows_csv = []
        course_res_csv = []

        for profile in profiles:
            rng = random.Random(profile.student_id * 97)
            cur_sem = profile.semester or 1
            
            # Historical semesters: 1 up to cur_sem
            for s in range(1, cur_sem + 1):
                is_current = (s == cur_sem)
                term_label = f"SEM{s}"
                rec_date = now - timedelta(days=(cur_sem - s) * 150 + rng.randint(0, 20))

                # Determine semester performance level
                # If current semester student has scenario, past semesters are typically better or consistent
                base_gpa = 7.5 + rng.uniform(-1.0, 1.2) if not is_current else 6.5 + rng.uniform(-1.5, 1.5)
                base_gpa = max(3.5, min(9.8, round(base_gpa, 2)))
                base_att = 82.0 + rng.uniform(-8.0, 10.0) if not is_current else 72.0 + rng.uniform(-15.0, 15.0)
                base_att = max(42.0, min(98.0, round(base_att, 1)))

                sem_courses = SIES_GST_CURRICULUM.get(s, [])
                failed_heads_count = 0
                ese_failed_count = 0
                failed_subjects_count = 0
                total_credits_earned = 0
                total_credits_expected = sum(c["credits"] for c in sem_courses)

                # Generate CourseResult for every subject in semester s
                for c_info in sem_courses:
                    c_code = c_info["code"]
                    c_name = c_info["name"]
                    c_cr = c_info["credits"]
                    tw_max = float(c_info.get("tw", 25))
                    pr_max = float(c_info.get("pr_or", 0))

                    factor = 0.85 + rng.uniform(-0.15, 0.25)
                    # Marks breakdown
                    ise_m = min(20.0, max(6.0, round((base_gpa * 2.0) * factor, 1)))
                    mse_m = min(20.0, max(5.0, round((base_gpa * 1.9) * factor, 1)))
                    ese_raw = min(60.0, max(14.0, round((base_gpa * 5.8) * factor, 1)))

                    # Grace marks (Ordinance 5042)
                    grace = 0.0
                    ord_applied = None
                    ese_m = ese_raw
                    if 21.0 <= ese_raw < 24.0:
                        grace = round(24.0 - ese_raw, 1)
                        ese_m = 24.0
                        ord_applied = "O.5042 (Grace)"

                    tw_m = min(tw_max, max(8.0, round(tw_max * (base_gpa / 10.0) * factor, 1))) if tw_max > 0 else None
                    pr_m = min(pr_max, max(8.0, round(pr_max * (base_gpa / 10.0) * factor, 1))) if pr_max > 0 else None

                    total_m = round(ise_m + mse_m + ese_m, 1)
                    is_ese_fail = ese_m < 24.0
                    is_tw_fail = tw_m is not None and tw_m < (tw_max * 0.4)
                    is_sub_fail = total_m < 40.0 or is_ese_fail or is_tw_fail
                    grade = "F" if is_sub_fail else ("O" if total_m >= 80 else "A" if total_m >= 75 else "B" if total_m >= 70 else "C" if total_m >= 60 else "D" if total_m >= 50 else "P")
                    gp = 0.0 if is_sub_fail else (10.0 if total_m >= 80 else 9.0 if total_m >= 75 else 8.0 if total_m >= 70 else 7.0 if total_m >= 60 else 6.0 if total_m >= 50 else 4.0)

                    c_att = max(40.0, min(100.0, round(base_att + rng.uniform(-6, 6), 1)))

                    if is_sub_fail:
                        failed_subjects_count += 1
                        if is_ese_fail:
                            ese_failed_count += 1
                            failed_heads_count += 1
                        if is_tw_fail:
                            failed_heads_count += 1
                    else:
                        total_credits_earned += c_cr

                    # Upsert CourseResult
                    existing_cr = db.query(CourseResult).filter(
                        CourseResult.student_id == profile.student_id,
                        CourseResult.semester == s,
                        CourseResult.course_code == c_code
                    ).first()
                    if not existing_cr:
                        existing_cr = CourseResult(
                            student_id=profile.student_id,
                            semester=s,
                            course_code=c_code,
                            course_name=c_name,
                        )
                        db.add(existing_cr)

                    existing_cr.credits = c_cr
                    existing_cr.ise_marks = ise_m
                    existing_cr.mse_marks = mse_m
                    existing_cr.ese_marks = ese_m
                    existing_cr.tw_marks = tw_m
                    existing_cr.pr_or_marks = pr_m
                    existing_cr.grace_marks = grace
                    existing_cr.ordinance_applied = ord_applied
                    existing_cr.total_marks = total_m
                    existing_cr.percentage = total_m
                    existing_cr.grade = grade
                    existing_cr.grade_point = gp
                    existing_cr.is_failed = is_sub_fail
                    existing_cr.is_ese_failed = is_ese_fail
                    existing_cr.is_tw_failed = is_tw_fail
                    existing_cr.attendance_percentage = c_att
                    existing_cr.recorded_at = rec_date

                    course_res_csv.append({
                        "student_id": profile.student_id,
                        "roll_no": profile.roll_no,
                        "semester": s,
                        "course_code": c_code,
                        "course_name": c_name,
                        "credits": c_cr,
                        "ise_marks": ise_m,
                        "mse_marks": mse_m,
                        "ese_marks": ese_m,
                        "tw_marks": tw_m,
                        "pr_or_marks": pr_m,
                        "total_marks": total_m,
                        "grade": grade,
                        "grade_point": gp,
                        "is_failed": is_sub_fail,
                        "is_ese_failed": is_ese_fail,
                        "attendance_percentage": c_att,
                        "grace_marks": grace,
                        "ordinance_applied": ord_applied,
                    })

                # Ensure AcademicRecord exists for this term
                existing_acad = db.query(AcademicRecord).filter(
                    AcademicRecord.student_id == profile.student_id,
                    AcademicRecord.term == term_label
                ).first()
                if not existing_acad:
                    existing_acad = AcademicRecord(
                        student_id=profile.student_id,
                        term=term_label,
                        attendance=base_att,
                        marks=round(base_gpa * 9.5, 1),
                        gpa=base_gpa,
                        assignment_completion=max(35.0, min(95.0, round(base_att * 0.95 + rng.uniform(-5, 5), 1))),
                        failed_subjects=failed_subjects_count,
                        failed_heads=failed_heads_count,
                        ese_failed_heads=ese_failed_count,
                        previous_backlogs=0 if s == 1 else rng.randint(0, 1),
                        backlog_credits=float(total_credits_expected - total_credits_earned),
                        recorded_at=rec_date,
                        source="sies_gst_seed",
                    )
                    db.add(existing_acad)
                else:
                    existing_acad.failed_heads = failed_heads_count
                    existing_acad.ese_failed_heads = ese_failed_count
                    existing_acad.failed_subjects = failed_subjects_count
                    existing_acad.backlog_credits = float(total_credits_expected - total_credits_earned)

                acad_rows_csv.append({
                    "student_id": profile.student_id,
                    "roll_no": profile.roll_no,
                    "term": term_label,
                    "semester": s,
                    "gpa": base_gpa,
                    "marks": round(base_gpa * 9.5, 1),
                    "attendance": base_att,
                    "failed_subjects": failed_subjects_count,
                    "failed_heads": failed_heads_count,
                    "ese_failed_heads": ese_failed_count,
                    "recorded_at": rec_date.isoformat(),
                })

            # Check / Create Student-specific Intervention with Progress Tracking
            existing_iv = db.query(Intervention).filter(Intervention.student_id == profile.student_id).first()
            if existing_iv:
                # Find student's weak course from current semester
                cur_courses = db.query(CourseResult).filter(
                    CourseResult.student_id == profile.student_id,
                    CourseResult.semester == cur_sem
                ).all()
                weak_course = next((c for c in cur_courses if c.is_failed or c.is_ese_failed), None)
                if not weak_course and cur_courses:
                    weak_course = sorted(cur_courses, key=lambda x: (x.total_marks or 100))[0]

                target_code = weak_course.course_code if weak_course else "CS302"
                target_name = weak_course.course_name if weak_course else "Data Structures"
                
                mentor_user = profile.mentor
                mentor_name = mentor_user.name if mentor_user else "Prof. Arjun Sharma"

                # Update intervention with target, checklist, and progress
                existing_iv.target_course_code = target_code
                existing_iv.target_course_name = target_name
                existing_iv.milestone_goal = f"Restore attendance >=75% & clear continuous assessments in {target_code}"
                
                # Check 1 or 2 items to give realistic ongoing progress (e.g. 33% or 50%)
                is_partial = profile.student_id % 3 == 0
                existing_iv.action_checklist = [
                    {
                        "id": 1,
                        "week": 1,
                        "task": f"Attendance Check: Attend 100% of lectures in {target_name} ({target_code}) this week",
                        "completed": True if is_partial else False,
                    },
                    {
                        "id": 2,
                        "week": 1,
                        "task": f"Mentor 1-on-1: Meet {mentor_name} to review failed heads and agree on milestone timeline",
                        "completed": True if is_partial else False,
                    },
                    {
                        "id": 3,
                        "week": 2,
                        "task": f"Term Work Catch-up: Submit overdue lab journal experiments for {target_name}",
                        "completed": False,
                    },
                    {
                        "id": 4,
                        "week": 2,
                        "task": f"Continuous Assessment: Clear Unit 1 & 2 remediation tests with minimum 12/20 in ISE",
                        "completed": False,
                    },
                    {
                        "id": 5,
                        "week": 3,
                        "task": f"Question Bank: Solve past 3 semesters' ESE question papers for {target_code}",
                        "completed": False,
                    },
                    {
                        "id": 6,
                        "week": 4,
                        "task": f"Final Readiness: Complete timed mock exam with course faculty sign-off",
                        "completed": False,
                    },
                ]
                existing_iv.progress_pct = 33 if is_partial else 0
                if is_partial and existing_iv.status == InterventionStatus.pending:
                    existing_iv.status = InterventionStatus.in_progress

        db.commit()
        print(f"  [OK] Successfully enriched all {len(profiles)} students with historical records & course results.")

        # ── 3. Write CSV Datasets to data/ ────────────────────────────────
        print("\n> Exporting realistic CSV datasets into data/...")
        data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data'))
        os.makedirs(data_dir, exist_ok=True)

        catalog_csv_path = os.path.join(data_dir, "sies_gst_courses_catalog.csv")
        with open(catalog_csv_path, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "course_code", "course_name", "semester", "credits",
                "ise_max", "mse_max", "ese_max", "tw_max", "pr_or_max", "faculty_email"
            ])
            writer.writeheader()
            writer.writerows(course_rows_for_csv)
        print(f"  [+] Wrote {len(course_rows_for_csv)} courses to {catalog_csv_path}")

        acad_csv_path = os.path.join(data_dir, "sies_gst_multiyear_academic_records.csv")
        with open(acad_csv_path, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "student_id", "roll_no", "term", "semester", "gpa", "marks",
                "attendance", "failed_subjects", "failed_heads", "ese_failed_heads", "recorded_at"
            ])
            writer.writeheader()
            writer.writerows(acad_rows_csv)
        print(f"  [+] Wrote {len(acad_rows_csv)} academic records to {acad_csv_path}")

        cr_csv_path = os.path.join(data_dir, "sies_gst_student_course_results.csv")
        with open(cr_csv_path, mode="w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=[
                "student_id", "roll_no", "semester", "course_code", "course_name",
                "credits", "ise_marks", "mse_marks", "ese_marks", "tw_marks",
                "pr_or_marks", "total_marks", "grade", "grade_point", "is_failed",
                "is_ese_failed", "attendance_percentage", "grace_marks", "ordinance_applied"
            ])
            writer.writeheader()
            writer.writerows(course_res_csv)
        print(f"  [+] Wrote {len(course_res_csv)} course result records to {cr_csv_path}")

        print("\n=======================================================")
        print("  SIES GST Multi-Year Curriculum Seeding Complete! [OK]")
        print("=======================================================\n")

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Seeding failed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_curriculum_and_history()
