from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Patient, User
from app.schemas import PatientCreate, PatientResponse


router = APIRouter(
    prefix="/api/patients",
    tags=["Patients"],
)


@router.post(
    "",
    response_model=PatientResponse,
    status_code=status.HTTP_201_CREATED,
)

@router.post(
    "",
    response_model=PatientResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_patient(
    patient_data: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient_code = f"LT-{(db.scalar(select(Patient.id).order_by(Patient.id.desc()).limit(1)) or 0) + 1:04d}"

    while db.scalar(
        select(Patient.id).where(Patient.patient_code == patient_code)
    ) is not None:
        last_id = db.scalar(
            select(Patient.id).order_by(Patient.id.desc()).limit(1)
        ) or 0
        patient_code = f"LT-{last_id + 1:04d}"

    patient = Patient(
        patient_code=patient_code,
        full_name=patient_data.full_name,
        age=patient_data.age,
        sex=patient_data.sex,
        created_by_user_id=current_user.id,
    )

    db.add(patient)
    db.commit()
    db.refresh(patient)

    return patient



@router.get("", response_model=list[PatientResponse])
def get_patients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    statement = (
        select(Patient)
        .where(Patient.created_by_user_id == current_user.id)
        .order_by(Patient.created_at.desc())
    )

    return list(db.scalars(statement).all())


@router.get("/{patient_id}", response_model=PatientResponse)
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = db.scalar(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.created_by_user_id == current_user.id,
        )
    )

    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )

    return patient