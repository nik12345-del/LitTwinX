import base64
import json
import shutil
from html import escape
from io import BytesIO
from pathlib import Path

from PIL import Image as PILImage

from app.models import Analysis, Patient


ANALYSIS_DATA_DIR = (
    Path(__file__).resolve().parent.parent / "data" / "analyses"
)

IMAGE_FIELDS = {
    "original_image": "original.png",
    "mask_image": "mask.png",
    "overlay_image": "segmentation-overlay.png",
    "xai_overlay_image": "xai-overlay.png",
    "tumor_probability_heatmap": "tumor-probability.png",
    "uncertainty_heatmap": "uncertainty.png",
}


def _analysis_folder(analysis_id: int) -> Path:
    return ANALYSIS_DATA_DIR / str(analysis_id)


def save_analysis_images(analysis_id: int, result: dict) -> None:
    """Persist result images outside SQLite to keep the database compact."""
    folder = _analysis_folder(analysis_id)
    folder.mkdir(parents=True, exist_ok=True)

    try:
        for field, filename in IMAGE_FIELDS.items():
            data_uri = result.get(field)
            if not data_uri:
                continue
            encoded = data_uri.split(",", 1)[-1]
            (folder / filename).write_bytes(base64.b64decode(encoded))
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise


def delete_analysis_images(analysis_id: int) -> None:
    shutil.rmtree(_analysis_folder(analysis_id), ignore_errors=True)


def load_analysis_images(analysis_id: int) -> dict:
    folder = _analysis_folder(analysis_id)
    images = {}
    for field, filename in IMAGE_FIELDS.items():
        path = folder / filename
        if path.exists():
            encoded = base64.b64encode(path.read_bytes()).decode("utf-8")
            images[field] = f"data:image/png;base64,{encoded}"
    return images


def analysis_to_dict(
    analysis: Analysis,
    *,
    include_images: bool = False,
) -> dict:
    points = json.loads(analysis.xai_explanation_points_json or "[]")
    payload = {
        "analysis_id": analysis.id,
        "history_saved": True,
        "filename": analysis.filename,
        "patient_id": analysis.patient_id,
        "analyzed_for_patient_id": analysis.patient_id,
        "analyzed_by_user_id": analysis.analyzed_by_user_id,
        "scan_date": analysis.scan_date.isoformat(),
        "created_at": analysis.created_at.isoformat(),
        "tumor_detected": analysis.tumor_detected,
        "tumor_confidence": analysis.tumor_confidence,
        "peak_tumor_probability": analysis.peak_tumor_probability,
        "mean_uncertainty": analysis.mean_uncertainty,
        "tumor_percentage_of_liver": analysis.tumor_percentage_of_liver,
        "liver_pixel_count": analysis.liver_pixel_count,
        "tumor_pixel_count": analysis.tumor_pixel_count,
        "tumor_region_count": analysis.tumor_region_count,
        "largest_tumor_region_pixels": analysis.largest_tumor_region_pixels,
        "largest_region_equivalent_diameter_pixels": (
            analysis.largest_region_equivalent_diameter_pixels
        ),
        "tumor_location": analysis.tumor_location,
        "image_width": analysis.image_width,
        "image_height": analysis.image_height,
        "processed_width": 256,
        "processed_height": 256,
        "pixel_spacing_x_mm": analysis.pixel_spacing_x_mm,
        "pixel_spacing_y_mm": analysis.pixel_spacing_y_mm,
        "tumor_area_mm2": analysis.tumor_area_mm2,
        "largest_region_equivalent_diameter_mm": (
            analysis.largest_region_equivalent_diameter_mm
        ),
        "physical_size_available": analysis.tumor_area_mm2 is not None,
        "physical_size_status": (
            "2D estimate calculated from user-provided pixel spacing"
            if analysis.tumor_area_mm2 is not None
            else "Pixel spacing was not supplied; only pixel measurements are valid"
        ),
        "xai_method": analysis.xai_method,
        "xai_explanation": analysis.xai_explanation,
        "xai_explanation_points": points,
        "xai_limitations": analysis.xai_limitations,
        "model_scope": "LiTS CT liver/tumor segmentation",
        "tumor_subtype": analysis.tumor_subtype,
        "tumor_subtype_status": analysis.tumor_subtype_status,
        "progression_status": (
            "Observed change is available after at least two saved scans; "
            "future clinical risk prediction requires longitudinal outcome labels"
        ),
    }

    if analysis.patient is not None:
        payload["patient"] = {
            "id": analysis.patient.id,
            "patient_code": analysis.patient.patient_code,
            "full_name": analysis.patient.full_name,
            "age": analysis.patient.age,
            "sex": analysis.patient.sex,
        }
        payload["patient_name"] = analysis.patient.full_name
        payload["patient_age"] = analysis.patient.age
        payload["patient_gender"] = analysis.patient.sex

    if include_images:
        payload.update(load_analysis_images(analysis.id))

    return payload


def build_comparison(
    current: Analysis,
    previous: Analysis | None,
) -> dict:
    if previous is None:
        return {
            "available": False,
            "current_analysis_id": current.id,
            "message": "This is the first saved scan for this patient.",
            "trend": "baseline",
            "clinical_risk": "not_calculated",
            "limitations": (
                "Observed scan comparison is not a future-risk or clinical "
                "progression prediction."
            ),
        }

    pixel_delta = current.tumor_pixel_count - previous.tumor_pixel_count
    area_delta = round(
        current.tumor_percentage_of_liver
        - previous.tumor_percentage_of_liver,
        2,
    )
    largest_delta = (
        current.largest_tumor_region_pixels
        - previous.largest_tumor_region_pixels
    )

    threshold = max(3, round(previous.tumor_pixel_count * 0.05))
    if pixel_delta > threshold:
        trend = "increased"
    elif pixel_delta < -threshold:
        trend = "decreased"
    else:
        trend = "stable"

    if previous.tumor_pixel_count > 0:
        relative_change = round(
            (pixel_delta / previous.tumor_pixel_count) * 100.0,
            2,
        )
    else:
        relative_change = None

    physical_delta = None
    if (
        current.tumor_area_mm2 is not None
        and previous.tumor_area_mm2 is not None
    ):
        physical_delta = round(
            current.tumor_area_mm2 - previous.tumor_area_mm2,
            2,
        )

    return {
        "available": True,
        "current_analysis_id": current.id,
        "previous_analysis_id": previous.id,
        "current_scan_date": current.scan_date.isoformat(),
        "previous_scan_date": previous.scan_date.isoformat(),
        "current_tumor_pixels": current.tumor_pixel_count,
        "previous_tumor_pixels": previous.tumor_pixel_count,
        "tumor_pixel_change": pixel_delta,
        "tumor_pixel_relative_change_percent": relative_change,
        "tumor_area_within_liver_change_points": area_delta,
        "largest_region_pixel_change": largest_delta,
        "tumor_area_mm2_change": physical_delta,
        "trend": trend,
        "message": (
            f"The current processed-image tumor area is {trend} compared "
            "with the preceding saved scan."
        ),
        "clinical_risk": "not_calculated",
        "limitations": (
            "This is an observed 2D segmentation comparison. Different slice "
            "selection, crop, contrast or pixel spacing can change pixel counts; "
            "it is not a clinical progression diagnosis or future-risk score."
        ),
    }


def answer_analysis_question(
    question: str,
    analysis: Analysis,
    comparison: dict,
) -> str:
    """Grounded, deterministic assistant for questions about a saved result."""
    normalized = " ".join(question.lower().split())

    if any(word in normalized for word in ("type", "subtype", "hcc", "benign")):
        return (
            "This U-Net detects liver and tumor regions, but it cannot identify "
            "the tumor subtype. Tumor type is currently Not classified. A separate "
            "classifier trained and validated on labeled subtype images is required."
        )

    if any(word in normalized for word in ("size", "area", "diameter", "bada")):
        if analysis.tumor_area_mm2 is not None:
            return (
                f"For this 2D slice, the estimated tumor area is "
                f"{analysis.tumor_area_mm2:.2f} mm² and the largest-region "
                f"equivalent diameter is "
                f"{analysis.largest_region_equivalent_diameter_mm:.2f} mm. "
                "These values use the supplied pixel spacing and are not a 3D volume."
            )
        return (
            f"The model marked {analysis.tumor_pixel_count} tumor pixels; the "
            f"largest connected region contains "
            f"{analysis.largest_tumor_region_pixels} processed pixels with an "
            f"equivalent diameter of "
            f"{analysis.largest_region_equivalent_diameter_pixels:.2f} pixels. "
            "A physical mm/cm size needs correct scan pixel spacing, and a 3D "
            "volume needs the full DICOM/NIfTI series."
        )

    if any(word in normalized for word in ("previous", "compare", "change", "progress")):
        if not comparison.get("available"):
            return (
                "No previous saved scan is available for this patient yet. This "
                "scan is the baseline; add another dated scan to compare observed change."
            )
        delta = comparison["tumor_pixel_change"]
        return (
            f"Compared with the scan dated {comparison['previous_scan_date']}, "
            f"the processed tumor-pixel count is {comparison['trend']} "
            f"({delta:+d} pixels). {comparison['limitations']}"
        )

    if any(word in normalized for word in ("confidence", "sure", "probability")):
        return (
            f"Mean confidence inside predicted tumor pixels is "
            f"{analysis.tumor_confidence:.1f}%, and peak tumor-class probability "
            f"is {analysis.peak_tumor_probability:.1f}%. These are model scores, "
            "not the probability that the patient has cancer."
        )

    if any(word in normalized for word in ("uncertain", "uncertainty", "reliable")):
        return (
            f"Mean predictive uncertainty is {analysis.mean_uncertainty:.1f}%. "
            "The uncertainty heatmap highlights pixels where the three output "
            "classes were less clearly separated. Clinical reliability still "
            "requires radiologist review and external validation."
        )

    if any(word in normalized for word in ("where", "location", "kaha")):
        return (
            f"The largest predicted tumor region is in the "
            f"{analysis.tumor_location}. This is image-relative location only, "
            "not an anatomical liver-segment label."
        )

    if any(word in normalized for word in ("why", "explain", "xai", "reason")):
        return (
            f"{analysis.xai_explanation} The explanation uses "
            f"{analysis.xai_method.lower()}. {analysis.xai_limitations}"
        )

    if any(word in normalized for word in ("risk", "future", "month")):
        return (
            "A future clinical risk score is not calculated. The app can compare "
            "observed saved scans, but a validated 1/3/6-month prediction model "
            "needs longitudinal scans and labeled outcomes."
        )

    detected = "a tumor region" if analysis.tumor_detected else "no tumor region"
    return (
        f"This scan detected {detected}. Tumor pixels: "
        f"{analysis.tumor_pixel_count}; confidence: "
        f"{analysis.tumor_confidence:.1f}%; location: "
        f"{analysis.tumor_location}. You can ask about size, confidence, "
        "uncertainty, location, tumor type, XAI, or previous-scan comparison."
    )


def build_pdf_report(
    analysis: Analysis,
    patient: Patient,
    comparison: dict,
) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        Image,
        PageBreak,
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"LiTwinX analysis {analysis.id}",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "LiTwinXTitle",
        parent=styles["Title"],
        textColor=colors.HexColor("#D9534F"),
        alignment=TA_CENTER,
        spaceAfter=10,
    )
    heading = ParagraphStyle(
        "LiTwinXHeading",
        parent=styles["Heading2"],
        textColor=colors.HexColor("#8B1E1E"),
        spaceBefore=10,
        spaceAfter=7,
    )
    warning = ParagraphStyle(
        "LiTwinXWarning",
        parent=styles["BodyText"],
        textColor=colors.HexColor("#7A5900"),
        backColor=colors.HexColor("#FFF7D6"),
        borderPadding=8,
        leading=15,
    )

    story = [
        Paragraph("LiTwinX Liver CT Analysis Report", title_style),
        Paragraph(
            "Research segmentation and explainable-AI prototype",
            styles["BodyText"],
        ),
        Spacer(1, 6),
        Paragraph("Patient and scan", heading),
    ]

    patient_data = [
        ["Patient ID", escape(patient.patient_code), "Analysis ID", str(analysis.id)],
        ["Name", escape(patient.full_name), "Scan date", analysis.scan_date.isoformat()],
        ["Age", str(patient.age), "Sex", escape(patient.sex)],
        ["Filename", escape(analysis.filename), "Created", analysis.created_at.isoformat()],
    ]
    patient_table = Table(patient_data, colWidths=[28 * mm, 55 * mm, 28 * mm, 55 * mm])
    patient_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#BBBBBB")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F0F0F0")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F0F0F0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.extend([patient_table, Paragraph("Segmentation metrics", heading)])

    size_value = (
        f"{analysis.tumor_area_mm2:.2f} mm² (2D estimate)"
        if analysis.tumor_area_mm2 is not None
        else "Physical size unavailable; pixel spacing not supplied"
    )
    metrics = [
        ["Tumor region detected", "Yes" if analysis.tumor_detected else "No"],
        ["Tumor confidence", f"{analysis.tumor_confidence:.1f}% (model score)"],
        ["Peak tumor probability", f"{analysis.peak_tumor_probability:.1f}%"],
        ["Mean uncertainty", f"{analysis.mean_uncertainty:.1f}%"],
        ["Tumor area within liver", f"{analysis.tumor_percentage_of_liver:.2f}%"],
        ["Tumor pixels (processed image)", str(analysis.tumor_pixel_count)],
        ["Connected tumor regions", str(analysis.tumor_region_count)],
        ["Largest region", f"{analysis.largest_tumor_region_pixels} processed pixels"],
        ["Image-relative location", escape(analysis.tumor_location)],
        ["Physical 2D area", size_value],
        ["Tumor subtype", "Not classified — separate labeled model required"],
    ]
    metrics_table = Table(metrics, colWidths=[67 * mm, 99 * mm])
    metrics_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#CCCCCC")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F5F5F5")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(metrics_table)

    xai_path = _analysis_folder(analysis.id) / IMAGE_FIELDS["xai_overlay_image"]
    if xai_path.exists():
        story.extend([Paragraph("Explainable-AI visualization", heading)])
        with PILImage.open(xai_path) as image:
            width, height = image.size
        max_width = 155 * mm
        max_height = 95 * mm
        scale = min(max_width / width, max_height / height)
        story.append(Image(str(xai_path), width=width * scale, height=height * scale))

    story.extend(
        [
            Paragraph("Why the model produced this result", heading),
            Paragraph(escape(analysis.xai_explanation), styles["BodyText"]),
            Spacer(1, 5),
        ]
    )
    for point in json.loads(analysis.xai_explanation_points_json or "[]"):
        story.append(Paragraph(f"• {escape(str(point))}", styles["BodyText"]))

    story.extend([Paragraph("Previous vs current scan", heading)])
    if comparison.get("available"):
        story.append(
            Paragraph(
                escape(
                    f"Previous date: {comparison['previous_scan_date']}; "
                    f"current date: {comparison['current_scan_date']}; "
                    f"observed tumor-pixel trend: {comparison['trend']}; "
                    f"change: {comparison['tumor_pixel_change']:+d} pixels."
                ),
                styles["BodyText"],
            )
        )
    else:
        story.append(Paragraph(escape(comparison["message"]), styles["BodyText"]))

    story.extend(
        [
            Paragraph("Limitations", heading),
            Paragraph(escape(analysis.xai_limitations), styles["BodyText"]),
            Spacer(1, 8),
            Paragraph(
                "Research prototype only. Results are not clinically validated "
                "and must not replace a radiologist's diagnosis. Tumor subtype, "
                "3D volume and future clinical risk are not produced by this model.",
                warning,
            ),
        ]
    )

    document.build(story)
    return buffer.getvalue()
