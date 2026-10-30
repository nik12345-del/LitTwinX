import json
import logging
import math
from datetime import date
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app.analysis_service import (
    analysis_to_dict,
    answer_analysis_question,
    build_comparison,
    build_pdf_report,
    delete_analysis_images,
    save_analysis_images,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.inference import analyze_uploaded_image
from app.models import Analysis, Patient, User
from app.schemas import AnalysisQuestion, AnalysisQuestionResponse


logger = logging.getLogger(__name__)

router = APIRouter(tags=["Analysis"])

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
MAX_FILE_SIZE = 20 * 1024 * 1024


def _owned_patient(db: Session, patient_id: int, user_id: int) -> Patient:
    patient = db.scalar(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.created_by_user_id == user_id,
        )
    )
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )
    return patient


def _owned_analysis(db: Session, analysis_id: int, user_id: int) -> Analysis:
    analysis = db.scalar(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.analyzed_by_user_id == user_id,
        )
    )
    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found",
        )
    return analysis


def _previous_analysis(db: Session, current: Analysis) -> Analysis | None:
    analyses = list(
        db.scalars(
            select(Analysis)
            .where(Analysis.patient_id == current.patient_id)
            .order_by(
                Analysis.scan_date.desc(),
                Analysis.created_at.desc(),
                Analysis.id.desc(),
            )
        ).all()
    )
    for index, analysis in enumerate(analyses):
        if analysis.id == current.id:
            return analyses[index + 1] if index + 1 < len(analyses) else None
    return None


def _parse_scan_date(value: str | None) -> date:
    if not value:
        return date.today()
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="scan_date must use YYYY-MM-DD format",
        ) from error


def _validate_spacing(
    spacing_x: float | None,
    spacing_y: float | None,
) -> tuple[float | None, float | None]:
    if (spacing_x is None) != (spacing_y is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Provide both pixel spacing values or leave both blank",
        )
    if spacing_x is not None and (
        spacing_x <= 0 or spacing_y <= 0 or spacing_x > 20 or spacing_y > 20
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Pixel spacing must be greater than 0 and at most 20 mm",
        )
    return spacing_x, spacing_y


@router.post("/analyze")
async def analyze_ct_image(
    file: UploadFile = File(...),
    patient_id: int = Form(...),
    scan_date: str | None = Form(default=None),
    pixel_spacing_x_mm: float | None = Form(default=None),
    pixel_spacing_y_mm: float | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    patient = _owned_patient(db, patient_id, current_user.id)
    parsed_scan_date = _parse_scan_date(scan_date)
    spacing_x, spacing_y = _validate_spacing(
        pixel_spacing_x_mm,
        pixel_spacing_y_mm,
    )

    filename = file.filename or "uploaded-image"
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PNG and JPEG CT images are supported currently",
        )

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size must be 20 MB or less",
        )

    try:
        result = await run_in_threadpool(analyze_uploaded_image, file_bytes)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
    except Exception as error:
        logger.exception("Model inference failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model inference failed: {type(error).__name__}",
        ) from error

    tumor_area_mm2 = None
    diameter_mm = None
    if spacing_x is not None and spacing_y is not None:
        pixel_area = spacing_x * spacing_y
        tumor_area_mm2 = round(
            float(result["original_tumor_pixel_count"]) * pixel_area,
            2,
        )
        largest_area = (
            float(result["largest_tumor_region_original_pixels"]) * pixel_area
        )
        diameter_mm = round(2.0 * math.sqrt(largest_area / math.pi), 2)

    analysis = Analysis(
        patient_id=patient.id,
        analyzed_by_user_id=current_user.id,
        filename=filename,
        scan_date=parsed_scan_date,
        tumor_detected=bool(result["tumor_detected"]),
        tumor_confidence=float(result["tumor_confidence"]),
        peak_tumor_probability=float(result["peak_tumor_probability"]),
        mean_uncertainty=float(result["mean_uncertainty"]),
        tumor_percentage_of_liver=float(result["tumor_percentage_of_liver"]),
        liver_pixel_count=int(result["liver_pixel_count"]),
        tumor_pixel_count=int(result["tumor_pixel_count"]),
        tumor_region_count=int(result["tumor_region_count"]),
        largest_tumor_region_pixels=int(result["largest_tumor_region_pixels"]),
        largest_region_equivalent_diameter_pixels=float(
            result["largest_region_equivalent_diameter_pixels"]
        ),
        tumor_location=str(result["tumor_location"]),
        image_width=int(result["image_width"]),
        image_height=int(result["image_height"]),
        pixel_spacing_x_mm=spacing_x,
        pixel_spacing_y_mm=spacing_y,
        tumor_area_mm2=tumor_area_mm2,
        largest_region_equivalent_diameter_mm=diameter_mm,
        xai_method=str(result["xai_method"]),
        xai_explanation=str(result["xai_explanation"]),
        xai_explanation_points_json=json.dumps(
            result["xai_explanation_points"]
        ),
        xai_limitations=str(result["xai_limitations"]),
        tumor_subtype=str(result["tumor_subtype"]),
        tumor_subtype_status=str(result["tumor_subtype_status"]),
    )

    try:
        db.add(analysis)
        db.flush()
        save_analysis_images(analysis.id, result)
        db.commit()
        db.refresh(analysis)
    except Exception as error:
        db.rollback()
        if analysis.id is not None:
            delete_analysis_images(analysis.id)
        logger.exception("Could not save analysis history")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Analysis completed but history could not be saved",
        ) from error

    payload = analysis_to_dict(analysis, include_images=True)
    payload["comparison"] = build_comparison(
        analysis,
        _previous_analysis(db, analysis),
    )
    return payload


@router.get("/api/patients/{patient_id}/analyses")
def get_patient_analyses(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _owned_patient(db, patient_id, current_user.id)
    analyses = db.scalars(
        select(Analysis)
        .where(
            Analysis.patient_id == patient_id,
            Analysis.analyzed_by_user_id == current_user.id,
        )
        .order_by(
            Analysis.scan_date.desc(),
            Analysis.created_at.desc(),
            Analysis.id.desc(),
        )
    ).all()
    return [analysis_to_dict(item) for item in analyses]


@router.get("/api/analyses/{analysis_id}")
def get_analysis(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analysis = _owned_analysis(db, analysis_id, current_user.id)
    payload = analysis_to_dict(analysis, include_images=True)
    payload["comparison"] = build_comparison(
        analysis,
        _previous_analysis(db, analysis),
    )
    return payload


@router.get("/api/analyses/{analysis_id}/comparison")
def get_analysis_comparison(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analysis = _owned_analysis(db, analysis_id, current_user.id)
    return build_comparison(analysis, _previous_analysis(db, analysis))


@router.post(
    "/api/analyses/{analysis_id}/ask",
    response_model=AnalysisQuestionResponse,
)
def ask_about_analysis(
    analysis_id: int,
    question_data: AnalysisQuestion,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analysis = _owned_analysis(db, analysis_id, current_user.id)
    comparison = build_comparison(analysis, _previous_analysis(db, analysis))
    return AnalysisQuestionResponse(
        analysis_id=analysis.id,
        question=question_data.question,
        answer=answer_analysis_question(
            question_data.question,
            analysis,
            comparison,
        ),
        safety_note=(
            "Research explanation only; this response is not a clinical diagnosis."
        ),
    )


@router.get("/api/analyses/{analysis_id}/report.pdf")
def download_analysis_report(
    analysis_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analysis = _owned_analysis(db, analysis_id, current_user.id)
    comparison = build_comparison(analysis, _previous_analysis(db, analysis))
    try:
        pdf_bytes = build_pdf_report(analysis, analysis.patient, comparison)
    except ImportError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PDF support is not installed. Run: pip install reportlab",
        ) from error

    safe_code = "".join(
        character
        for character in analysis.patient.patient_code
        if character.isalnum() or character in ("-", "_")
    )
    filename = f"LiTwinX-{safe_code}-analysis-{analysis.id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
