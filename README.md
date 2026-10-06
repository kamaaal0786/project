# AcademiQ — AI-Based Credit & Dropout Evaluation System
### *Autonomous Academic Governance, Credit Pathway Optimization & Early-Intervention Platform*

**SIES Graduate School of Technology (SIES GST) · Autonomous Regulation Framework (R19)**

---

## 📌 Executive Summary

**AcademiQ** is a production-grade academic management, credit evaluation, and early-warning dropout intervention platform engineered for colleges and autonomous universities. 

Unlike generic dashboard templates, AcademiQ is architected around real institutional regulations and academic decision-making:
- **Engine A (SIES GST Autonomous Regulations)**: Enforces hard college rules, including the mandatory 75% attendance threshold, ATKT (Allowed To Keep Term) caps (max 8 failed heads, max 5 ESE heads), and promotion blocks.
- **Engine B (ML Dropout Propensity & SHAP Explainability)**: Scikit-learn Random Forest model trained on multi-term academic and behavioral signals with local feature attributions explaining *why* a student is at risk.
- **Engine C (Credit Audit & Evaluation)**: Real-time credit progress tracking, deficit gaps, and semester-by-semester clearance accounting towards 160-credit degree graduation.

---

## 🚀 Innovative Differentiating Features

### 1. 📡 Proactive Early-Warning Velocity Radar
- **Automated Rate-of-Change Trajectory Detector**: Instead of waiting for a student to fail an exam or cross the 75% attendance threshold at the end of the semester, the velocity radar computes first-order derivative trajectories ($\Delta \text{Attendance} / \Delta t$ and $\Delta \text{Marks} / \Delta t$).
- **Silent At-Risk Detection**: Flags students who appear "Medium Risk" on static thresholds but are declining rapidly across consecutive weeks, giving mentors weeks of lead time before academic probation.

### 2. 🤖 AI-Generated Personalized Recovery Roadmap & Mentor Outreach
- **Automated 4-Week Milestone Plans**: Generates structured, week-by-week recovery milestones tailored specifically to the student's credit deficits, failed subject heads, and attendance gaps.
- **1-Click Mentor Outreach Draft**: Produces a ready-to-send, professional communication template with student name, specific deficit data, and scheduled counseling times.
- **Direct Database Commitment**: Mentors can commit generated recovery plans straight into the college's official intervention tracking table with one click.

### 3. 🎯 Credit Graduation Path Optimizer
- **Curriculum Prerequisite & Capacity Solver**: Maps out an exact semester-by-semester clearance schedule from current semester up to Semester 8.
- **Regulation Capacity Cap**: Ensures remedial loads never exceed the university's 28 credits/semester maximum while clearing backlogs as early as possible.
- **Feasibility Tagging**: Explicitly indicates whether on-time graduation by Semester 8 is mathematically feasible or if a remedial summer term is advised.

### 4. 🔮 Prescriptive "What-If" Counterfactual Simulator & Closed-Loop Efficacy
- **Real-Time Risk Re-Simulation**: Instead of passive risk warnings, students and mentors can adjust sliders for Target Attendance, Internal Marks, Lab Completion, and ESE Theory Exam score to see simulated dropout risk drop in real time.
- **SIES GST 24/60 Passing Rule**: Computes exact minimum End-Semester Exam scores needed per course to clear separate passing heads.
- **Closed-Loop Efficacy ($\Delta\text{Risk}$)**: Tracks baseline risk vs. post-intervention risk to evaluate whether recovery plans succeed.

> 📖 **Handover Documentation**: For the detailed changelog and peer-to-peer technical breakdown, see [HANDOVER_CHANGELOG.md](file:///d:/AI-Credit-Dropout/HANDOVER_CHANGELOG.md).

---

## 🏛️ System Architecture & Technology Stack

| Layer | Technologies Used | Description |
| :--- | :--- | :--- |
| **Backend Core** | FastAPI, Python 3.13, Pydantic V2 | Async REST API with role-based JWT auth and automatic OpenAPI documentation. |
| **Database** | SQLite (`mini_proj.db`), SQLAlchemy ORM | Local relational database with student profiles, marksheets, credits, and interventions. |
| **Machine Learning** | Scikit-learn, Random Forest, SHAP | Dropout prediction model with explainability factors. |
| **Frontend UI** | React 18, Vite, TailwindCSS (v4), Lucide Icons | Institutional university ERP light theme, responsive data tables, and tabs. |

---

## 🔑 Demo Access Credentials

All pre-seeded demo accounts use the standard password: `Demo@1234`

| Role | Email Address | Access Permissions |
| :--- | :--- | :--- |
| **Administrator** | `admin@college.edu` | Master student directory, faculty assignments, system analytics, user management. |
| **Faculty Mentor** | `mentor1@college.edu` | Assigned mentee rosters, velocity radar alerts, student dossiers, intervention tracking. |
| **Course Faculty** | `faculty1@college.edu` | Course enrollment lists, gradebook updates, bulk CSV mark imports. |
| **Student** | `student001@college.edu` | Personal academic dossier, credit audit, degree pathway optimizer, recovery roadmap. |

---

## 📂 Project Directory Structure

```text
AI-Credit-Dropout/
├── backend/                  # FastAPI Application Core
│   ├── app/
│   │   ├── auth/             # JWT authentication, password hashing & RBAC dependencies
│   │   ├── credits/          # Credit calculation engine & Graduation Path Optimizer
│   │   ├── dashboard/        # Role-filtered KPI summaries & academic decision metrics
│   │   ├── db/               # SQLAlchemy models & database connection setup
│   │   ├── interventions/    # Intervention tracking & AI Academic Recovery Generator
│   │   ├── regulations/      # SIES GST Autonomous R19 progression & ATKT rules
│   │   ├── risk/             # ML inference, SHAP explanations & Velocity Radar engine
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   └── students/         # Student dossier builder with marksheets & course results
│   ├── requirements.txt      # Backend Python dependencies
│   └── tests/                # Pytest automated test suite (33 test cases)
├── frontend/                 # React + Vite User Interface
│   ├── src/
│   │   ├── components/       # Layout shell, VelocityRadar, AIRecoveryRoadmap, CreditOptimizer
│   │   ├── pages/            # Admin, Faculty, Mentor, and Student role pages
│   │   ├── services/         # Axios API client, auth service, and data hooks
│   │   ├── index.css         # Institutional ERP light theme design tokens
│   │   └── App.jsx           # Role-protected React Router tree
│   └── package.json          # Frontend dependencies & Vite scripts
├── data/
│   ├── public/               # Raw training dataset
│   └── samples/              # Sample CSV import templates for bulk marks upload
├── ml/                       # Trained Scikit-learn model artifacts (`.pkl`, scaler)
├── scripts/
│   ├── seed_demo.py          # Database seeding script for demo students & faculty
│   └── test_live_system.py   # Comprehensive live system audit test script (27 checks)
├── mini_proj.db              # Active local SQLite database
├── requirements.txt          # Root Python environment requirements
└── README.md                 # Institutional documentation (this file)
```

---

## ⚡ Quick Start Guide

### 1. Backend Setup
```bash
# Activate Python virtual environment
.\venv\Scripts\Activate.ps1

# Install requirements
pip install -r backend/requirements.txt

# Start FastAPI server
cd backend
uvicorn app.main:app --reload --port 8000
```
Backend API will be running at: `http://localhost:8000` (API Docs at `http://localhost:8000/docs`).

### 2. Frontend Setup
```bash
# Open a new terminal
cd frontend

# Install npm packages
npm install

# Start Vite development server
npm run dev
```
Frontend will be running at: `http://localhost:5173`.

### 3. Run Automated System Audits
```bash
# Run backend pytest suite (33 tests)
.\venv\Scripts\python.exe -m pytest backend/tests

# Run live end-to-end system audit (27 checks)
.\venv\Scripts\python.exe scripts/test_live_system.py
```
