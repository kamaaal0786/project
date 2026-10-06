"""
Pydantic schemas for student endpoints.
"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.db.models import UserStatus


class StudentCreate(BaseModel):
    """Admin creates a new student - creates both User + StudentProfile rows."""
    email: EmailStr
    name: str
    password: str
    roll_no: str
    program: str
    semester: int = 1
    mentor_id: Optional[int] = None
    is_demo: bool = False
    branch: Optional[str] = None
    admission_year: Optional[int] = None
    current_year: Optional[int] = None
    regulation: Optional[str] = None


class StudentProfileResponse(BaseModel):
    student_id: int
    roll_no: str
    program: str
    semester: int
    mentor_id: Optional[int]
    is_demo: bool
    branch: Optional[str]
    admission_year: Optional[int]
    current_year: Optional[int]
    regulation: Optional[str]
    academic_status: Optional[str]

    class Config:
        from_attributes = True


class StudentDetailResponse(BaseModel):
    """Combined user + profile response."""
    id: int           # user id
    email: str
    name: str
    role: str
    status: str
    student_id: int
    roll_no: str
    program: str
    semester: int
    mentor_id: Optional[int]
    is_demo: bool
    latest_risk_level: Optional[str] = None
    
    # SIES GST fields
    branch: Optional[str] = None
    admission_year: Optional[int] = None
    current_year: Optional[int] = None
    regulation: Optional[str] = None
    academic_status: Optional[str] = None
    
    # We will pass the latest academic record here so the frontend can populate the form
    latest_academic_record: Optional[dict] = None

    class Config:
        from_attributes = True


class StudentListItem(BaseModel):
    user_id: int
    student_id: int
    name: str
    email: str
    roll_no: str
    program: str
    semester: int
    status: str

    class Config:
        from_attributes = True
