import sys
from pathlib import Path

# Add current directory to path if run standalone
cur_dir = str(Path(__file__).resolve().parent)
if cur_dir not in sys.path:
    sys.path.insert(0, cur_dir)

try:
    from .sies_gst import SIES_GST_CURRICULUM, get_curriculum_for_semester, get_all_courses
except (ImportError, ValueError):
    from sies_gst import SIES_GST_CURRICULUM, get_curriculum_for_semester, get_all_courses

if __name__ == "__main__":
    courses = get_all_courses()
    print(f"SIES GST Autonomous Curriculum loaded successfully: {len(courses)} courses across 8 semesters.")
    for sem in range(1, 9):
        sem_c = get_curriculum_for_semester(sem)
        print(f"  Semester {sem}: {len(sem_c)} subjects ({', '.join(c['code'] for c in sem_c)})")
