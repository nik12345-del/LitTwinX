from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    full_name: str = Field(min_length=2, max_length=100)
    professional_id: str | None = Field(default=None, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    professional_id: str | None
    email: EmailStr
    role: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PatientCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    patient_code: str | None = Field(default=None, min_length=3, max_length=50)
    full_name: str = Field(min_length=2, max_length=100)
    age: int = Field(ge=1, le=120)
    sex: Literal["Male", "Female", "Other"]


class PatientResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    patient_code: str
    full_name: str
    age: int
    sex: str
    created_by_user_id: int
    created_at: datetime


class AnalysisQuestion(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    question: str = Field(min_length=2, max_length=500)


class AnalysisQuestionResponse(BaseModel):
    analysis_id: int
    question: str
    answer: str
    safety_note: str
