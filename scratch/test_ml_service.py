import sys
sys.path.insert(0, 'backend')
from app.risk.inference import ModelService

svc = ModelService.get()
svc.load()

print("--- Fixed marks=65, gpa=6.5, asg=75, failed=0 ---")
for a in range(40, 101, 5):
    res = svc.predict({'attendance': a, 'marks': 65, 'gpa': 6.5, 'assignment_completion': 75, 'failed_subjects': 0})
    print(f"att={a}: prob={res['risk_probability']} ({res['risk_level']})")

print("\n--- Fixed att=75, gpa=6.5, asg=75, failed=0 ---")
for m in range(40, 101, 10):
    res = svc.predict({'attendance': 75, 'marks': m, 'gpa': 6.5, 'assignment_completion': 75, 'failed_subjects': 0})
    print(f"marks={m}: prob={res['risk_probability']} ({res['risk_level']})")

print("\n--- Fixed att=75, marks=65, asg=75, failed=0 ---")
for g in [4.0, 5.0, 6.0, 7.0, 8.0, 9.0]:
    res = svc.predict({'attendance': 75, 'marks': 65, 'gpa': g, 'assignment_completion': 75, 'failed_subjects': 0})
    print(f"gpa={g}: prob={res['risk_probability']} ({res['risk_level']})")
