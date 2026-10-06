"""
SQLAlchemy ORM models - SIES GST Academic Risk, Credit & Progression EWS.

is_demo flag on StudentProfile separates synthetic seed data from real student records.
"""
import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime,
    ForeignKey, Enum as SAEnum, Text, Date, UniqueConstraint, JSON
)
from sqlalchemy.orm import relationship
from app.db.base import Base


# -- Enums -------------------------------------------------------------------

class UserRole(str, enum.Enum):
    admin = "admin"
    faculty = "faculty"
    mentor = "mentor"
    student = "student"


class UserStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"


class RiskLevel(str, enum.Enum):
    low = "LOW"
    medium = "MEDIUM"
    high = "HIGH"
    critical = "CRITICAL"


class AcademicStatus(str, enum.Enum):
    clear = "CLEAR"
    academic_risk = "ACADEMIC_RISK"
    high_risk = "HIGH_RISK"
    critical_risk = "CRITICAL_RISK"
    attendance_blocked = "ATTENDANCE_BLOCKED"
    progression_blocked = "PROGRESSION_BLOCKED"
    regulation_unresolved = "REGULATION_UNRESOLVED"


class AttendanceStatus(str, enum.Enum):
    compliant = "COMPLIANT"
    at_risk = "AT_RISK"
    blocked = "BLOCKED"


class InterventionType(str, enum.Enum):
    ATTENDANCE_PLAN = "ATTENDANCE_PLAN"
    BACKLOG_PLAN = "BACKLOG_PLAN"
    CREDIT_RECOVERY_PLAN = "CREDIT_RECOVERY_PLAN"
    ASSIGNMENT_SUPPORT = "ASSIGNMENT_SUPPORT"
    MENTOR_REVIEW = "MENTOR_REVIEW"


class InterventionStatus(str, enum.Enum):
    pending = "PENDING"
    assigned = "ASSIGNED"
    in_progress = "IN_PROGRESS"
    completed = "COMPLETED"
    follow_up = "FOLLOW_UP"


class InterventionPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


# -- Models ------------------------------------------------------------------

class User(Base):
    """All authenticated users across all roles."""
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), nullable=False)
    status = Column(SAEnum(UserStatus), default=UserStatus.active, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    student_profile = relationship("StudentProfile", back_populates="user",
                                   foreign_keys="StudentProfile.user_id", uselist=False)
    mentored_students = relationship("StudentProfile", back_populates="mentor",
                                     foreign_keys="StudentProfile.mentor_id")
    taught_courses = relationship("Course", back_populates="faculty")
    intervention_updates = relationship("InterventionUpdate", back_populates="actor")

    def __repr__(self):
        return f"<User id={self.id} email={self.email} role={self.role}>"


class StudentProfile(Base):
    """Student identity with academic profile details."""
    __tablename__ = "student_profiles"
    student_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    roll_no = Column(String(50), unique=True, nullable=False, index=True)
    program = Column(String(100), nullable=False)
    semester = Column(Integer, nullable=False, default=1)
    mentor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_demo = Column(Boolean, default=False, nullable=False,
                     comment="True for synthetic seed data")
    created_at = Column(DateTime, default=datetime.utcnow)
    # SIES GST fields (nullable for backward compat)
    branch = Column(String(100), nullable=True)
    admission_year = Column(Integer, nullable=True)
    current_year = Column(Integer, nullable=True)
    regulation = Column(String(20), nullable=True)
    academic_status = Column(String(30), nullable=True, default="CLEAR")

    user = relationship("User", back_populates="student_profile", foreign_keys=[user_id])
    mentor = relationship("User", back_populates="mentored_students", foreign_keys=[mentor_id])
    academic_records = relationship("AcademicRecord", back_populates="student",
                                    order_by="AcademicRecord.recorded_at")
    credit_records = relationship("CreditRecord", back_populates="student")
    risk_history = relationship("RiskHistory", back_populates="student",
                                order_by="RiskHistory.calculated_at")
    interventions = relationship("Intervention", back_populates="student")
    faculty_assignments = relationship("StudentFaculty", back_populates="student")
    course_results = relationship("CourseResult", back_populates="student")
    progression_evaluations = relationship("ProgressionEvaluation", back_populates="student")

    def __repr__(self):
        return f"<StudentProfile roll_no={self.roll_no} program={self.program}>"


class Course(Base):
    """Course configuration assigned to a faculty member."""
    __tablename__ = "courses"
    course_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    credits = Column(Integer, nullable=False, default=3)
    semester = Column(Integer, nullable=False)
    faculty_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    faculty = relationship("User", back_populates="taught_courses")
    student_assignments = relationship("StudentFaculty", back_populates="course")

    def __repr__(self):
        return f"<Course code={self.code} name={self.name}>"


class StudentFaculty(Base):
    """Junction table: which students a faculty member teaches in which course."""
    __tablename__ = "student_faculty"
    __table_args__ = (
        UniqueConstraint("student_id", "faculty_id", "course_id",
                         name="uq_student_faculty_course"),
    )
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student_profiles.student_id"), nullable=False)
    faculty_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    course_id = Column(Integer, ForeignKey("courses.course_id"), nullable=False)
    assigned_at = Column(DateTime, default=datetime.utcnow)
    student = relationship("StudentProfile", back_populates="faculty_assignments")
    course = relationship("Course", back_populates="student_assignments")

    def __repr__(self):
        return f"<StudentFaculty student={self.student_id} course={self.course_id}>"


class AcademicRecord(Base):
    """Time-varying academic inputs per student per term."""
    __tablename__ = "academic_records"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student_profiles.student_id"),
                        nullable=False, index=True)
    term = Column(String(50), nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow, nullable=True)
    attendance = Column(Float, nullable=True)
    marks = Column(Float, nullable=True)
    gpa = Column(Float, nullable=True)
    assignment_completion = Column(Float, nullable=True)
    failed_subjects = Column(Integer, nullable=True, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    source = Column(String(50), default="manual")
    # SIES GST extended fields (all nullable for backward compat)
    ise_marks = Column(Float, nullable=True)
    mse_marks = Column(Float, nullable=True)
    ese_marks = Column(Float, nullable=True)
    failed_heads = Column(Integer, nullable=True, default=0)
    ese_failed_heads = Column(Integer, nullable=True, default=0)
    previous_backlogs = Column(Integer, nullable=True, default=0)
    previous_failed_heads = Column(Integer, nullable=True, default=0)
    previous_ese_failed_heads = Column(Integer, nullable=True, default=0)
    backlog_credits = Column(Float, nullable=True, default=0.0)

    student = relationship("StudentProfile", back_populates="academic_records")

    def __repr__(self):
        return f"<AcademicRecord student={self.student_id} term={self.term}>"


class CourseResult(Base):
    """Per-course result for a student in a semester."""
    __tablename__ = "course_results"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student_profiles.student_id"),
                        nullable=False, index=True)
    semester = Column(Integer, nullable=False)
    course_code = Column(String(50), nullable=False)
    course_name = Column(String(255), nullable=True)
    credits = Column(Integer, nullable=False, default=3)
    ise_marks = Column(Float, nullable=True)
    mse_marks = Column(Float, nullable=True)
    ese_marks = Column(Float, nullable=True)
    total_marks = Column(Float, nullable=True)
    percentage = Column(Float, nullable=True)
    grade = Column(String(5), nullable=True)
    grade_point = Column(Float, nullable=True)
    is_failed = Column(Boolean, default=False)
    is_ese_failed = Column(Boolean, default=False)
    attendance_percentage = Column(Float, nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow)
    student = relationship("StudentProfile", back_populates="course_results")

    def __repr__(self):
        return f"<CourseResult student={self.student_id} course={self.course_code}>"


class CreditRecord(Base):
    """Credit progress per student per period. Computed by credit engine."""
    __tablename__ = "credit_records"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student_profiles.student_id"),
                        nullable=False, index=True)
    period = Column(String(50), nullable=False)
    earned_credits = Column(Float, nullable=False, default=0.0)
    expected_credits = Column(Float, nullable=False, default=0.0)
    required_credits = Column(Float, nullable=False, default=0.0)
    deficit = Column(Float, nullable=False, default=0.0)
    calculated_at = Column(DateTime, default=datetime.utcnow)
    # SIES GST extended fields
    backlog_credits = Column(Float, nullable=True, default=0.0)
    credit_completion_pct = Column(Float, nullable=True)
    credit_gap = Column(Float, nullable=True)
    student = relationship("StudentProfile", back_populates="credit_records")

    def __repr__(self):
        return f"<CreditRecord student={self.student_id} period={self.period}>"


class RiskHistory(Base):
    """Append-only risk snapshots. NEVER overwrite a previous score."""
    __tablename__ = "risk_history"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student_profiles.student_id"),
                        nullable=False, index=True)
    calculated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    probability = Column(Float, nullable=False)
    risk_level = Column(SAEnum(RiskLevel), nullable=False)
    model_version = Column(String(50), nullable=False, default="dropout-v1")
    week = Column(Integer, nullable=True)
    risk_type = Column(String(10), nullable=True, default="ML")
    student = relationship("StudentProfile", back_populates="risk_history")

    def __repr__(self):
        return f"<RiskHistory student={self.student_id} prob={self.probability} level={self.risk_level}>"


class ProgressionEvaluation(Base):
    """Audit log for every official progression calculation."""
    __tablename__ = "progression_evaluations"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student_profiles.student_id"),
                        nullable=False, index=True)
    regulation_code = Column(String(20), nullable=False)
    rule_version = Column(String(50), nullable=True)
    evaluation_inputs = Column(JSON, nullable=True)
    evaluation_outputs = Column(JSON, nullable=True)
    evaluated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    student = relationship("StudentProfile", back_populates="progression_evaluations")

    def __repr__(self):
        return f"<ProgressionEvaluation student={self.student_id} reg={self.regulation_code}>"


class Intervention(Base):
    """Action plan triggered by the intervention engine."""
    __tablename__ = "interventions"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("student_profiles.student_id"),
                        nullable=False, index=True)
    type = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    priority = Column(String(20), default='MEDIUM')
    due_date = Column(Date, nullable=True)
    status = Column(SAEnum(InterventionStatus),
                    default=InterventionStatus.pending, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    student = relationship("StudentProfile", back_populates="interventions")
    assigned_user = relationship("User", foreign_keys=[assigned_to])
    updates = relationship("InterventionUpdate", back_populates="intervention",
                           order_by="InterventionUpdate.updated_at")

    def __repr__(self):
        return f"<Intervention id={self.id} type={self.type} status={self.status}>"


class InterventionUpdate(Base):
    """Audit trail for every status change / note on an intervention."""
    __tablename__ = "intervention_updates"
    id = Column(Integer, primary_key=True, index=True)
    intervention_id = Column(Integer, ForeignKey("interventions.id"),
                             nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    status = Column(SAEnum(InterventionStatus), nullable=True)
    note = Column(Text, nullable=True)
    outcome = Column(Text, nullable=True)
    intervention = relationship("Intervention", back_populates="updates")
    actor = relationship("User", back_populates="intervention_updates")

    def __repr__(self):
        return f"<InterventionUpdate intervention={self.intervention_id} actor={self.actor_id}>"
