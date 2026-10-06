"""
cleanup_sync_students.py - Clean rogue test records and synchronize all student risk & regulation statuses.
"""
import sys
import os
sys.path.insert(0, os.path.abspath("backend"))

from app.db.base import SessionLocal
from app.db.models import AcademicRecord, StudentProfile, RiskHistory, RiskLevel, CreditRecord
from app.regulations.engine import evaluate_progression
from app.risk.inference import ModelService
from app.risk.router import _latest_academic, _latest_credit, _build_feature_dict, _intervention_adjustment
from datetime import datetime, timezone

def cleanup_and_sync():
    db = SessionLocal()
    try:
        # 1. Delete rogue upload test records
        rogue_terms = ['2-S3', '2-S5', '2-S4']
        deleted_acads = db.query(AcademicRecord).filter(AcademicRecord.term.in_(rogue_terms)).delete(synchronize_session=False)
        print(f"Deleted {deleted_acads} rogue test academic records.")
        db.commit()

        # 2. Synchronize all students
        profiles = db.query(StudentProfile).order_by(StudentProfile.student_id).all()
        svc = ModelService.get()
        level_map = {
            'LOW': RiskLevel.low,
            'MEDIUM': RiskLevel.medium,
            'HIGH': RiskLevel.high,
            'CRITICAL': RiskLevel.critical,
        }

        print(f"\nSynchronizing {len(profiles)} students...")
        for p in profiles:
            acad = _latest_academic(p.student_id, db)
            cred = _latest_credit(p.student_id, db)
            features = _build_feature_dict(acad, cred)

            # Predict calibrated risk
            res = svc.predict(features)
            adj_red, _ = _intervention_adjustment(p.student_id, db)
            raw_p = res['risk_probability']
            adj_p = round(max(raw_p - (raw_p * adj_red), 0.03), 4)
            adj_lvl = ModelService._level(adj_p)

            # Save synchronized risk snapshot
            snap = RiskHistory(
                student_id=p.student_id,
                probability=adj_p,
                risk_level=level_map[adj_lvl],
                model_version=res['model_version'],
                risk_type='ML',
                calculated_at=datetime.now(timezone.utc),
            )
            db.add(snap)

            # Run official regulation evaluation
            reg_res = evaluate_progression(p.student_id, db, p.regulation)
            p.academic_status = reg_res["status"]

        db.commit()

        # 3. Print Student 5 details
        p5 = db.query(StudentProfile).filter(StudentProfile.student_id == 5).first()
        acad5 = _latest_academic(5, db)
        latest_risk = db.query(RiskHistory).filter(RiskHistory.student_id == 5).order_by(RiskHistory.calculated_at.desc(), RiskHistory.id.desc()).first()

        print("\n" + "="*50)
        print(f"STUDENT 5 ({p5.roll_no} - {p5.user.name if p5.user else 'Unknown'}):")
        print(f"  Term: {acad5.term if acad5 else 'None'}")
        print(f"  Attendance: {acad5.attendance if acad5 else 'None'}%")
        print(f"  SGPA: {acad5.gpa if acad5 else 'None'}")
        print(f"  Failed Heads: {acad5.failed_heads if acad5 else 'None'}")
        print(f"  Academic Status: {p5.academic_status}")
        print(f"  Risk Probability: {round(latest_risk.probability * 100, 1)}%")
        print(f"  Risk Level: {latest_risk.risk_level.value.upper()}")
        print("="*50)

    finally:
        db.close()

if __name__ == "__main__":
    cleanup_and_sync()
