import sys
sys.path.insert(0, 'backend')
from app.risk.inference import ModelService

def compute_calibrated_siesgst_risk(data: dict) -> float:
    # 1. Base anchor
    base = 0.08

    # 2. Attendance (Mumbai University Ordinance 6086)
    att = float(data.get('attendance', data.get('attendance_percentage', 100.0)))
    att = max(0.0, min(100.0, att))
    
    if att >= 85.0:
        att_effect = -0.03 * ((att - 85.0) / 15.0)  # Up to -3% reward for high attendance
    elif att >= 75.0:
        att_effect = 0.0  # Fully compliant under O.6086: zero penalty
    elif att >= 50.0:
        # Condonation bracket (50% - 74.9%): manageable under Principal condonation
        att_effect = ((75.0 - att) / 25.0) * 0.06  # 0% to +6% max
    else:
        # Debarred bracket (< 50%): non-condonable exam detention under O.6086
        att_effect = 0.06 + ((50.0 - att) / 50.0) * 0.12  # +6% to +18% max

    # 3. Marks (0-100 composite)
    marks = float(data.get('marks', 60.0))
    marks = max(0.0, min(100.0, marks))
    if marks >= 75.0:
        marks_effect = -0.03 * ((marks - 75.0) / 25.0)  # Up to -3%
    elif marks >= 50.0:
        marks_effect = 0.02 * ((75.0 - marks) / 25.0)   # 0% to +2%
    elif marks >= 40.0:
        marks_effect = 0.02 + 0.05 * ((50.0 - marks) / 10.0)  # +2% to +7%
    else:
        marks_effect = 0.07 + 0.12 * ((40.0 - marks) / 40.0)  # +7% to +19%

    # 4. GPA (0-10 scale)
    gpa = float(data.get('gpa', 7.0))
    if gpa > 10.0 and gpa <= 100.0:
        gpa = gpa / 10.0
    gpa = max(0.0, min(10.0, gpa))
    
    if gpa >= 8.5:
        gpa_effect = -0.04 * ((gpa - 8.5) / 1.5)
    elif gpa >= 6.75:
        gpa_effect = -0.02 * ((gpa - 6.75) / 1.75)
    elif gpa >= 5.0:
        gpa_effect = 0.04 * ((6.75 - gpa) / 1.75)
    elif gpa >= 4.0:
        gpa_effect = 0.04 + 0.06 * ((5.0 - gpa) / 1.0)
    else:
        gpa_effect = 0.10 + 0.12 * ((4.0 - gpa) / 4.0)

    # 5. Assignment completion (0-100)
    asg = float(data.get('assignment_completion', data.get('assignment_completion_percentage', 80.0)))
    asg = max(0.0, min(100.0, asg))
    if asg >= 80.0:
        asg_effect = -0.01 * ((asg - 80.0) / 20.0)
    else:
        asg_effect = 0.04 * ((80.0 - asg) / 80.0)

    # 6. SIES GST Autonomous ATKT / Failed Heads & Subjects
    fh = int(data.get('failed_heads', 0))
    fs = int(data.get('failed_subjects', 0))
    effective_fh = max(fh, fs)
    
    if effective_fh == 0:
        head_effect = 0.0
    elif effective_fh <= 2:
        head_effect = effective_fh * 0.05
    elif effective_fh <= 4:
        head_effect = 0.10 + (effective_fh - 2) * 0.08
    else:
        head_effect = 0.26 + min(0.25, (effective_fh - 4) * 0.08)

    # ESE specific failed heads
    ese_fh = int(data.get('ese_failed_heads', 0))
    ese_effect = min(0.12, ese_fh * 0.04)

    # 7. Credit Progress (Deficit)
    earned = float(data.get('earned_credits', 0.0))
    expected = float(data.get('expected_credits', 0.0))
    backlog_cr = float(data.get('backlog_credits', 0.0))
    
    credit_effect = 0.0
    if expected > 0.0:
        ratio = min(1.0, earned / expected)
        if ratio < 0.70:
            credit_effect = 0.08 + (0.70 - ratio) * 0.20
        elif ratio < 0.90:
            credit_effect = (0.90 - ratio) * 0.15
    elif backlog_cr > 0:
        credit_effect = min(0.15, backlog_cr * 0.015)

    total_score = base + att_effect + marks_effect + gpa_effect + asg_effect + head_effect + ese_effect + credit_effect
    return round(max(0.02, min(0.92, total_score)), 4)

print("Test: attendance from 100 to 30 with 1% steps:")
prev = None
for a in range(100, 29, -5):
    p = compute_calibrated_siesgst_risk({'attendance': a, 'marks': 70, 'gpa': 7.2, 'assignment_completion': 85})
    diff = f"{p - prev:+.4f}" if prev is not None else "base"
    print(f"att={a:3d}% -> risk={p*100:5.2f}% (delta: {diff})")
    prev = p
