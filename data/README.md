# Data Directory — AcademiQ SIES GST Academic EWS

## Overview
This folder contains sample and seed datasets for the AI Credit & Dropout Evaluation System. All data uses the **SIES GST Autonomous Academic Regulations (R19/R24)** mark pattern:

| Component | Max Marks | Pass Threshold |
|-----------|-----------|----------------|
| ISE (In-Semester) | 20 | — |
| MSE (Mid-Semester) | 20 | — |
| ESE (End-Semester) | 60 | 24 (40%) |
| Term Work (TW) | 25 | 10 (40%) |
| Practical/Oral (PR/OR) | 25 | 10 (40%) |
| **Aggregate Total** | **100** | **40%** |

## Files

### `seed_students.csv`
Comprehensive seed dataset with **32 student profiles** covering all system scenarios:

| Scenario | Count | Risk Level | Description |
|----------|-------|------------|-------------|
| Healthy/Exemplary | 8 | LOW | >90% attendance, GPA >7.0, no backlogs |
| At-Risk (Attendance) | 4 | MEDIUM | Below 75% O.6086 threshold |
| Backlog/Failed Heads | 5 | MEDIUM–HIGH | 3+ failed heads, ATKT concerns |
| Credit Deficit | 3 | MEDIUM | Below 70% credit completion |
| High-Risk/Critical | 4 | HIGH–CRITICAL | Multiple regulation violations |
| Progression Blocked | 3 | CRITICAL | FE gate, AICTE clock, or detention |
| DSE Students | 2 | MIXED | Direct Second Year entrants (N+2 = 5yr) |
| Grace Marks (O.5042) | 1 | MEDIUM | ESE marks between 22-24, grace applied |
| Definitive Detention | 2 | CRITICAL | Attendance below 50% |

### `samples/sample_academic_upload.csv`
Upload-ready CSV matching the `/api/academic/upload` endpoint schema. Contains 15 rows with required + optional columns. Use this to test the batch upload pipeline.

#### Required Columns
```
roll_no, branch, admission_year, current_year, semester, regulation,
attendance_percentage, gpa, ise_marks, mse_marks, ese_marks,
assignment_completion_percentage, earned_credits, expected_credits
```

#### Optional Columns
```
course_code, course_name, credits, failed_subjects, failed_heads,
ese_failed_heads, previous_backlogs, tw_marks, pr_or_marks,
is_dse, activity_points
```

## Usage

### Seed Demo Data (Database)
```bash
cd AI-Credit-Dropout
python scripts/seed_demo.py
```
This seeds the SQLite database with 30 students, academic records, risk scores, and interventions using the SIES GST mark structure.

### Upload Test Data (API)
Upload `samples/sample_academic_upload.csv` via:
- Admin → Uploads page → Upload CSV
- Or: `POST /api/academic/upload` with file attachment

## Regulation Reference
- **Ordinance 6086**: Minimum 75% attendance for ESE eligibility
- **ATKT Rule**: Max 8 failed heads (max 5 ESE theory) per year
- **FE All-Clear**: 100% FE subjects cleared for Sem 5 entry
- **SE All-Clear**: 100% SE subjects cleared for Sem 7 entry
- **AICTE N+2**: Max 6 years (4+2) regular / 5 years (3+2) DSE
- **O.5042**: Max 2 grace marks on ESE heads scoring 22-23/60
- **Activity Points**: 100 required (75 for DSE) for graduation
- **NCMC**: EVS & Constitution mandatory non-credit courses
