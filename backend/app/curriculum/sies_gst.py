"""
sies_gst.py — Official SIES GST Autonomous Curriculum Catalog across all 8 Semesters.
Covers B.Tech Computer Engineering, Information Technology, AI-DS, and First Year Engineering.
Autonomous R19 / R24 Evaluation Pattern:
- Theory: ISE (20), MSE (20), ESE (60) [Total = 100]
- Laboratory / Term Work: TW (25/50), Practical/Oral (25/50)
- Passing Criteria: Minimum 40% in ESE (24/60) and 40% aggregate (40/100).
"""
from typing import Dict, List, Any

SIES_GST_CURRICULUM: Dict[int, List[Dict[str, Any]]] = {
    1: [
        {"code": "FE101", "name": "Engineering Mathematics - I", "credits": 4, "has_lab": False, "tw": 25, "pr_or": 0},
        {"code": "FE102", "name": "Engineering Physics - I", "credits": 3, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "FE103", "name": "Engineering Chemistry - I", "credits": 3, "has_lab": False, "tw": 25, "pr_or": 0},
        {"code": "FE104", "name": "Engineering Mechanics", "credits": 4, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "FE105", "name": "Basic Electrical & Electronics (BEE)", "credits": 4, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "FE106", "name": "Basic Workshop Practice - I", "credits": 1, "has_lab": True, "tw": 50, "pr_or": 0},
    ],
    2: [
        {"code": "FE201", "name": "Engineering Mathematics - II", "credits": 4, "has_lab": False, "tw": 25, "pr_or": 0},
        {"code": "FE202", "name": "Engineering Physics - II", "credits": 3, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "FE203", "name": "Engineering Chemistry - II", "credits": 3, "has_lab": False, "tw": 25, "pr_or": 0},
        {"code": "FE204", "name": "Engineering Graphics & Design", "credits": 3, "has_lab": True, "tw": 50, "pr_or": 25},
        {"code": "FE205", "name": "C Programming & Problem Solving", "credits": 3, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "FE206", "name": "Professional Communication - I", "credits": 2, "has_lab": False, "tw": 25, "pr_or": 0},
    ],
    3: [
        {"code": "CS301", "name": "Engineering Mathematics - III", "credits": 4, "has_lab": False, "tw": 25, "pr_or": 0},
        {"code": "CS302", "name": "Data Structures & Algorithms", "credits": 4, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "CS303", "name": "Digital Logic & Computer Architecture", "credits": 3, "has_lab": False, "tw": 25, "pr_or": 0},
        {"code": "CS304", "name": "Object Oriented Programming with Java", "credits": 3, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "CS305", "name": "Principles of Communication", "credits": 3, "has_lab": False, "tw": 25, "pr_or": 0},
    ],
    4: [
        {"code": "CS401", "name": "Engineering Mathematics - IV", "credits": 4, "has_lab": False, "tw": 25, "pr_or": 0},
        {"code": "CS402", "name": "Analysis of Algorithms", "credits": 4, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "CS403", "name": "Database Management Systems", "credits": 4, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "CS404", "name": "Operating Systems", "credits": 3, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "CS405", "name": "Microprocessor & Embedded Systems", "credits": 3, "has_lab": False, "tw": 25, "pr_or": 0},
    ],
    5: [
        {"code": "CS501", "name": "Theoretical Computer Science & Automata", "credits": 4, "has_lab": False, "tw": 25, "pr_or": 0},
        {"code": "CS502", "name": "Software Engineering & Agile", "credits": 3, "has_lab": False, "tw": 25, "pr_or": 0},
        {"code": "CS503", "name": "Computer Networks & Security", "credits": 4, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "CS504", "name": "Data Warehousing & Mining", "credits": 3, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "CS505", "name": "Professional Ethics & Indian Constitution", "credits": 2, "has_lab": False, "tw": 25, "pr_or": 0},
    ],
    6: [
        {"code": "CS601", "name": "Machine Learning & Pattern Recognition", "credits": 4, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "CS602", "name": "Cryptography & System Security", "credits": 4, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "CS603", "name": "Mobile Application Development", "credits": 3, "has_lab": False, "tw": 25, "pr_or": 0},
        {"code": "CS604", "name": "Cloud Computing & Virtualization", "credits": 3, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "CS605", "name": "Mini Project 2A", "credits": 2, "has_lab": True, "tw": 25, "pr_or": 25},
    ],
    7: [
        {"code": "CS701", "name": "Artificial Intelligence & Soft Computing", "credits": 4, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "CS702", "name": "Big Data Analytics & Engineering", "credits": 3, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "CS703", "name": "Natural Language Processing (Elective I)", "credits": 3, "has_lab": False, "tw": 25, "pr_or": 0},
        {"code": "CS704", "name": "Cyber Law & Information Security (Elective II)", "credits": 3, "has_lab": False, "tw": 25, "pr_or": 0},
        {"code": "CS705", "name": "Major Project - Stage I", "credits": 3, "has_lab": True, "tw": 50, "pr_or": 25},
    ],
    8: [
        {"code": "CS801", "name": "High Performance Computing", "credits": 4, "has_lab": False, "tw": 25, "pr_or": 0},
        {"code": "CS802", "name": "Deep Learning & Computer Vision", "credits": 3, "has_lab": True, "tw": 25, "pr_or": 25},
        {"code": "CS803", "name": "Blockchain & Distributed Ledgers (Elective III)", "credits": 3, "has_lab": False, "tw": 25, "pr_or": 0},
        {"code": "CS804", "name": "Major Project - Stage II & Industry Capstone", "credits": 6, "has_lab": True, "tw": 100, "pr_or": 50},
    ],
}


def get_curriculum_for_semester(sem: int) -> List[Dict[str, Any]]:
    """Return official course catalog for a given semester."""
    return SIES_GST_CURRICULUM.get(sem, SIES_GST_CURRICULUM[1])


def get_all_courses() -> List[Dict[str, Any]]:
    """Return flattened list of all curriculum courses."""
    res = []
    for sem, courses in SIES_GST_CURRICULUM.items():
        for c in courses:
            item = dict(c)
            item["semester"] = sem
            res.append(item)
    return res


def calculate_sies_grade_and_point(
    total_marks: float,
    max_marks: float = 100.0,
    is_failed: bool = False
) -> tuple[str, float]:
    """
    Official SIES GST Autonomous (Mumbai University CBCS) 10-Point Grading System:
    Reference: AIDS SEM-IV Gazette Result Sheet:
    - 80.00% to 100.00% : Grade 'O'  (Grade Point 10.0) - Outstanding
    - 75.00% to 79.99%  : Grade 'A+' (Grade Point 9.0)  - Excellent
    - 70.00% to 74.99%  : Grade 'A'  (Grade Point 8.0)  - Very Good
    - 60.00% to 69.99%  : Grade 'B+' (Grade Point 7.0)  - Good
    - 50.00% to 59.99%  : Grade 'B'  (Grade Point 6.0)  - Above Average
    - 45.00% to 49.99%  : Grade 'C'  (Grade Point 5.0)  - Average
    - 40.00% to 44.99%  : Grade 'P'  (Grade Point 4.0)  - Pass
    - Below 40.00% or Failed Head : Grade 'F' (Grade Point 0.0) - Fail
    """
    if is_failed:
        return ("F", 0.0)

    max_marks = float(max_marks) if max_marks and max_marks > 0 else 100.0
    pct = round((float(total_marks) / max_marks) * 100.0, 2)

    if pct < 40.0:
        return ("F", 0.0)
    elif pct >= 80.0:
        return ("O", 10.0)
    elif pct >= 75.0:
        return ("A+", 9.0)
    elif pct >= 70.0:
        return ("A", 8.0)
    elif pct >= 60.0:
        return ("B+", 7.0)
    elif pct >= 50.0:
        return ("B", 6.0)
    elif pct >= 45.0:
        return ("C", 5.0)
    else:
        return ("P", 4.0)

