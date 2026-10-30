from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    full_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    professional_id: Mapped[str | None] = mapped_column(
        String(50),
        unique=True,
        nullable=True
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    role: Mapped[str] = mapped_column(
        String(30),
        default="researcher",
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )

    patients: Mapped[list["Patient"]] = relationship(
        back_populates="created_by",
        cascade="all, delete-orphan"
    )

    analyses: Mapped[list["Analysis"]] = relationship(
        back_populates="analyzed_by",
        cascade="all, delete-orphan",
    )


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    patient_code: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False
    )

    full_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    age: Mapped[int] = mapped_column(nullable=False)

    sex: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    created_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc)
    )

    created_by: Mapped["User"] = relationship(
        back_populates="patients"
    )

    analyses: Mapped[list["Analysis"]] = relationship(
        back_populates="patient",
        cascade="all, delete-orphan",
    )


class Analysis(Base):
    """A saved, patient-linked result from one CT image."""

    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    patient_id: Mapped[int] = mapped_column(
        ForeignKey("patients.id"),
        index=True,
        nullable=False,
    )
    analyzed_by_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        index=True,
        nullable=False,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    scan_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    tumor_detected: Mapped[bool] = mapped_column(Boolean, nullable=False)
    tumor_confidence: Mapped[float] = mapped_column(Float, nullable=False)
    peak_tumor_probability: Mapped[float] = mapped_column(Float, nullable=False)
    mean_uncertainty: Mapped[float] = mapped_column(Float, nullable=False)
    tumor_percentage_of_liver: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    liver_pixel_count: Mapped[int] = mapped_column(nullable=False)
    tumor_pixel_count: Mapped[int] = mapped_column(nullable=False)
    tumor_region_count: Mapped[int] = mapped_column(nullable=False)
    largest_tumor_region_pixels: Mapped[int] = mapped_column(nullable=False)
    largest_region_equivalent_diameter_pixels: Mapped[float] = mapped_column(
        Float,
        nullable=False,
    )
    tumor_location: Mapped[str] = mapped_column(String(100), nullable=False)

    image_width: Mapped[int] = mapped_column(nullable=False)
    image_height: Mapped[int] = mapped_column(nullable=False)
    pixel_spacing_x_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    pixel_spacing_y_mm: Mapped[float | None] = mapped_column(Float, nullable=True)
    tumor_area_mm2: Mapped[float | None] = mapped_column(Float, nullable=True)
    largest_region_equivalent_diameter_mm: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )

    xai_method: Mapped[str] = mapped_column(String(255), nullable=False)
    xai_explanation: Mapped[str] = mapped_column(Text, nullable=False)
    xai_explanation_points_json: Mapped[str] = mapped_column(Text, nullable=False)
    xai_limitations: Mapped[str] = mapped_column(Text, nullable=False)
    tumor_subtype: Mapped[str] = mapped_column(String(100), nullable=False)
    tumor_subtype_status: Mapped[str] = mapped_column(Text, nullable=False)

    patient: Mapped["Patient"] = relationship(back_populates="analyses")
    analyzed_by: Mapped["User"] = relationship(back_populates="analyses")
