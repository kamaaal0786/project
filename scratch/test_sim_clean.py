import sys
sys.path.insert(0, 'backend')
from app.db.base import SessionLocal
from app.db.models import User, UserRole, StudentProfile
from app.risk.router import simulate_student_counterfactual, SimulateRequest

db = SessionLocal()
u = db.query(User).filter(User.role == UserRole.admin).first()
prof = db.query(StudentProfile).first()
sid = prof.student_id

print(f"=== Student {sid} Simulation Across Attendance Levers ===")
for att in [100, 95, 85, 75, 70, 65, 55, 50, 48, 40, 30]:
    res = simulate_student_counterfactual(sid, SimulateRequest(target_attendance=att), db, u)
    sim = res['simulated']
    base = res['baseline']
    bp = base['risk_probability']
    sp = sim['risk_probability']
    sl = sim['risk_level']
    sgpa = sim['gpa']
    delta = res['risk_delta']
    print(f"att={att:3d}% | base={bp*100:4.1f}% | sim={sp*100:4.1f}% ({sl:6s}) | SGPA={sgpa:4.2f} | delta={delta*100:+5.1f}%")
