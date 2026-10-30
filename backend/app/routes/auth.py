from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.dependencies import get_current_user
from app import models


from app.database import get_db
from app.models import User
from app.schemas import (
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
)
from app.security import (
    create_access_token,
    hash_password,
    verify_password,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"]
)


@router.post(
    "/signup",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED
)
def signup(
    user_data: UserCreate,
    database: Session = Depends(get_db)
):
    normalized_email = user_data.email.lower()

    existing_user = database.scalar(
        select(User).where(User.email == normalized_email)
    )

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists"
        )

    if user_data.professional_id:
        existing_professional_id = database.scalar(
            select(User).where(
                User.professional_id == user_data.professional_id
            )
        )

        if existing_professional_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Professional ID already exists"
            )

    new_user = User(
        full_name=user_data.full_name,
        professional_id=user_data.professional_id,
        email=normalized_email,
        password_hash=hash_password(user_data.password)
    )

    database.add(new_user)
    database.commit()
    database.refresh(new_user)

    return new_user


@router.post(
    "/login",
    response_model=TokenResponse
)
def login(
    login_data: UserLogin,
    database: Session = Depends(get_db)
):
    normalized_email = login_data.email.lower()

    user = database.scalar(
        select(User).where(User.email == normalized_email)
    )

    if user is None or not verify_password(
        login_data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    access_token = create_access_token(user.id)

    return TokenResponse(
        access_token=access_token
    )
@router.get("/me", response_model=UserResponse)
def get_logged_in_user(
    current_user: models.User = Depends(get_current_user),
):
    return current_user