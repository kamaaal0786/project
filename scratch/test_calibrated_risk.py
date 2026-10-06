"""
Test prototype of Calibrated SIES GST Autonomous Risk Engine
"""

def compute_calibrated_risk(data: dict) -> dict:
    # 1. Base anchor
    base = 0.08

    # 2. Attendance (Mumbai University Ordinance 6086)
    att = float(data.get('attendance', data.get('attendance_percentage', 100.0)))
    att = max(0.0, min(100.0, att))
    
    if att >= 85.0:
        att_effect = -0.03 * ((att - 85.0) / 15.0)  # Up to -3% reward for stellar attendance
    elif att >= 75.0:
        att_effect = 0.0  # Fully compliant under O.6086: zero penalty
    elif att >= 50.0:
        # Condonation bracket (50% - 74.9%): manageable under Principal condonation
        att_effect = ((75.0 - att) / 25.0) * 0.06  # 0% to +6% max
    else:
        # Debarred bracket (< 50%): non-condonable exam detention under O.6086
        att_effect = 0.06 + ((50.0 - att) / 50.0) * 0.14  # +6% to +20% max

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
        asg_effect = 0.05 * ((80.0 - asg) / 80.0)

    # 6. SIES GST Autonomous ATKT / Failed Heads & Subjects
    fh = int(data.get('failed_heads', 0))
    fs = int(data.get('failed_subjects', 0))
    effective_fh = max(fh, fs)
    
    if effective_fh == 0:
        head_effect = 0.0
    elif effective_fh <= 2:
        head_effect = effective_fh * 0.05       # 1 head -> +5%, 2 heads -> +10%
    elif effective_fh <= 4:
        head_effect = 0.10 + (effective_fh - 2) * 0.08  # 3 heads -> +18%, 4 heads -> +26%
    else:
        head_effect = 0.26 + min(0.25, (effective_fh - 4) * 0.08)  # 5+ heads -> +34% to +51% (Year drop territory)

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

    # Sum all effects
    total_score = base + att_effect + marks_effect + gpa_effect + asg_effect + head_effect + ese_effect + credit_effect
    prob = round(max(0.02, min(0.92, total_score)), 4)
    
    # Risk level categorization (4 levels)
    if prob < 0.25:
        level = 'LOW'
    elif prob < 0.50:
        level = 'MEDIUM'
    elif prob < 0.75:
        level = 'HIGH'
    else:
        level = 'CRITICAL'

    return {
        'risk_probability': prob,
        'risk_level': level,
        'model_version': 'calibrated-siesgst-r24',
        'breakdown': {
            'attendance_effect': round(att_effect, 4),
            'marks_effect': round(marks_effect, 4),
            'gpa_effect': round(gpa_effect, 4),
            'head_effect': round(head_effect, 4),
            'credit_effect': round(credit_effect, 4),
        }
    }


if __name__ == '__main__':
    print("=== Testing Attendance Response (marks=65, gpa=6.5, asg=75, failed=0) ===")
    for a in [100, 95, 90, 85, 80, 75, 74, 70, 65, 60, 55, 50, 49, 45, 40, 30]:
        res = compute_calibrated_risk({'attendance': a, 'marks': 65, 'gpa': 6.5, 'assignment_completion': 75})
        print(f"att={a:3d}% -> prob={res['risk_probability']*100:5.1f}% ({res['risk_level']:6s}) [att_effect={res['breakdown']['attendance_effect']:+.3f}]")

    print("\n=== Testing Marks Response (att=80, gpa=6.5, asg=75, failed=0) ===")
    for m in [95, 85, 75, 65, 55, 45, 35]:
        res = compute_calibrated_risk({'attendance': 80, 'marks': m, 'gpa': 6.5, 'assignment_completion': 75})
        print(f"marks={m:3d}% -> prob={res['risk_probability']*100:5.1f}% ({res['risk_level']:6s})")

    print("\n=== Testing Failed Heads (att=80, marks=65, gpa=6.5) ===")
    for fh in [0, 1, 2, 3, 4, 5, 6]:
        res = compute_calibrated_risk({'attendance': 80, 'marks': 65, 'gpa': 6.5, 'failed_heads': fh})
        print(f"failed_heads={fh} -> prob={res['risk_probability']*100:5.1f}% ({res['risk_level']:6s})")
