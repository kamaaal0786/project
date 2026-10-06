# AcademiQ — Project Handover & Upgrade Changelog
> **Purpose**: This document provides a complete, concise, and structured summary of all changes, architectural upgrades, and bug fixes implemented after taking over this codebase. It is formatted so that any AI assistant or developer can ingest it to immediately understand the entire system state, data models, and feature set.

---

## 📌 1. Executive Summary

* **Project Title**: **AcademiQ — AI-Based Credit & Dropout Evaluation and Prevention Platform**
* **Target Institution Framework**: **SIES Graduate School of Technology (SIES GST)**, Autonomous Regulations (**R19 / R24**).
* **Core Transformation**: The project was elevated from a basic predictive toy model (which merely flagged students as Low/Med/High risk) into a **2026-era Prescriptive Early-Intervention Platform** that actively simulates, calculates, and tracks student academic recovery.

---

## 🔍 2. Baseline Audit: What Was in the Original Codebase

When received from your peer, the project had:
1. **Basic Predictive Classifier**: A scikit-learn model trained on a generic public dataset with simple static feature inputs.
2. **Generic Dashboards**: Basic role authentication (Admin, Faculty, Mentor, Student) showing static tables.
3. **Crude Credit Subtraction**: Computed credit progress simply as $\text{deficit} = \text{expected} - \text{earned}$, without institutional prerequisites, ATKT rules, or capacity caps.
4. **Passive Interventions**: Static checklist tasks without tracking whether an intervention actually improved student performance.
5. **Multiple Technical Bugs & Inconsistencies**:
   - No semester bounds: students in Semester 3 displayed phantom "Semester 8" records.
   - Faulty marks ratios: internal MSE marks displayed as `23.7 / 20` (violating the 20-mark cap).
   - Duplicate database rows across multiple academic uploads.

---

## 🚀 3. Major Features & Enhancements Implemented

### A. 2026 Prescriptive "What-If" Counterfactual Recovery Simulator
* **Location**:
  - Backend: [`backend/app/risk/router.py`](file:///d:/AI-Credit-Dropout/backend/app/risk/router.py) (`POST /api/risk/{student_id}/simulate`)
  - Frontend: [`frontend/src/components/WhatIfSimulator.jsx`](file:///d:/AI-Credit-Dropout/frontend/src/components/WhatIfSimulator.jsx)
  - Pages: Integrated into `StudentRiskPage.jsx`, `StudentActionsPage.jsx`, and `MentorStudentDetailPage.jsx`
* **What it does**:
  - Moves beyond passive prediction to answer: *"What specific scores must this student achieve to drop out of the danger zone?"*
  - Interactive sliders for **Target Attendance (%)**, **Internal & Termwork Marks (%)**, **Lab Completion (%)**, and **Target ESE Theory Score (out of 60)**.
  - Dynamically recalculates predicted risk in real time, projecting risk delta:
    $$\Delta\text{Risk} = \text{Current Risk} - \text{Simulated Risk}$$
  - **Goal Commitment**: Mentors or students can lock in the simulated targets as a binding **Personalized Academic Recovery Contract**.

---

### B. SIES GST Autonomous Regulations & Remedial Calculator
* **Location**:
  - Curriculum Engine: [`backend/app/curriculum/sies_gst.py`](file:///d:/AI-Credit-Dropout/backend/app/curriculum/sies_gst.py)
  - Regulations Engine: [`backend/app/regulations/engine.py`](file:///d:/AI-Credit-Dropout/backend/app/regulations/engine.py)
  - Remedial API: [`backend/app/risk/router.py`](file:///d:/AI-Credit-Dropout/backend/app/risk/router.py) (`GET /api/risk/{student_id}/remedial-targets`)
  - Frontend Component: [`frontend/src/components/RemedialTargetsCard.jsx`](file:///d:/AI-Credit-Dropout/frontend/src/components/RemedialTargetsCard.jsx)
* **What it does**:
  - **Ordinance 6086 Enforcement**: Enforces the 75% attendance threshold, medical condonation zone ($50\% - 75\%$), and definitive detention ($< 50\%$).
  - **ATKT Cap Auditing**: Audits promotion eligibility (maximum 8 total failed heads, maximum 5 ESE heads allowed to keep term).
  - **Ordinance 5042 (Grace Marks)**: Evaluates automatic 1–2 grace marks for borderline $22/60$ or $23/60$ scores if total aggregate reaches 40%.
  - **Separate ESE Passing Head Rule ($24/60$)**: Under SIES GST Autonomous rules, students must score at least 40% in the End-Semester Exam ($24/60$). The system computes internal marks ($\text{ISE} + \text{MSE}$) and calculates the exact minimum ESE marks needed per subject.

---

### C. Proactive Early-Warning Velocity Radar
* **Location**:
  - Backend: [`backend/app/risk/velocity.py`](file:///d:/AI-Credit-Dropout/backend/app/risk/velocity.py) (`GET /api/risk/velocity-alerts`)
  - Frontend: [`frontend/src/components/VelocityRadar.jsx`](file:///d:/AI-Credit-Dropout/frontend/src/components/VelocityRadar.jsx)
* **What it does**:
  - Detects **silent downward momentum** before students cross official failure thresholds.
  - Computes first-order derivative trajectories ($\Delta\text{Attendance}/\Delta t$, $\Delta\text{Marks}/\Delta t$).
  - Flags students who appear "Medium Risk" on static averages but are rapidly plummeting across consecutive weeks, giving mentors 3–4 weeks of early-intervention lead time.

---

### D. Degree Graduation Credit Pathway Optimizer
* **Location**:
  - Backend: [`backend/app/credits/optimizer.py`](file:///d:/AI-Credit-Dropout/backend/app/credits/optimizer.py) (`GET /api/credits/{student_id}/optimizer`)
  - Frontend: [`frontend/src/components/CreditOptimizerTimeline.jsx`](file:///d:/AI-Credit-Dropout/frontend/src/components/CreditOptimizerTimeline.jsx)
* **What it does**:
  - Analyzes a student's earned credits vs. the 160-credit degree graduation requirement.
  - Generates a semester-by-semester clearance plan from the student's current semester up to Semester 8.
  - Constrains course allocations strictly to the college's **28 credits/semester maximum capacity cap** while prioritizing backlog clearance.

---

### E. Closed-Loop Efficacy Tracking ($\Delta\text{Risk}$) & AI Recovery Generator
* **Location**:
  - Backend: [`backend/app/interventions/recovery_generator.py`](file:///d:/AI-Credit-Dropout/backend/app/interventions/recovery_generator.py)
  - Models: Added `baseline_risk_prob`, `current_risk_prob`, `risk_delta`, `efficacy_status` columns to `interventions` table in [`backend/app/db/models.py`](file:///d:/AI-Credit-Dropout/backend/app/db/models.py).
  - Frontend: [`frontend/src/components/AIRecoveryRoadmap.jsx`](file:///d:/AI-Credit-Dropout/frontend/src/components/AIRecoveryRoadmap.jsx)
* **What it does**:
  - Records a baseline risk score when an intervention is opened.
  - Tracks post-intervention risk delta ($\Delta\text{Risk}$) to prove whether an assigned remedial action actually resolved the student's risk.
  - Generates an actionable 4-week recovery milestone roadmap and a pre-drafted 1-click mentor outreach message.

---

### F. Multi-Year SIES GST Autonomous Dataset & Seeding
* **Location**:
  - Data files in `data/`:
    - `sies_gst_courses_catalog.csv` (Curriculum courses across all semesters)
    - `sies_gst_student_course_results.csv` (77 KB of student exam results with ISE, MSE, ESE, TW, PR/OR)
    - `sies_gst_multiyear_academic_records.csv`
  - Seed Script: [`scripts/seed_sies_gst_curriculum.py`](file:///d:/AI-Credit-Dropout/scripts/seed_sies_gst_curriculum.py)

---

## 🐛 4. Critical Bug Fixes & Code Hardening

| Bug / Defect | Root Cause | Fix Applied |
| :--- | :--- | :--- |
| **Phantom "Semester 8" appeared for Semester 3 students** | Academic update route used `now.strftime('%Y-S%m')`. In August (month 08), this produced `2026-S08`, which regex parsed as Semester 8. | Purged phantom records. Replaced with `f"SEM{profile.semester or 1}"`. Hardened [`students/router.py`](file:///d:/AI-Credit-Dropout/backend/app/students/router.py) to reject records where $\text{sem} > \text{current\_sem}$. |
| **Out-of-bounds MSE Marks (`23.7 / 20`)** | Legacy mock data used a 20/30/50 split instead of SIES GST's 20/20/60 distribution, computing $79 \times 0.30 = 23.7$ out of 20. | Sanitized all 149 database records to statutory caps ($\text{ISE} \le 20$, $\text{MSE} \le 20$, $\text{ESE} \le 60$). Added defensive clamping in backend routers and frontend metric tiles. |
| **Database Duplication** | Multiple upload and test runs inserted duplicate academic terms for students. | Deduplicated progression queries by semester number; prioritized standard institutional records (`SEM1`, `SEM2`, `SEM3`). |
| **Stray Files & Root Clutter** | Temporary databases and 0-byte SQLite files lingered in root and `backend/`. | Removed 0-byte databases, deleted scratch scripts, and moved sample CSVs into `data/samples/`. |

---

## 🧪 5. Verification & Test Evidence

1. **Pytest Unit Test Suite**:
   - Command: `python -m pytest backend/tests`
   - Result: **34 passed, 0 failed** across `test_auth.py`, `test_credits.py`, `test_interventions.py`, `test_rbac.py`, `test_risk.py`, and `test_upload.py`.
2. **Frontend Production Build**:
   - Command: `npm run build` (in `frontend/`)
   - Result: **Compiled successfully** with Vite (0 errors, 2,467 modules transformed).
3. **Live Multi-Role End-to-End API Audit**:
   - Verified active authentication, dashboards, and features across all 4 roles:
     - **Admin** (`admin@college.edu`): 45 users, 44 courses, system metrics verified.
     - **Mentor** (`mentor1@college.edu`): Assigned mentees, Velocity Radar, Remedial Targets, and What-If Simulator verified.
     - **Faculty** (`faculty1@college.edu`): Course rosters, mark entry, and student dossiers verified.
     - **Student** (`student001@college.edu`): Credit audit, Degree Pathway Optimizer, and What-If Simulator verified.
   - Result: **100% healthy, all endpoints returning 200 OK with clean, bounded data**.

---

## 🔑 6. Demo Credentials (For Quick Testing)

Standard Password for all pre-seeded accounts: **`Demo@1234`**

| Role | Email | Best Screen to Demo |
| :--- | :--- | :--- |
| **Admin** | `admin@college.edu` | Admin Dashboard, Course Management, Bulk Uploads |
| **Mentor** | `mentor1@college.edu` | Velocity Radar, Student Dossier, What-If Recovery Simulator |
| **Faculty** | `faculty1@college.edu` | Assigned Students, Mark Breakdown Entry (ISE/MSE/ESE/TW/PR) |
| **Student** | `student001@college.edu` | Personal Risk Dossier, Graduation Pathway Optimizer, Actions Roadmap |
