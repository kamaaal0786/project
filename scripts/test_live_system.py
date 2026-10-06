#!/usr/bin/env python3
"""
Comprehensive Live System Feature Verification Script.
Tests every API endpoint, role permission, ML prediction,
regulation evaluation, credit calculation, and intervention workflow
against the live running server (http://localhost:8000).
"""
import httpx
import sys
import json

BASE_URL = "http://localhost:8000"

def run_audit():
    client = httpx.Client(base_url=BASE_URL, timeout=15.0)
    report = []

    def log_result(name, passed, detail=""):
        status_str = "PASS" if passed else "FAIL"
        report.append({"feature": name, "status": status_str, "detail": detail})
        print(f"[{status_str}] {name} - {detail}")

    print("\n=======================================================")
    print("   AI CREDIT & DROPOUT SYSTEM - LIVE FEATURE AUDIT     ")
    print("=======================================================\n")

    # 1. Health check
    try:
        r = client.get("/health")
        log_result("System Health Check", r.status_code == 200, f"Status: {r.status_code}, Version: {r.json().get('version')}")
    except Exception as e:
        log_result("System Health Check", False, str(e))
        return

    # 2. Authentication across all 4 roles
    tokens = {}
    users_to_test = [
        ("Admin", "admin@college.edu", "Demo@1234"),
        ("Mentor", "mentor1@college.edu", "Demo@1234"),
        ("Faculty", "faculty1@college.edu", "Demo@1234"),
        ("Student", "student001@college.edu", "Demo@1234"),
    ]
    for role_name, email, pwd in users_to_test:
        r = client.post("/api/auth/login", data={"username": email, "password": pwd})
        if r.status_code == 200:
            data = r.json()
            tokens[role_name] = data["access_token"]
            log_result(f"Auth Login ({role_name})", True, f"Token generated for {data['name']} (Role: {data['role']})")
        else:
            log_result(f"Auth Login ({role_name})", False, f"HTTP {r.status_code}")

    admin_h = {"Authorization": f"Bearer {tokens.get('Admin')}"}
    faculty_h = {"Authorization": f"Bearer {tokens.get('Faculty')}"}
    mentor_h = {"Authorization": f"Bearer {tokens.get('Mentor')}"}
    student_h = {"Authorization": f"Bearer {tokens.get('Student')}"}

    # 3. GET /api/me
    r = client.get("/api/me", headers=admin_h)
    log_result("Current User Profile (/api/me)", r.status_code == 200, f"Role: {r.json().get('role')}, Email: {r.json().get('email')}")

    # 4. Role-based Dashboard KPIs
    for r_name, h in [("Admin", admin_h), ("Faculty", faculty_h), ("Mentor", mentor_h), ("Student", student_h)]:
        r = client.get("/api/dashboard/summary", headers=h)
        log_result(f"Dashboard KPIs ({r_name})", r.status_code == 200, f"Status: {r.status_code}, Keys: {list(r.json().keys()) if r.status_code==200 else 'Error'}")

    # 5. RBAC & Student Isolation
    # Admin should see all students
    r_admin_st = client.get("/api/students", headers=admin_h)
    admin_count = len(r_admin_st.json()) if r_admin_st.status_code == 200 else 0
    # Student should ONLY see themselves
    r_stud_st = client.get("/api/students", headers=student_h)
    student_count = len(r_stud_st.json()) if r_stud_st.status_code == 200 else -1
    log_result("RBAC Student List Isolation", admin_count > 1 and student_count == 1,
               f"Admin sees {admin_count} students; Student sees exactly {student_count} student")

    # 6. Single Student Detail
    r_detail = client.get("/api/students/1", headers=faculty_h)
    if r_detail.status_code == 200:
        s_data = r_detail.json()
        has_profile = bool(s_data.get("branch") and s_data.get("regulation"))
        has_acad = bool(s_data.get("latest_academic_record"))
        log_result("Student Detail API", has_profile and has_acad,
                   f"Branch: {s_data.get('branch')}, Regulation: {s_data.get('regulation')}, GPA: {s_data.get('latest_academic_record', {}).get('gpa')}")
    else:
        log_result("Student Detail API", False, f"HTTP {r_detail.status_code}")

    # 7. Engine B: ML Dropout Prediction & Inference
    r_pred = client.post("/api/risk/1/predict", headers=faculty_h)
    if r_pred.status_code == 200:
        pred_data = r_pred.json()
        log_result("Engine B: ML Risk Prediction", True,
                   f"Risk: {pred_data.get('risk_level')} ({pred_data.get('risk_probability'):.1%}), Model: {pred_data.get('model_version')}")
    else:
        log_result("Engine B: ML Risk Prediction", False, f"HTTP {r_pred.status_code}: {r_pred.text}")

    # 8. Explainability (SHAP / Feature Drivers)
    r_exp = client.get("/api/risk/1/explanation", headers=faculty_h)
    if r_exp.status_code == 200:
        exp_data = r_exp.json()
        factors = [f['feature'] for f in exp_data.get("top_factors", [])]
        log_result("ML Explainability (SHAP)", True, f"Top Factors: {factors}, Method: {exp_data.get('method')}")
    else:
        log_result("ML Explainability (SHAP)", False, f"HTTP {r_exp.status_code}")

    # 9. Risk History Tracking
    r_hist = client.get("/api/risk/1/history", headers=faculty_h)
    if r_hist.status_code == 200:
        snapshots = r_hist.json()
        log_result("Risk History Snapshots", len(snapshots) > 0, f"Stored Snapshots: {len(snapshots)} snapshots")
    else:
        log_result("Risk History Snapshots", False, f"HTTP {r_hist.status_code}")

    # 10. Engine A: College Academic Regulations & Progression
    r_prog = client.get("/api/students/1/progression", headers=faculty_h)
    if r_prog.status_code == 200:
        prog_data = r_prog.json()
        log_result("Engine A: SIES GST Regulations", True,
                   f"Status: {prog_data.get('status')}, Eligible: {prog_data.get('eligible')}, Attendance Met: {prog_data.get('attendance_met')}")
    else:
        log_result("Engine A: SIES GST Regulations", False, f"HTTP {r_prog.status_code}")

    # 11. Credit Evaluation Engine
    r_cred = client.get("/api/credits/1", headers=faculty_h)
    if r_cred.status_code == 200:
        c_data = r_cred.json()
        log_result("Credit Evaluation Engine", True,
                   f"Earned: {c_data.get('earned')}, Expected: {c_data.get('expected')}, Completion: {c_data.get('completion_pct')}%, Deficit: {c_data.get('deficit')}")
    else:
        log_result("Credit Evaluation Engine", False, f"HTTP {r_cred.status_code}")

    # 12. Manual Academic Update
    patch_payload = {
        "term": "2024-SEM1",
        "attendance": 85.0,
        "marks": 78.0,
        "gpa": 7.6,
        "assignment_completion": 82.0,
        "failed_subjects": 0,
        "failed_heads": 0,
        "ese_failed_heads": 0,
        "backlog_credits": 0,
        "earned_credits": 28,
        "expected_credits": 30,
        "required_credits": 30,
    }
    r_patch = client.patch("/api/students/1/academic", json=patch_payload, headers=faculty_h)
    log_result("Manual Academic Update API", r_patch.status_code == 200,
               f"Updated attendance to 85%, marks to 78%, GPA to 7.6 (Status: {r_patch.status_code})")

    # 13. Interventions Workflow
    # A) List interventions
    r_ivs = client.get("/api/interventions", headers=mentor_h)
    iv_count = len(r_ivs.json()) if r_ivs.status_code == 200 else 0
    log_result("List Interventions", r_ivs.status_code == 200, f"Total Interventions: {iv_count}")

    # B) Create intervention
    new_iv_payload = {
        "student_id": 1,
        "type": "ATTENDANCE_PLAN",
        "reason": "Automated verification test action plan",
        "priority": "HIGH",
        "assigned_to": 2,
    }
    r_create_iv = client.post("/api/interventions", json=new_iv_payload, headers=mentor_h)
    created_iv_id = None
    if r_create_iv.status_code in (200, 201):
        created_iv_id = r_create_iv.json().get("id")
        log_result("Create Intervention", True, f"Created IV #{created_iv_id}")
    else:
        log_result("Create Intervention", False, f"HTTP {r_create_iv.status_code}: {r_create_iv.text}")

    # C) Update intervention status
    if created_iv_id:
        r_update_iv = client.patch(f"/api/interventions/{created_iv_id}", json={"status": "IN_PROGRESS", "note": "Student attended counseling"}, headers=mentor_h)
        log_result("Update Intervention Status", r_update_iv.status_code == 200, f"Status updated to IN_PROGRESS")

    # 14. Bulk CSV Upload Pipeline
    try:
        import os
        csv_path = "data/samples/demo_data.csv" if os.path.exists("data/samples/demo_data.csv") else "demo_data.csv"
        with open(csv_path, "rb") as f:
            files = {"file": ("demo_data.csv", f, "text/csv")}
            r_upload = client.post("/api/academic/upload", files=files, headers=faculty_h)
            log_result("Bulk CSV Upload Pipeline", r_upload.status_code == 200,
                       f"Result: {r_upload.json() if r_upload.status_code==200 else r_upload.text}")
    except Exception as e:
        log_result("Bulk CSV Upload Pipeline", False, str(e))

    # 15. Courses & Users Management
    r_courses = client.get("/api/courses", headers=admin_h)
    log_result("Courses Management", r_courses.status_code == 200, f"Courses Count: {len(r_courses.json()) if r_courses.status_code==200 else 0}")

    r_users = client.get("/api/users", headers=admin_h)
    log_result("User Management (Admin)", r_users.status_code == 200, f"Users Count: {len(r_users.json()) if r_users.status_code==200 else 0}")

    # 16. FEATURE 1: Proactive Early-Warning Velocity Radar
    r_vel = client.get("/api/risk/velocity-alerts", headers=mentor_h)
    if r_vel.status_code == 200:
        vel_alerts = r_vel.json()
        rapid_count = sum(1 for a in vel_alerts if a.get("trajectory") == "RAPID_DECLINE")
        log_result("FEATURE 1: Early-Warning Velocity Radar", True,
                   f"Total Alerts: {len(vel_alerts)}, Rapid Decline Detected: {rapid_count}, Top Urgency: {vel_alerts[0].get('urgency_score')}%")
    else:
        log_result("FEATURE 1: Early-Warning Velocity Radar", False, f"HTTP {r_vel.status_code}")

    # 17. FEATURE 2: AI Personalized Academic Recovery Engine & Outreach
    r_roadmap = client.post("/api/interventions/1/generate-roadmap", headers=mentor_h)
    if r_roadmap.status_code == 200:
        roadmap_data = r_roadmap.json()
        log_result("FEATURE 2: AI Recovery Roadmap Generator", True,
                   f"Engine: {roadmap_data.get('engine_type')}, Milestones: {len(roadmap_data.get('roadmap', []))} weeks, Priorities: {roadmap_data.get('primary_priorities')}")
    else:
        log_result("FEATURE 2: AI Recovery Roadmap Generator", False, f"HTTP {r_roadmap.status_code}")

    # 18. FEATURE 3: Credit Graduation Path Optimizer
    r_opt = client.get("/api/credits/1/optimized-path", headers=mentor_h)
    if r_opt.status_code == 200:
        opt_data = r_opt.json()
        log_result("FEATURE 3: Credit Graduation Path Optimizer", True,
                   f"Feasibility: {opt_data.get('feasibility')}, Degree Target: {opt_data.get('total_degree_credits')} cr, Planned Terms: {len(opt_data.get('semesters_plan', []))}")
    else:
        log_result("FEATURE 3: Credit Graduation Path Optimizer", False, f"HTTP {r_opt.status_code}")

    # Summary
    print("\n-------------------------------------------------------")
    total = len(report)
    passed = sum(1 for r in report if r["status"] == "PASS")
    print(f"AUDIT SUMMARY: {passed}/{total} checks PASSED ({(passed/total)*100:.1f}%)")
    print("-------------------------------------------------------\n")

if __name__ == "__main__":
    run_audit()

