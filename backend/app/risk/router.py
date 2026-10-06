"""
Risk router - POST predict, GET current/history/explanation.
"""
from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.base import get_db
from app.db.models import (
    User, StudentProfile, AcademicRecord, CreditRecord,
    RiskHistory, RiskLevel, UserRole, Intervention, InterventionStatus,
    InterventionPriority, InterventionType, StudentSimulation, CourseResult
)
from app.auth.dependencies import get_current_user
from app.risk.inference import ModelService

router = APIRouter(prefix='/api/risk', tags=['risk'])


def _get_student_profile(student_id: int, db: Session) -> StudentProfile:
    profile = db.query(StudentProfile).filter(
        StudentProfile.student_id == student_id
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail='Student not found')
    return profile


def _check_access(profile: StudentProfile, current_user: User):
    """Students can only see their own risk."""
    if current_user.role == UserRole.student:
        if profile.user_id != current_user.id:
            raise HTTPException(status_code=403, detail='Access denied')


def _latest_academic(student_id: int, db: Session) -> Optional[AcademicRecord]:
    from app.students.router import get_active_academic_record
    return get_active_academic_record(student_id, db)


def _latest_credit(student_id: int, db: Session) -> Optional[CreditRecord]:
    return (
        db.query(CreditRecord)
        .filter(CreditRecord.student_id == student_id)
        .order_by(desc(CreditRecord.id))
        .first()
    )


def _build_feature_dict(academic: Optional[AcademicRecord], credit: Optional[CreditRecord]) -> dict:
    """Map DB records to the feature dict the inference service expects."""
    if not academic:
        return {}
    
    return {
        'attendance': float(academic.attendance) if academic.attendance is not None else 100.0,
        'attendance_percentage': float(academic.attendance) if academic.attendance is not None else 100.0,
        'marks': float(academic.marks) if academic.marks is not None else 50.0,
        'gpa': float(academic.gpa) if academic.gpa is not None else 10.0,
        'assignment_completion': float(academic.assignment_completion) if academic.assignment_completion is not None else 100.0,
        'assignment_completion_percentage': float(academic.assignment_completion) if academic.assignment_completion is not None else 100.0,
        'failed_subjects': int(academic.failed_subjects) if academic.failed_subjects is not None else 0,
        'failed_heads': int(academic.failed_heads) if getattr(academic, 'failed_heads', None) is not None else 0,
        'ese_failed_heads': int(academic.ese_failed_heads) if getattr(academic, 'ese_failed_heads', None) is not None else 0,
        'previous_backlogs': int(academic.previous_backlogs) if getattr(academic, 'previous_backlogs', None) is not None else 0,
        'earned_credits': float(credit.earned_credits) if credit and credit.earned_credits is not None else 0.0,
        'expected_credits': float(credit.expected_credits) if credit and credit.expected_credits is not None else 0.0,
        'backlog_credits': float(credit.backlog_credits) if credit and credit.backlog_credits is not None else 0.0,
    }


def _intervention_adjustment(student_id: int, db: Session) -> tuple[float, int]:
    """
    Reduce risk probability for each recently-completed intervention.
    Rationale: a completed intervention means support was delivered -
    that genuinely reduces dropout likelihood.

    Returns (reduction_fraction, completed_count).
    Each completed intervention in the last 60 days -> 8% reduction,
    capped at 30% total.
    """
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=60)

    completed = (
        db.query(Intervention)
        .filter(
            Intervention.student_id == student_id,
            Intervention.status == InterventionStatus.completed,
            Intervention.created_at >= cutoff,
        )
        .count()
    )
    reduction = min(completed * 0.08, 0.30)
    return reduction, completed


@router.post('/{student_id}/predict')
def predict_risk(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run inference for a student and append a new RiskHistory row."""
    profile  = _get_student_profile(student_id, db)
    _check_access(profile, current_user)

    academic = _latest_academic(student_id, db)
    credit   = _latest_credit(student_id, db)
    features = _build_feature_dict(academic, credit)

    svc    = ModelService.get()
    result = svc.predict(features)

    # Apply intervention adjustment - completed plans reduce risk
    adj_reduction, completed_count = _intervention_adjustment(student_id, db)
    raw_prob     = result['risk_probability']
    adj_prob     = round(max(raw_prob - (raw_prob * adj_reduction), 0.03), 4)

    # Recompute level from adjusted probability
    adj_level = ModelService._level(adj_prob)

    level_map = {
        'LOW': RiskLevel.low, 
        'MEDIUM': RiskLevel.medium, 
        'HIGH': RiskLevel.high,
        'CRITICAL': RiskLevel.critical
    }
    
    snapshot = RiskHistory(
        student_id=student_id,
        probability=adj_prob,
        risk_level=level_map[adj_level],
        model_version=result['model_version'],
        calculated_at=datetime.now(timezone.utc),
        risk_type='ML'
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)

    response = {
        'student_id':         student_id,
        'risk_probability':   adj_prob,
        'risk_level':         adj_level,
        'model_version':      result['model_version'],
        'calculated_at':      snapshot.calculated_at.isoformat(),
    }
    if completed_count > 0:
        response['intervention_note'] = (
            f'{completed_count} completed intervention(s) reduced risk by '
            f'{round(adj_reduction * 100)}% '
            f'(raw: {round(raw_prob * 100)}% -> adjusted: {round(adj_prob * 100)}%)'
        )
    return response


@router.get('/{student_id}/current')
def get_current_risk(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the most recent RiskHistory record for a student, ensuring it reflects current academic state."""
    profile = _get_student_profile(student_id, db)
    _check_access(profile, current_user)

    academic = _latest_academic(student_id, db)
    credit   = _latest_credit(student_id, db)
    features = _build_feature_dict(academic, credit)

    svc = ModelService.get()
    fresh_res = svc.predict(features)
    adj_reduction, _ = _intervention_adjustment(student_id, db)
    raw_prob = fresh_res['risk_probability']
    adj_prob = round(max(raw_prob - (raw_prob * adj_reduction), 0.03), 4)

    latest = (
        db.query(RiskHistory)
        .filter(RiskHistory.student_id == student_id, RiskHistory.risk_type == 'ML')
        .order_by(desc(RiskHistory.calculated_at), desc(RiskHistory.id))
        .first()
    )
    if not latest:
        # Fallback to older records without risk_type
        latest = (
            db.query(RiskHistory)
            .filter(RiskHistory.student_id == student_id)
            .order_by(desc(RiskHistory.calculated_at), desc(RiskHistory.id))
            .first()
        )

    # Auto-synchronize if snapshot missing or out of sync with current academic data
    if not latest or abs(float(latest.probability) - adj_prob) > 0.05:
        adj_level = ModelService._level(adj_prob)
        level_map = {
            'LOW': RiskLevel.low,
            'MEDIUM': RiskLevel.medium,
            'HIGH': RiskLevel.high,
            'CRITICAL': RiskLevel.critical,
        }
        latest = RiskHistory(
            student_id=student_id,
            probability=adj_prob,
            risk_level=level_map[adj_level],
            model_version=fresh_res['model_version'],
            risk_type='ML',
            calculated_at=datetime.now(timezone.utc),
        )
        db.add(latest)
        db.commit()
        db.refresh(latest)

    return {
        'student_id':       student_id,
        'risk_probability': float(latest.probability),
        'risk_level':       latest.risk_level.value,
        'model_version':    latest.model_version,
        'calculated_at':    latest.calculated_at.isoformat() if latest.calculated_at else None,
    }


@router.get('/{student_id}/history')
def get_risk_history(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all risk snapshots ordered oldest->newest (for trend charts)."""
    profile = _get_student_profile(student_id, db)
    _check_access(profile, current_user)

    rows = (
        db.query(RiskHistory)
        .filter(RiskHistory.student_id == student_id)
        .order_by(RiskHistory.calculated_at)
        .all()
    )
    return [
        {
            'week':             i + 1,
            'risk_probability': float(r.probability),
            'risk_level':       r.risk_level.value,
            'risk_type':        r.risk_type,
            'calculated_at':    r.calculated_at.isoformat() if r.calculated_at else None,
        }
        for i, r in enumerate(rows)
    ]


@router.get('/{student_id}/explanation')
def get_explanation(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return SHAP-based (or rule-based) top risk factors."""
    profile  = _get_student_profile(student_id, db)
    _check_access(profile, current_user)

    academic = _latest_academic(student_id, db)
    credit   = _latest_credit(student_id, db)
    features = _build_feature_dict(academic, credit)

    svc     = ModelService.get()
    factors = svc.explain(features)

    return {
        'student_id':  student_id,
        'top_factors': factors,
        'method':      'shap' if svc.loaded else 'rule_based',
        'disclaimer': 'These are predictive factors and do not themselves determine official progression eligibility.'
    }


@router.get('/velocity-alerts')
def get_velocity_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get ranked early-warning velocity alerts for all permitted students.
    Identifies RAPID_DECLINE and SILENT_AT_RISK students before failure.
    """
    from app.risk.velocity import get_all_velocity_alerts
    return get_all_velocity_alerts(current_user, db)


@router.get('/{student_id}/velocity')
def get_student_velocity_endpoint(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get velocity metrics and trajectory for a single student."""
    profile = _get_student_profile(student_id, db)
    _check_access(profile, current_user)
    from app.risk.velocity import compute_student_velocity
    return compute_student_velocity(student_id, db)


# ── 2025/2026 Prescriptive Intervention Levers ───────────────────────────────

class SimulateRequest(BaseModel):
    target_attendance: Optional[float] = None
    target_marks: Optional[float] = None
    target_assignments: Optional[float] = None
    target_backlogs_cleared: Optional[int] = 0
    target_ese_score: Optional[float] = None
    commit_goal: Optional[bool] = False
    notes: Optional[str] = None


@router.post('/{student_id}/simulate')
def simulate_student_counterfactual(
    student_id: int,
    body: SimulateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    2025/2026 Prescriptive Learning Analytics:
    Allows students & mentors to test 'What-If' scenarios and calculate counterfactual risk reduction.
    Evaluates Mumbai University Autonomous passing criteria (ESE 24/60, aggregate 40%, O.5042 grace).
    Optionally commits the simulated target as a binding personal academic recovery plan.
    """
    profile = _get_student_profile(student_id, db)
    _check_access(profile, current_user)

    academic = _latest_academic(student_id, db)
    credit   = _latest_credit(student_id, db)
    features = _build_feature_dict(academic, credit)

    # Base values
    base_att = float(features.get('attendance', 75.0))
    base_mrk = float(features.get('marks', 60.0))
    base_asg = float(features.get('assignment_completion', 70.0))
    base_fh  = int(features.get('failed_heads', 0))
    base_gpa = float(features.get('gpa', 6.5))

    # Baseline predicted risk
    svc = ModelService.get()
    base_pred = svc.predict(features)
    base_prob = round(float(base_pred['risk_probability']), 3)
    base_level = base_pred['risk_level']

    # Simulated targets
    sim_att = round(body.target_attendance if body.target_attendance is not None else base_att, 1)
    sim_internal = round(body.target_marks if body.target_marks is not None else base_mrk, 1)
    sim_asg = round(body.target_assignments if body.target_assignments is not None else base_asg, 1)
    backlogs_cleared = max(0, body.target_backlogs_cleared or 0)
    # ESE default: When not specified, calculate a neutral ESE that produces
    # a composite matching the student's baseline marks (composite = internal*0.40 + ESE)
    # Neutral ESE = base_mrk - base_mrk*0.40 = base_mrk*0.60
    default_ese = round(base_mrk * 0.60, 1)
    target_ese = round(body.target_ese_score if body.target_ese_score is not None else default_ese, 1)

    # SIES GST Autonomous R19/R24 Course Evaluation Head Model:
    # Course Total = 100 marks:
    # 1. Internal Assessment / Termwork (ISE + MSE) = 40% weightage (40 marks max)
    # 2. End-Semester Examination (ESE Theory) = 60% weightage (60 marks max)
    composite_marks = round((sim_internal * 0.40) + target_ese, 1)

    # SIES GST Autonomous ESE Passing Head & Ordinance 5042 Safety Analysis
    ese_pass_threshold = 24.0   # 40% of 60 marks
    is_ese_head_cleared = target_ese >= ese_pass_threshold
    o5042_eligible = (22.0 <= target_ese < ese_pass_threshold) and (composite_marks >= 40.0)
    ese_safe = is_ese_head_cleared or o5042_eligible
    aggregate_cleared = composite_marks >= 40.0
    course_safe = ese_safe and aggregate_cleared

    # Debarment under Mumbai University Ordinance 6086:
    is_debarred = sim_att < 50.0
    is_condonation_needed = (50.0 <= sim_att < 75.0)

    # Failed heads impact:
    # If the student fails the separate ESE head (<24, without grace) or fails aggregate, they incur an ATKT head
    added_fh = 0 if course_safe else 1
    sim_fh = max(0, base_fh - backlogs_cleared) + added_fh

    # Projected SGPA calculation based on Mumbai University / SIES GST Autonomous 10-point scale:
    # ESE is 60% of course weightage!
    if is_debarred:
        # Debarred students are not permitted to appear for ESE exams under Ordinance 6086
        # ESE theory head is deferred / on ATKT hold; coursework marks count towards term record
        sim_gpa = round(max(2.5, min(4.0, (composite_marks / 100.0) * 5.0)), 2)
    elif course_safe:
        sgpa_base = 4.0 + ((min(100.0, composite_marks) - 40.0) / 60.0) * 6.0
        cleared_bonus = min(backlogs_cleared * 0.25, 0.75)
        sim_gpa = round(min(10.0, max(4.0, sgpa_base + cleared_bonus)), 2)
    else:
        # ATKT / Grade F on failing head or aggregate drags SGPA down to fail bracket
        sgpa_base = max(0.0, (composite_marks / 100.0) * 4.0)
        sim_gpa = round(max(0.0, min(3.5, sgpa_base)), 2)

    # ── Prescriptive Delta-Based Risk Simulation Engine ─────────────────────
    # The ML model (Random Forest trained on UCI data) provides calibrated
    # baseline risk predictions. However, it CANNOT reliably extrapolate to
    # extreme simulated feature values (e.g., 100% attendance maps to 6.5+
    # standard deviations above the scaler mean, causing erratic predictions).
    #
    # Instead, we compute risk reduction prescriptively: measure how much each
    # academic dimension improved relative to baseline, weight by established
    # feature importance, and reduce the baseline risk proportionally.
    # This gives intuitive, monotonic results aligned with domain knowledge.

    # 1. Normalized improvement ratios (0 = no change, 1 = max possible improvement)
    att_improvement = max(0.0, sim_att - base_att) / max(100.0 - base_att, 1.0)
    marks_improvement = max(0.0, composite_marks - base_mrk) / max(100.0 - base_mrk, 1.0)
    gpa_improvement = max(0.0, sim_gpa - base_gpa) / max(10.0 - base_gpa, 0.5)
    asg_improvement = max(0.0, sim_asg - base_asg) / max(100.0 - base_asg, 1.0)
    backlog_improvement = min(1.0, backlogs_cleared / base_fh) if base_fh > 0 else 0.0

    # 2. Weighted combination (RF model feature importance weights)
    weighted_improvement = (
        att_improvement * 0.20 +
        marks_improvement * 0.25 +
        gpa_improvement * 0.25 +
        asg_improvement * 0.10 +
        backlog_improvement * 0.20
    )

    # 3. Absolute academic level bonuses (high performers have inherently lower risk)
    level_bonus = 0.0
    if sim_att >= 90:
        level_bonus += 0.04
    elif sim_att >= 75:
        level_bonus += 0.02
    if composite_marks >= 80:
        level_bonus += 0.06
    elif composite_marks >= 60:
        level_bonus += 0.02
    if sim_gpa >= 9.0:
        level_bonus += 0.05
    elif sim_gpa >= 7.0:
        level_bonus += 0.02

    # 4. Total prescriptive risk reduction (capped at 85% of baseline)
    total_reduction = min(0.85, weighted_improvement + level_bonus)
    sim_prob = base_prob * (1.0 - total_reduction)

    # 5. Regulatory penalties override improvements only if conditions WORSENED from baseline
    if is_debarred and base_att >= 50.0:
        # Debarment under Ordinance 6086: cannot write ESE exams -> exam hold / remedial ATKT penalty
        # Modest escalation appropriate to Mumbai University autonomous institutions
        sim_prob = min(0.55, max(base_prob + 0.10, sim_prob + 0.16))
    elif (not course_safe) and (base_mrk >= 40.0):
        # Failing mandatory ESE separate passing head (<24) or aggregate (<40%) -> ATKT risk escalation
        sim_prob = min(0.60, max(base_prob + 0.10, sim_prob + 0.18))
    elif sim_att < 75.0 and sim_att < base_att:
        # Ordinance 6086 condonation bracket: smooth modest progression
        sim_prob += (75.0 - sim_att) / 100.0 * 0.06

    # 6. Degradation penalties for features that WORSENED relative to baseline
    if sim_att < base_att:
        sim_prob += (base_att - sim_att) / 100.0 * 0.08
    if composite_marks < base_mrk:
        sim_prob += (base_mrk - composite_marks) / 100.0 * 0.20
    if sim_asg < base_asg:
        sim_prob += (base_asg - sim_asg) / 100.0 * 0.10

    # Exact neutrality when simulated inputs match baseline (e.g. on initial mount or Reset to Baseline)
    if (abs(sim_att - base_att) < 0.2 and 
        abs(composite_marks - base_mrk) < 0.6 and 
        abs(sim_asg - base_asg) < 0.2 and 
        backlogs_cleared == 0):
        sim_prob = base_prob

    sim_prob = round(max(0.02, min(0.85, sim_prob)), 3)
    sim_level = ModelService._level(sim_prob)

    # Risk reduction delta
    risk_delta = round(base_prob - sim_prob, 3)
    reduction_pct = round(((base_prob - sim_prob) / max(base_prob, 0.01)) * 100, 1) if base_prob > 0 else 0.0

    passing_safety = {
        'target_ese_score': target_ese,
        'ese_pass_threshold': ese_pass_threshold,
        'is_ese_head_cleared': is_ese_head_cleared,
        'ordinance_5042_eligible': o5042_eligible,
        'ordinance_5042_note': 'Eligible for up to 2 grace marks under Mumbai University Ordinance 5042' if o5042_eligible else None,
        'is_debarred': is_debarred,
        'is_condonation_needed': is_condonation_needed,
        'attendance_status': 'COMPLIANT' if sim_att >= 75.0 else ('CONDONATION_BRACKET' if sim_att >= 50.0 else 'DEBARRED'),
        'composite_marks': composite_marks,
        'internal_contrib': round(sim_internal * 0.40, 1),
        'ese_contrib': target_ese,
        'aggregate_cleared': aggregate_cleared,
        'course_safe': course_safe,
    }

    # Generate specific actionable recovery commitments
    actionable_milestones = []
    if is_debarred:
        lectures_needed = max(1, int(round((50.0 - sim_att) * 1.5)))
        actionable_milestones.append(f"CRITICAL: Attend at least {lectures_needed} consecutive lectures to lift attendance above 50% and clear Debarred status under Ordinance 6086")
    elif is_condonation_needed and sim_att < 75.0:
        lectures_needed = max(1, int(round((75.0 - sim_att) * 1.2)))
        actionable_milestones.append(f"Attend next {lectures_needed} lectures to reach 75% floor and eliminate O.6086 condonation requirement")
    elif sim_att > base_att:
        lectures_needed = max(1, int(round((sim_att - base_att) * 1.2)))
        actionable_milestones.append(f"Attend next {lectures_needed} consecutive lectures to lift attendance from {base_att}% to {sim_att}%")
    if sim_asg > base_asg:
        actionable_milestones.append(f"Submit all remaining lab/tutorial assignments on time to raise completion to {sim_asg}%")
    if target_ese is not None:
        actionable_milestones.append(f"Target minimum {target_ese}/60 in End-Semester Exam (ESE) to guarantee separate passing head (>=24)")
    if backlogs_cleared > 0:
        actionable_milestones.append(f"Register for upcoming remedial exam to clear {backlogs_cleared} ATKT backlog head(s)")

    if not actionable_milestones:
        actionable_milestones.append("Maintain current academic trajectory to ensure on-time graduation.")

    # Optional Goal Commitment (Converts simulation into binding recovery plan)
    simulation_record_id = None
    if body.commit_goal:
        sim_rec = StudentSimulation(
            student_id=student_id,
            created_at=datetime.now(timezone.utc),
            current_risk_prob=base_prob,
            simulated_risk_prob=sim_prob,
            risk_delta=risk_delta,
            target_attendance=sim_att,
            target_marks=composite_marks,
            target_assignments=sim_asg,
            target_backlogs_cleared=backlogs_cleared,
            target_ese_score=target_ese,
            is_committed=True,
            notes=body.notes or f"Simulated recovery commitment: Risk drop {reduction_pct}%",
        )
        db.add(sim_rec)
        db.commit()
        db.refresh(sim_rec)
        simulation_record_id = sim_rec.id

        # Also create or attach an active recovery intervention with closed-loop baseline
        checklist = [
            {"id": i + 1, "task": m, "completed": False}
            for i, m in enumerate(actionable_milestones)
        ]
        iv = Intervention(
            student_id=student_id,
            type=InterventionType.BACKLOG_PLAN if sim_fh > 0 else InterventionType.ATTENDANCE_PLAN,
            reason=f"[Simulated Goal Committed] Target {sim_att}% att, {composite_marks}% composite marks. Projected risk drop: -{round(risk_delta * 100)}%",
            priority=InterventionPriority.HIGH if sim_prob >= 0.50 else InterventionPriority.MEDIUM,
            status=InterventionStatus.assigned,
            assigned_to=profile.mentor_id or current_user.id,
            target_course_code=None,
            target_course_name="Personal Academic Recovery Commitment",
            milestone_goal=f"Reach {sim_att}% attendance & {sim_gpa} projected SGPA",
            action_checklist=checklist,
            progress_pct=0,
            baseline_risk_prob=base_prob,
            current_risk_prob=base_prob,
            risk_delta=0.0,
            efficacy_status='ON_TRACK' if risk_delta > 0 else 'EVALUATING',
            created_at=datetime.now(timezone.utc),
        )
        db.add(iv)
        db.commit()

    return {
        'student_id': student_id,
        'baseline': {
            'risk_probability': base_prob,
            'risk_level': base_level,
            'attendance': base_att,
            'marks': base_mrk,
            'assignment_completion': base_asg,
            'failed_heads': base_fh,
            'gpa': base_gpa,
        },
        'simulated': {
            'risk_probability': sim_prob,
            'risk_level': sim_level,
            'attendance': sim_att,
            'marks': composite_marks,
            'internal_marks': sim_internal,
            'ese_score': target_ese,
            'composite_marks': composite_marks,
            'assignment_completion': sim_asg,
            'failed_heads': sim_fh,
            'gpa': sim_gpa,
        },
        'risk_delta': risk_delta,
        'risk_reduction_pct': reduction_pct,
        'projected_sgpa': sim_gpa,
        'is_debarred': is_debarred,
        'composite_marks': composite_marks,
        'passing_safety': passing_safety,
        'actionable_milestones': actionable_milestones,
        'is_committed': bool(body.commit_goal),
        'simulation_record_id': simulation_record_id,
    }


@router.get('/{student_id}/remedial-targets')
def get_student_remedial_targets(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    SIES GST Autonomous Remedial & Safety Head Calculator:
    For each course in the latest semester, computes internal marks (ISE + MSE)
    and determines the exact minimum End-Semester Exam (ESE) marks needed out of 60
    to clear the separate passing head (24/60) and aggregate 40%.
    """
    profile = _get_student_profile(student_id, db)
    _check_access(profile, current_user)

    max_sem = profile.semester or 8
    crs = (
        db.query(CourseResult)
        .filter(
            CourseResult.student_id == student_id,
            CourseResult.semester <= max_sem
        )
        .order_by(desc(CourseResult.semester), CourseResult.course_code)
        .all()
    )

    if not crs:
        # Fallback to course catalog if no course results yet
        return {
            'student_id': student_id,
            'semester': profile.semester,
            'courses': [],
            'summary': 'No subject exam results recorded yet for this student.'
        }

    latest_sem = crs[0].semester
    sem_courses = [c for c in crs if c.semester == latest_sem]

    targets = []
    urgent_count = 0
    for c in sem_courses:
        ise = min(20.0, max(0.0, float(c.ise_marks))) if c.ise_marks is not None else 12.0
        mse = min(20.0, max(0.0, float(c.mse_marks))) if c.mse_marks is not None else 12.0
        internal_total = round(ise + mse, 1)

        # Autonomous separate passing rules:
        # 1. ESE head separate passing = 40% of 60 = 24.0 marks
        # 2. Total aggregate (ISE + MSE + ESE) must be >= 40.0 marks
        min_ese_for_aggregate = max(0.0, round(40.0 - internal_total, 1))
        min_ese_needed = max(24.0, min_ese_for_aggregate)

        # Ordinance 5042 Grace mark eligibility:
        o5042_eligible = (internal_total + 22.0 >= 40.0)

        # Urgency level
        if mse < 8.0:
            urgency = 'CRITICAL'
            rec = f"MSE score ({mse}/20) is below 40%. Attend MSE Remedial Retest clinic to safeguard internal marks."
            urgent_count += 1
        elif min_ese_needed > 28.0:
            urgency = 'ATTENTION'
            rec = f"Requires at least {min_ese_needed}/60 in ESE. Prioritize high-weightage modules."
        else:
            urgency = 'SAFE'
            rec = f"On track: Scoring {min_ese_needed}/60 in ESE secures a clear pass."

        targets.append({
            'course_code': c.course_code,
            'course_name': c.course_name or c.course_code,
            'semester': c.semester,
            'credits': c.credits or 3,
            'ise_marks': ise,
            'mse_marks': mse,
            'internal_total': internal_total,
            'ese_max': 60.0,
            'min_ese_needed': min_ese_needed,
            'ese_pass_threshold': 24.0,
            'o5042_grace_eligible': o5042_eligible,
            'urgency': urgency,
            'recommendation': rec,
            'is_failed': bool(c.is_failed or c.is_ese_failed),
        })

    return {
        'student_id': student_id,
        'semester': latest_sem,
        'urgent_remedial_count': urgent_count,
        'targets': targets,
        'guidance_note': 'SIES GST Autonomous R19/R24: ESE requires minimum 24/60 marks separate passing head and 40% overall course aggregate.',
    }


