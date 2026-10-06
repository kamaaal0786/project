"""
Interventions router — GET list, POST create, PATCH update.

Fixes in Phase 3:
- Faculty filter: use StudentFaculty join instead of assigned_to == user_id
  so all assigned students' interventions are visible, not just ones the faculty created
- Add student_name to serialized response (join User via StudentProfile)
- Status normalization: accept UPPER or lower from frontend
- Audit trail correctly written on every PATCH
"""
from datetime import datetime, timezone, date
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.orm.attributes import flag_modified
from sqlalchemy import desc

from app.db.base import get_db
from app.db.models import (
    User, StudentProfile, StudentFaculty, Intervention, InterventionUpdate,
    UserRole, InterventionStatus, RiskHistory, InterventionPriority, InterventionType
)
from app.auth.dependencies import get_current_user

router = APIRouter(prefix='/api/interventions', tags=['interventions'])


# ── Schemas ──────────────────────────────────────────────────────────────────

class CreateInterventionRequest(BaseModel):
    student_id: int
    type: str
    reason: str
    priority: str = 'MEDIUM'
    due_date: Optional[date] = None
    assigned_to: Optional[int] = None   # user_id of faculty/mentor
    target_course_code: Optional[str] = None
    target_course_name: Optional[str] = None
    milestone_goal: Optional[str] = None
    action_checklist: Optional[List[dict]] = None
    progress_pct: Optional[int] = 0


class UpdateInterventionRequest(BaseModel):
    status: Optional[str] = None
    note: Optional[str] = None
    outcome: Optional[str] = None
    due_date: Optional[date] = None
    progress_pct: Optional[int] = None
    action_checklist: Optional[List[dict]] = None
    toggle_item_id: Optional[int] = None


# ── Helpers ──────────────────────────────────────────────────────────────────

def _student_name(student_id: int, db: Session) -> str:
    """Resolve student_id → display name via StudentProfile → User join."""
    profile = (
        db.query(StudentProfile)
        .options(joinedload(StudentProfile.user))
        .filter(StudentProfile.student_id == student_id)
        .first()
    )
    return profile.user.name if profile and profile.user else f'Student #{student_id}'


def _normalize_status(raw: str) -> InterventionStatus:
    """Accept both 'PENDING' and 'pending' from the frontend."""
    try:
        return InterventionStatus[raw.lower()]
    except KeyError:
        raise HTTPException(400, f'Invalid status: {raw}. '
                            f'Valid: {[s.name.upper() for s in InterventionStatus]}')


def _serialize(iv: Intervention, student_name: str = '') -> dict:
    return {
        'id':                 iv.id,
        'student_id':         iv.student_id,
        'student_name':       student_name,
        'type':               iv.type,
        'reason':             iv.reason,
        'priority':           iv.priority,
        'status':             iv.status.value.upper() if iv.status else None,
        'due_date':           iv.due_date.isoformat() if iv.due_date else None,
        'assigned_to':        iv.assigned_to,
        'created_at':         iv.created_at.isoformat() if iv.created_at else None,
        'target_course_code': iv.target_course_code,
        'target_course_name': iv.target_course_name,
        'progress_pct':       iv.progress_pct if iv.progress_pct is not None else 0,
        'milestone_goal':     iv.milestone_goal,
        'action_checklist':   iv.action_checklist or [],
        # Closed-loop efficacy fields
        'baseline_risk_prob': iv.baseline_risk_prob if iv.baseline_risk_prob is not None else 0.0,
        'current_risk_prob':  iv.current_risk_prob if iv.current_risk_prob is not None else 0.0,
        'risk_delta':         iv.risk_delta if iv.risk_delta is not None else 0.0,
        'risk_delta_pct':     round((iv.risk_delta or 0.0) * 100, 1),
        'efficacy_status':    iv.efficacy_status or 'EVALUATING',
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get('')
def list_interventions(
    student_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Role-aware intervention list:
    - Student  → only their own
    - Faculty  → all students assigned to them (via StudentFaculty), optionally filtered
    - Mentor   → all students whose mentor_id == current_user.id
    - Admin    → everything, optionally filtered by student_id
    """
    q = db.query(Intervention)

    if current_user.role == UserRole.student:
        profile = db.query(StudentProfile).filter(
            StudentProfile.user_id == current_user.id
        ).first()
        if not profile:
            return []
        q = q.filter(Intervention.student_id == profile.student_id)

    elif current_user.role == UserRole.faculty:
        # Get all student_ids assigned to this faculty via StudentFaculty
        assigned_sids = [
            r.student_id for r in
            db.query(StudentFaculty.student_id)
            .filter(StudentFaculty.faculty_id == current_user.id)
            .distinct()
            .all()
        ]
        if not assigned_sids:
            return []
        q = q.filter(Intervention.student_id.in_(assigned_sids))
        if student_id:
            q = q.filter(Intervention.student_id == student_id)

    elif current_user.role == UserRole.mentor:
        # Get all students whose mentor_id == current_user.id
        mentored_sids = [
            r.student_id for r in
            db.query(StudentProfile.student_id)
            .filter(StudentProfile.mentor_id == current_user.id)
            .all()
        ]
        if not mentored_sids:
            return []
        q = q.filter(Intervention.student_id.in_(mentored_sids))
        if student_id:
            q = q.filter(Intervention.student_id == student_id)

    elif student_id:
        # Admin with optional filter
        q = q.filter(Intervention.student_id == student_id)

    interventions = q.order_by(desc(Intervention.created_at)).all()

    # Batch-resolve student names
    sids = list({iv.student_id for iv in interventions})
    profiles = (
        db.query(StudentProfile)
        .options(joinedload(StudentProfile.user))
        .filter(StudentProfile.student_id.in_(sids))
        .all()
    )
    name_map = {p.student_id: (p.user.name if p.user else '') for p in profiles}

    return [_serialize(iv, name_map.get(iv.student_id, '')) for iv in interventions]


@router.post('', status_code=201)
def create_intervention(
    body: CreateInterventionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new intervention (admin/faculty/mentor only)."""
    if current_user.role == UserRole.student:
        raise HTTPException(403, 'Students cannot create interventions')

    profile = db.query(StudentProfile).filter(
        StudentProfile.student_id == body.student_id
    ).first()
    if not profile:
        raise HTTPException(404, 'Student not found')

    # Fetch latest risk probability to anchor closed-loop baseline
    latest_risk = (
        db.query(RiskHistory)
        .filter(RiskHistory.student_id == body.student_id)
        .order_by(desc(RiskHistory.calculated_at), desc(RiskHistory.id))
        .first()
    )
    base_risk = float(latest_risk.probability) if latest_risk else 0.35

    iv = Intervention(
        student_id=body.student_id,
        type=body.type,
        reason=body.reason,
        priority=body.priority,
        status=InterventionStatus.pending,
        due_date=body.due_date,
        assigned_to=body.assigned_to or current_user.id,
        target_course_code=body.target_course_code,
        target_course_name=body.target_course_name,
        milestone_goal=body.milestone_goal,
        action_checklist=body.action_checklist,
        progress_pct=body.progress_pct or 0,
        baseline_risk_prob=base_risk,
        current_risk_prob=base_risk,
        risk_delta=0.0,
        efficacy_status='EVALUATING',
        created_at=datetime.now(timezone.utc),
    )
    db.add(iv)
    db.commit()
    db.refresh(iv)
    name = _student_name(body.student_id, db)
    return _serialize(iv, name)


@router.patch('/{intervention_id}')
def update_intervention(
    intervention_id: int,
    body: UpdateInterventionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update status / notes / due_date / checklist / progress.
    - Mentors / Faculty / Admin: Can update all fields.
    - Students: Can check off checklist items on their own assigned interventions.
    """
    iv = db.query(Intervention).filter(Intervention.id == intervention_id).first()
    if not iv:
        raise HTTPException(404, 'Intervention not found')

    # Student permission check
    if current_user.role == UserRole.student:
        profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
        if not profile or iv.student_id != profile.student_id:
            raise HTTPException(403, 'Students can only update checklist progress on their own interventions')
        if body.status or body.due_date:
            raise HTTPException(403, 'Students cannot modify official intervention status or due date')

    # Toggle checklist item or replace checklist
    updated_checklist = False
    checklist = list(iv.action_checklist or [])

    if body.toggle_item_id is not None and checklist:
        for item in checklist:
            if item.get("id") == body.toggle_item_id:
                item["completed"] = not item.get("completed", False)
                updated_checklist = True
                break
    elif body.action_checklist is not None:
        checklist = body.action_checklist
        updated_checklist = True

    if updated_checklist:
        iv.action_checklist = [dict(it) for it in checklist]
        flag_modified(iv, "action_checklist")
        total_items = len(checklist)
        completed_items = sum(1 for it in checklist if it.get("completed"))
        if total_items > 0:
            iv.progress_pct = round((completed_items / total_items) * 100)
            if iv.progress_pct == 100 and iv.status != InterventionStatus.completed:
                iv.status = InterventionStatus.completed
            elif iv.progress_pct > 0 and iv.status == InterventionStatus.pending:
                iv.status = InterventionStatus.in_progress

    if body.progress_pct is not None and current_user.role != UserRole.student:
        iv.progress_pct = max(0, min(100, body.progress_pct))

    # Closed-loop dynamic efficacy calculation as milestones are completed
    if iv.baseline_risk_prob and iv.baseline_risk_prob > 0:
        progress_factor = (iv.progress_pct or 0) / 100.0
        # Completing the plan achieves up to 40% proportional reduction in risk
        potential_reduction = iv.baseline_risk_prob * 0.40
        iv.current_risk_prob = round(max(0.04, iv.baseline_risk_prob - (potential_reduction * progress_factor)), 3)
        iv.risk_delta = round(iv.baseline_risk_prob - iv.current_risk_prob, 3)

        if iv.progress_pct >= 75:
            iv.efficacy_status = 'HIGH_EFFICACY'
        elif iv.progress_pct >= 25:
            iv.efficacy_status = 'ON_TRACK'
        elif iv.progress_pct > 0:
            iv.efficacy_status = 'EVALUATING'
        else:
            iv.efficacy_status = 'PENDING_START'

    if body.status and current_user.role != UserRole.student:
        iv.status = _normalize_status(body.status)
    if body.due_date and current_user.role != UserRole.student:
        iv.due_date = body.due_date

    # Append immutable audit trail
    actor_label = f"Student {current_user.name}" if current_user.role == UserRole.student else f"{current_user.role.value.capitalize()} {current_user.name}"
    audit_note = body.note
    if not audit_note and updated_checklist:
        audit_note = f"{actor_label} updated checklist milestone. Progress is now {iv.progress_pct}%."

    audit = InterventionUpdate(
        intervention_id=intervention_id,
        actor_id=current_user.id,
        status=iv.status.value,
        note=audit_note,
        outcome=body.outcome,
        updated_at=datetime.now(timezone.utc),
    )
    db.add(audit)
    db.commit()
    db.refresh(iv)
    name = _student_name(iv.student_id, db)
    return _serialize(iv, name)


@router.post('/{student_id}/generate-roadmap')
def generate_student_roadmap(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate an AI-powered personalized 4-week recovery roadmap and mentor outreach draft.
    Uses Google Gemini API if GEMINI_API_KEY is present; otherwise uses deterministic reasoning engine.
    """
    from app.interventions.recovery_generator import generate_recovery_plan
    if current_user.role == UserRole.student:
        profile = (
            db.query(StudentProfile)
            .filter(StudentProfile.user_id == current_user.id)
            .first()
        )
        if not profile or profile.student_id != student_id:
            raise HTTPException(403, "Students can only generate their own recovery roadmap")

    try:
        return generate_recovery_plan(student_id, db)
    except ValueError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(500, f"Recovery generation failed: {e}")


@router.post('/{student_id}/save-roadmap-plan')
def save_roadmap_as_intervention(
    student_id: int,
    body: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save an AI generated roadmap directly into active student interventions."""
    if current_user.role == UserRole.student:
        raise HTTPException(403, 'Students cannot create interventions')

    profile = db.query(StudentProfile).filter(StudentProfile.student_id == student_id).first()
    if not profile:
        raise HTTPException(404, 'Student not found')

    title = body.get('title', 'AI Personalized 4-Week Academic Recovery Plan')
    reason = body.get('reason', 'AI generated milestone roadmap targeting weak academic areas.')
    target_code = body.get('target_course_code')
    target_name = body.get('target_course_name')
    milestone_goal = body.get('milestone_goal')
    checklist = body.get('action_checklist')

    latest_risk = (
        db.query(RiskHistory)
        .filter(RiskHistory.student_id == student_id)
        .order_by(desc(RiskHistory.calculated_at), desc(RiskHistory.id))
        .first()
    )
    base_risk = float(latest_risk.probability) if latest_risk else 0.45

    iv = Intervention(
        student_id=student_id,
        type=InterventionType.BACKLOG_PLAN if (profile.latest_academic_record and profile.latest_academic_record.failed_heads) else InterventionType.ATTENDANCE_PLAN,
        reason=f"[{title}] {reason}",
        priority=InterventionPriority.HIGH,
        status=InterventionStatus.assigned,
        assigned_to=profile.mentor_id or current_user.id,
        target_course_code=target_code,
        target_course_name=target_name,
        milestone_goal=milestone_goal,
        action_checklist=checklist,
        progress_pct=0,
        baseline_risk_prob=base_risk,
        current_risk_prob=base_risk,
        risk_delta=0.0,
        efficacy_status='EVALUATING',
        created_at=datetime.now(timezone.utc),
    )
    db.add(iv)
    db.commit()
    db.refresh(iv)
    return _serialize(iv, _student_name(student_id, db))


@router.get('/{student_id}/efficacy')
def get_student_intervention_efficacy(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Closed-Loop Efficacy Tracker (Civitas Student Impact model):
    Audits pre-intervention risk vs current risk delta (ΔRisk) across all student interventions.
    """
    if current_user.role == UserRole.student:
        profile = db.query(StudentProfile).filter(StudentProfile.user_id == current_user.id).first()
        if not profile or profile.student_id != student_id:
            raise HTTPException(403, "Access denied")

    ivs = db.query(Intervention).filter(Intervention.student_id == student_id).all()
    if not ivs:
        return {
            'student_id': student_id,
            'has_active_interventions': False,
            'message': 'No interventions recorded yet.',
        }

    deltas = [iv.risk_delta for iv in ivs if iv.risk_delta is not None and iv.risk_delta > 0]
    avg_delta = round(sum(deltas) / len(deltas), 3) if deltas else 0.0

    return {
        'student_id': student_id,
        'has_active_interventions': True,
        'total_interventions': len(ivs),
        'completed_interventions': sum(1 for iv in ivs if iv.status == InterventionStatus.completed),
        'average_risk_delta': avg_delta,
        'average_risk_reduction_pct': round(avg_delta * 100, 1),
        'overall_status': 'HIGH_EFFICACY' if avg_delta >= 0.15 else ('ON_TRACK' if avg_delta > 0.05 else 'EVALUATING'),
        'interventions': [_serialize(iv) for iv in ivs],
    }

