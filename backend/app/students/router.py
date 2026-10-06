"""
Students router - role-filtered list/detail + admin creation.
SDK Section 5: GET /api/students, GET /api/students/{id}, POST /api/students
SDK Section 14: Least-privilege rules enforced at query level.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from passlib.context import CryptContext
from typing import List, Optional

from app.db.base import get_db
from app.db.models import (
    User, StudentProfile, StudentFaculty, UserRole, RiskHistory, AcademicRecord
)
from app.schemas.students import StudentCreate, StudentDetailResponse, StudentListItem
from app.auth.dependencies import get_current_user, require_role

router = APIRouter(prefix="/api/students", tags=["students"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _calc_grade(total: float, max_marks: float = 100.0, is_failed: bool = False) -> str:
    """Official SIES GST Autonomous 10-point Grading Scale (AIDS Gazette Reference)."""
    from app.curriculum.sies_gst import calculate_sies_grade_and_point
    grade, _ = calculate_sies_grade_and_point(total, max_marks, is_failed)
    return grade


def _get_latest_risk_level(student_id: int, db: Session) -> str | None:
    """Fetch the most recent risk level for a student."""
    from sqlalchemy import desc as _desc
    row = (
        db.query(RiskHistory)
        .filter(RiskHistory.student_id == student_id)
        .order_by(_desc(RiskHistory.calculated_at))
        .first()
    )
    return row.risk_level.value.upper() if row else None


def _parse_term_info(term_str: str) -> tuple[int, str, str]:
    """
    Parses terms like 'SEM1', 'Semester 2', '2024-SEM1', '2026-S08', '2-S3'.
    Returns: (semester_number, display_title, subtitle)
    e.g. '2024-SEM1' -> (1, 'Semester 1', 'AY 2024-25')
    """
    import re
    s = str(term_str or '').strip()

    year_match = re.search(r'\b(20\d\d)\b', s)
    subtitle = f"AY {year_match.group(1)}-{int(year_match.group(1)[2:]) + 1:02d}" if year_match else ""

    m = re.search(r'(?:SEM|SEMESTER)\s*0?(\d+)', s, re.IGNORECASE)
    if not m:
        m = re.search(r'S0?(\d+)', s, re.IGNORECASE)
    if not m:
        digits = re.findall(r'\b\d{1,2}\b', s)
        sem_num = int(digits[-1]) if digits else 1
    else:
        sem_num = int(m.group(1))

    if sem_num > 8:
        sem_num = int(str(sem_num)[-1]) or 1

    display_title = f"Semester {sem_num}"
    if not subtitle:
        subtitle = f"Term {sem_num}"

    return sem_num, display_title, subtitle


def get_active_academic_record(student_id: int, db: Session) -> Optional[AcademicRecord]:
    """
    Uniform resolver for a student's active academic record.
    Guarantees that StudentDetail, Risk Inference, and Regulation Audits always evaluate
    the exact same active semester academic data.
    """
    from app.db.models import AcademicRecord
    profile = db.query(StudentProfile).filter(StudentProfile.student_id == student_id).first()
    if not profile:
        return None
    max_allowed_sem = profile.semester or 8
    all_acads = (
        db.query(AcademicRecord)
        .filter(AcademicRecord.student_id == student_id)
        .order_by(AcademicRecord.recorded_at.asc(), AcademicRecord.id.asc())
        .all()
    )
    if not all_acads:
        return None
    deduped = {}
    for a in all_acads:
        sem_num, _, _ = _parse_term_info(a.term)
        if sem_num > max_allowed_sem:
            continue
        is_clean = str(a.term).startswith("SEM") or str(a.term).startswith("Semester")
        if sem_num not in deduped:
            deduped[sem_num] = (is_clean, a.id, a)
        else:
            prev_clean, prev_id, _ = deduped[sem_num]
            if (is_clean and not prev_clean) or (is_clean == prev_clean and a.id > prev_id):
                deduped[sem_num] = (is_clean, a.id, a)
    if deduped:
        return deduped[max(deduped.keys())][2]
    return all_acads[-1]


def _build_student_detail(user: User, profile: StudentProfile, db: Session = None) -> dict:
    branch = profile.branch
    if not branch and profile.program:
        b_map = {
            "B.Tech CS": "Computer Science",
            "B.Tech ME": "Mechanical Engineering",
            "B.Tech ECE": "Electronics & Telecom",
        }
        branch = b_map.get(profile.program, profile.program.replace("B.Tech ", ""))

    curr_year = profile.current_year or ((profile.semester + 1) // 2 if profile.semester else 1)
    adm_year = profile.admission_year or (2024 - (curr_year - 1))
    regulation = profile.regulation or "R19"

    res = {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
        "status": user.status.value,
        "student_id": profile.student_id,
        "roll_no": profile.roll_no,
        "program": profile.program,
        "semester": profile.semester,
        "mentor_id": profile.mentor_id,
        "is_demo": profile.is_demo,
        "latest_risk_level": _get_latest_risk_level(profile.student_id, db) if db else None,
        "branch": branch,
        "admission_year": adm_year,
        "current_year": curr_year,
        "regulation": regulation,
        "academic_status": profile.academic_status or "CLEAR",
        "is_dse": getattr(profile, "is_dse", False) or False,
        "activity_points": getattr(profile, "activity_points", 85) or 85,
        "ncmc_cleared": getattr(profile, "ncmc_cleared", True) if getattr(profile, "ncmc_cleared", None) is not None else True,
    }
    
    # Add latest academic record if we have a db session
    if db:
        from app.db.models import AcademicRecord
        from sqlalchemy import desc
        from app.curriculum.sies_gst import get_curriculum_for_semester

        all_acads = (
            db.query(AcademicRecord)
            .filter(AcademicRecord.student_id == profile.student_id)
            .order_by(AcademicRecord.recorded_at.asc(), AcademicRecord.id.asc())
            .all()
        )
        
        deduped = {}
        max_allowed_sem = profile.semester or 8
        for a in all_acads:
            sem_num, disp_title, sub_title = _parse_term_info(a.term)
            
            # Guard: A student currently in Semester S cannot display records for Semester > S
            if sem_num > max_allowed_sem:
                continue

            mrk = a.marks
            ise = a.ise_marks if a.ise_marks is not None else (round(mrk * 0.2, 1) if mrk is not None else None)
            mse = a.mse_marks if a.mse_marks is not None else (round(mrk * 0.2, 1) if mrk is not None else None)
            ese = a.ese_marks if a.ese_marks is not None else (round(mrk * 0.6, 1) if mrk is not None else None)
            tw = a.tw_marks
            pr_or = a.pr_or_marks

            # SIES GST statutory maximum limits clamping (ISE<=20, MSE<=20, ESE<=60, TW<=25, PR<=25)
            if ise is not None: ise = round(min(20.0, max(0.0, float(ise))), 1)
            if mse is not None: mse = round(min(20.0, max(0.0, float(mse))), 1)
            if ese is not None: ese = round(min(60.0, max(0.0, float(ese))), 1)
            if tw is not None: tw = round(min(25.0, max(0.0, float(tw))), 1)
            if pr_or is not None: pr_or = round(min(25.0, max(0.0, float(pr_or))), 1)

            rec_dict = {
                "id": a.id,
                "term": disp_title,
                "raw_term": a.term,
                "term_label": disp_title,
                "term_subtitle": sub_title,
                "semester": sem_num,
                "attendance": a.attendance,
                "attendance_pct": a.attendance,
                "marks": a.marks,
                "gpa": a.gpa,
                "sgpa": a.gpa,
                "assignment_completion": a.assignment_completion,
                "failed_subjects": a.failed_subjects or 0,
                "ise_marks": ise,
                "mse_marks": mse,
                "ese_marks": ese,
                "tw_marks": tw,
                "pr_or_marks": pr_or,
                "grace_marks": getattr(a, "grace_marks", 0.0) or 0.0,
                "ordinance_applied": getattr(a, "ordinance_applied", None),
                "failed_heads": a.failed_heads or 0,
                "ese_failed_heads": a.ese_failed_heads or 0,
                "backlog_credits": a.backlog_credits or 0,
                "previous_backlogs": a.previous_backlogs or 0,
                "previous_failed_heads": a.previous_failed_heads or 0,
                "recorded_at": a.recorded_at.isoformat() if a.recorded_at else None,
            }

            # Prioritize clean standard terms (e.g. SEM1) and more recent records
            is_clean = str(a.term).startswith("SEM") or str(a.term).startswith("Semester")
            if sem_num not in deduped:
                deduped[sem_num] = (is_clean, a.id, rec_dict, a)
            else:
                prev_clean, prev_id, _, _ = deduped[sem_num]
                if (is_clean and not prev_clean) or (is_clean == prev_clean and a.id > prev_id):
                    deduped[sem_num] = (is_clean, a.id, rec_dict, a)

        academic_records = [deduped[k][2] for k in sorted(deduped.keys())]
        res["academic_records"] = academic_records
        if academic_records:
            res["latest_academic_record"] = academic_records[-1]
            latest_acad = deduped[max(deduped.keys())][3]
        else:
            latest_acad = None

        from app.db.models import CourseResult
        crs_raw = (
            db.query(CourseResult)
            .filter(
                CourseResult.student_id == profile.student_id,
                CourseResult.semester <= max_allowed_sem
            )
            .order_by(CourseResult.semester.asc(), CourseResult.recorded_at.desc(), CourseResult.id.desc())
            .all()
        )
        seen_keys = set()
        crs = []
        for c in crs_raw:
            key = (c.semester, c.course_code)
            if key not in seen_keys:
                seen_keys.add(key)
                crs.append(c)
        crs.sort(key=lambda x: (x.semester, x.course_code))
        
        if crs:
            res["course_results"] = [
                {
                    "course_code": c.course_code,
                    "course_name": c.course_name,
                    "semester": c.semester,
                    "credits": c.credits or 3,
                    "ise_marks": min(20.0, max(0.0, float(c.ise_marks))) if c.ise_marks is not None else None,
                    "mse_marks": min(20.0, max(0.0, float(c.mse_marks))) if c.mse_marks is not None else None,
                    "ese_marks": min(60.0, max(0.0, float(c.ese_marks))) if c.ese_marks is not None else None,
                    "tw_marks": min(25.0, max(0.0, float(c.tw_marks))) if c.tw_marks is not None else None,
                    "pr_or_marks": min(25.0, max(0.0, float(c.pr_or_marks))) if c.pr_or_marks is not None else None,
                    "grace_marks": getattr(c, "grace_marks", 0.0) or 0.0,
                    "ordinance_applied": getattr(c, "ordinance_applied", None),
                    "total_marks": min(100.0, c.total_marks if c.total_marks is not None else round((c.ise_marks or 0) + (c.mse_marks or 0) + (c.ese_marks or 0), 1)),
                    "grade": c.grade or _calc_grade(c.total_marks or ((c.ise_marks or 0) + (c.mse_marks or 0) + (c.ese_marks or 0)), is_failed=bool(c.is_failed)),
                    "grade_point": c.grade_point if getattr(c, "grade_point", None) is not None else calculate_sies_grade_and_point(c.total_marks or ((c.ise_marks or 0) + (c.mse_marks or 0) + (c.ese_marks or 0)), 100.0, is_failed=bool(c.is_failed))[1],
                    "attendance": c.attendance_percentage or (latest_acad.attendance if latest_acad else 80),
                    "is_failed": bool(c.is_failed),
                    "is_ese_failed": bool(c.is_ese_failed),
                }
                for c in crs
            ]
        elif latest_acad:
            # Generate curriculum subjects matching SIES GST autonomous pattern for student's semester
            sem = profile.semester or 1
            curr_subjects = get_curriculum_for_semester(sem)
            ise_base = min(20.0, max(0.0, latest_acad.ise_marks if latest_acad.ise_marks is not None else (round(latest_acad.marks * 0.2, 1) if latest_acad.marks else 14)))
            mse_base = min(20.0, max(0.0, latest_acad.mse_marks if latest_acad.mse_marks is not None else (round(latest_acad.marks * 0.2, 1) if latest_acad.marks else 14)))
            ese_base = min(60.0, max(0.0, latest_acad.ese_marks if latest_acad.ese_marks is not None else (round(latest_acad.marks * 0.6, 1) if latest_acad.marks else 42)))

            results = []
            factors = [0.95, 0.90, 1.05, 0.98, 1.10, 1.0]
            for idx, item in enumerate(curr_subjects):
                factor = factors[idx % len(factors)]
                ise = min(20.0, max(0.0, round(ise_base * factor, 1)))
                mse = min(20.0, max(0.0, round(mse_base * factor, 1)))
                ese_raw = min(60.0, max(0.0, round(ese_base * factor, 1)))
                tw = min(float(item.get("tw", 25)), max(0.0, round(21.0 * factor, 1))) if item.get("tw") else None
                pr_or = min(float(item.get("pr_or", 25)), max(0.0, round(22.0 * factor, 1))) if item.get("pr_or") else None
                
                # Check Ordinance 5042 Grace Marks
                grace = 0.0
                ordinance = None
                ese = ese_raw
                if 22.0 <= ese_raw < 24.0:
                    grace = round(24.0 - ese_raw, 1)
                    ese = 24.0
                    ordinance = "O.5042 (Grace)"

                total = round(ise + mse + ese, 1)
                is_failed = ese < 24.0 or total < 40.0
                from app.curriculum.sies_gst import calculate_sies_grade_and_point
                grade, grade_pt = calculate_sies_grade_and_point(total, 100.0, is_failed=is_failed)
                
                results.append({
                    "course_code": item["code"],
                    "course_name": item["name"],
                    "semester": sem,
                    "credits": item["credits"],
                    "ise_marks": ise,
                    "mse_marks": mse,
                    "ese_marks": ese,
                    "tw_marks": tw,
                    "pr_or_marks": pr_or,
                    "grace_marks": grace,
                    "ordinance_applied": ordinance,
                    "total_marks": total,
                    "grade": grade,
                    "grade_point": grade_pt,
                    "attendance": round(min(100.0, max(40.0, (latest_acad.attendance or 80.0) * (0.95 + 0.1 * factor))), 1),
                    "is_failed": is_failed,
                    "is_ese_failed": ese < 24.0,
                })
            res["course_results"] = results

        # Run comprehensive SIES GST progression and compliance audit
        try:
            from app.regulations.engine import evaluate_progression
            res["sies_gst_audit"] = evaluate_progression(profile.student_id, db, regulation)
        except Exception:
            pass
            
    return res


@router.get("", response_model=List[StudentDetailResponse])
def list_students(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Role-filtered student list (SDK Section 14):
    - admin  -> all students
    - faculty -> students assigned to this faculty in StudentFaculty
    - mentor -> students whose mentor_id == current_user.id
    - student -> only themselves
    """
    role = current_user.role

    if role == UserRole.admin:
        profiles = (
            db.query(StudentProfile)
            .options(joinedload(StudentProfile.user))
            .offset(skip).limit(limit).all()
        )
    elif role == UserRole.faculty:
        # Students in any course taught by this faculty
        student_ids = (
            db.query(StudentFaculty.student_id)
            .filter(StudentFaculty.faculty_id == current_user.id)
            .distinct()
            .all()
        )
        ids = [r[0] for r in student_ids]
        profiles = (
            db.query(StudentProfile)
            .options(joinedload(StudentProfile.user))
            .filter(StudentProfile.student_id.in_(ids))
            .all()
        )
    elif role == UserRole.mentor:
        profiles = (
            db.query(StudentProfile)
            .options(joinedload(StudentProfile.user))
            .filter(StudentProfile.mentor_id == current_user.id)
            .all()
        )
    else:
        # Student: only self
        profiles = (
            db.query(StudentProfile)
            .options(joinedload(StudentProfile.user))
            .filter(StudentProfile.user_id == current_user.id)
            .all()
        )

    result = []
    for profile in profiles:
        if profile.user:
            result.append(_build_student_detail(profile.user, profile, db))
    return result


@router.get("/me", response_model=StudentDetailResponse)
def get_student_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Convenience endpoint returning the current student's full profile and marks."""
    profile = (
        db.query(StudentProfile)
        .options(joinedload(StudentProfile.user))
        .filter(StudentProfile.user_id == current_user.id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Student profile not found for current user")
    return _build_student_detail(current_user, profile, db)


@router.get("/{student_id}", response_model=StudentDetailResponse)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get a single student's detail.
    Enforces least-privilege: students can only fetch their own record.
    """
    profile = (
        db.query(StudentProfile)
        .options(joinedload(StudentProfile.user))
        .filter(StudentProfile.student_id == student_id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Student not found")

    role = current_user.role

    # Enforce access control
    if role == UserRole.student:
        if profile.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif role == UserRole.mentor:
        if profile.mentor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif role == UserRole.faculty:
        assigned = (
            db.query(StudentFaculty)
            .filter(
                StudentFaculty.student_id == student_id,
                StudentFaculty.faculty_id == current_user.id,
            )
            .first()
        )
        if not assigned:
            raise HTTPException(status_code=403, detail="Access denied")
    # admin: always allowed

    return _build_student_detail(profile.user, profile, db)


@router.post("", response_model=StudentDetailResponse, status_code=status.HTTP_201_CREATED)
def create_student(
    payload: StudentCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.admin)),
):
    """Create a new student (User + StudentProfile). Admin only."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    roll_exists = db.query(StudentProfile).filter(
        StudentProfile.roll_no == payload.roll_no
    ).first()
    if roll_exists:
        raise HTTPException(status_code=409, detail="Roll number already exists")

    if payload.mentor_id:
        mentor = db.query(User).filter(
            User.id == payload.mentor_id, User.role == UserRole.mentor
        ).first()
        if not mentor:
            raise HTTPException(status_code=404, detail="Mentor not found")

    user = User(
        email=payload.email,
        name=payload.name,
        password_hash=pwd_context.hash(payload.password),
        role=UserRole.student,
        status="active",
    )
    db.add(user)
    db.flush()  # get user.id

    profile = StudentProfile(
        user_id=user.id,
        roll_no=payload.roll_no,
        program=payload.program,
        semester=payload.semester,
        mentor_id=payload.mentor_id,
        is_demo=payload.is_demo,
        branch=payload.branch,
        admission_year=payload.admission_year,
        current_year=payload.current_year,
        regulation=payload.regulation,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    db.refresh(user)

    return _build_student_detail(user, profile, db)
