import base64
import os
from collections import deque
from functools import lru_cache
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import tensorflow as tf


MODEL_PATH = (
    Path(__file__).resolve().parent.parent
    / "models"
    / "litwinx_lits_unet.keras"
)

MODEL_IMAGE_SIZE = (256, 256)
NUMBER_OF_CLASSES = 3
DISPLAY_GAMMA = 0.35


@lru_cache(maxsize=1)
def get_segmentation_model():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Model file not found: {MODEL_PATH}")

    return tf.keras.models.load_model(MODEL_PATH, compile=False)


def encode_png(image: Image.Image) -> str:
    buffer = BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    encoded_image = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return "data:image/png;base64," + encoded_image


def colorize_heatmap(values: np.ndarray) -> np.ndarray:
    """Convert a [0, 1] map to a blue-yellow-red RGB heatmap."""
    values = np.clip(values.astype(np.float32), 0.0, 1.0)

    red = np.clip(1.5 - np.abs((4.0 * values) - 3.0), 0.0, 1.0)
    green = np.clip(1.5 - np.abs((4.0 * values) - 2.0), 0.0, 1.0)
    blue = np.clip(1.5 - np.abs((4.0 * values) - 1.0), 0.0, 1.0)

    heatmap = np.stack([red, green, blue], axis=-1)
    heatmap[values < 0.03] = 0.0
    return (heatmap * 255.0).astype(np.uint8)


def create_segmentation_overlay(
    grayscale_image: np.ndarray,
    predicted_mask: np.ndarray,
) -> np.ndarray:
    image_rgb = np.stack([grayscale_image] * 3, axis=-1).astype(np.float32)
    overlay = image_rgb.copy()

    liver_pixels = predicted_mask == 1
    tumor_pixels = predicted_mask == 2

    overlay[liver_pixels] = (
        0.55 * image_rgb[liver_pixels]
        + 0.45 * np.array([0, 255, 0], dtype=np.float32)
    )
    overlay[tumor_pixels] = (
        0.25 * image_rgb[tumor_pixels]
        + 0.75 * np.array([255, 0, 0], dtype=np.float32)
    )

    return np.clip(overlay, 0, 255).astype(np.uint8)


def create_xai_overlay(
    grayscale_image: np.ndarray,
    colored_heatmap: np.ndarray,
    display_probability_map: np.ndarray,
) -> np.ndarray:
    """Blend the tumor probability explanation over the CT image."""
    image_rgb = np.stack([grayscale_image] * 3, axis=-1).astype(np.float32)
    heatmap = colored_heatmap.astype(np.float32)

    alpha = np.clip(
        (display_probability_map - 0.02) / 0.98,
        0.0,
        1.0,
    )
    alpha = (0.75 * alpha)[..., np.newaxis]

    overlay = ((1.0 - alpha) * image_rgb) + (alpha * heatmap)
    return np.clip(overlay, 0, 255).astype(np.uint8)


def resize_float_map(values: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    float_image = Image.fromarray(values.astype(np.float32), mode="F")
    resized = float_image.resize(size, Image.Resampling.BILINEAR)
    return np.clip(np.asarray(resized, dtype=np.float32), 0.0, 1.0)


def describe_tumor_regions(
    predicted_mask: np.ndarray,
) -> dict:
    """Measure connected tumor regions without claiming a physical size."""
    tumor_mask = predicted_mask == 2
    visited = np.zeros_like(tumor_mask, dtype=bool)
    regions = []
    height, width = tumor_mask.shape
    neighbors = (
        (-1, -1),
        (-1, 0),
        (-1, 1),
        (0, -1),
        (0, 1),
        (1, -1),
        (1, 0),
        (1, 1),
    )

    for start_y, start_x in np.argwhere(tumor_mask):
        if visited[start_y, start_x]:
            continue

        queue = deque([(int(start_y), int(start_x))])
        visited[start_y, start_x] = True
        coordinates = []

        while queue:
            y, x = queue.popleft()
            coordinates.append((y, x))

            for offset_y, offset_x in neighbors:
                next_y = y + offset_y
                next_x = x + offset_x
                if (
                    0 <= next_y < height
                    and 0 <= next_x < width
                    and tumor_mask[next_y, next_x]
                    and not visited[next_y, next_x]
                ):
                    visited[next_y, next_x] = True
                    queue.append((next_y, next_x))

        regions.append(coordinates)

    if not regions:
        return {
            "tumor_region_count": 0,
            "largest_tumor_region_pixels": 0,
            "largest_region_equivalent_diameter_pixels": 0.0,
            "tumor_location": "Not applicable",
        }

    largest_region = max(regions, key=len)
    region_array = np.asarray(largest_region, dtype=np.float32)
    center_y, center_x = region_array.mean(axis=0)

    vertical_position = (
        "upper"
        if center_y < height / 3
        else "lower"
        if center_y > (2 * height) / 3
        else "middle"
    )
    horizontal_position = (
        "left"
        if center_x < width / 3
        else "right"
        if center_x > (2 * width) / 3
        else "central"
    )

    equivalent_diameter = 2.0 * np.sqrt(len(largest_region) / np.pi)

    return {
        "tumor_region_count": len(regions),
        "largest_tumor_region_pixels": len(largest_region),
        "largest_region_equivalent_diameter_pixels": round(
            float(equivalent_diameter),
            2,
        ),
        "tumor_location": (
            f"{vertical_position}-{horizontal_position} image region"
        ),
    }


def analyze_uploaded_image(file_bytes: bytes) -> dict:
    if not file_bytes:
        raise ValueError("Uploaded file is empty")

    try:
        source_image = Image.open(BytesIO(file_bytes)).convert("L")
    except Exception as error:
        raise ValueError("File must be a valid PNG or JPEG image") from error

    original_width, original_height = source_image.size
    processed_image = source_image.resize(
        MODEL_IMAGE_SIZE,
        Image.Resampling.BILINEAR,
    )

    processed_array = np.asarray(processed_image, dtype=np.float32)
    model_input = processed_array[np.newaxis, ..., np.newaxis] / 255.0

    probabilities = get_segmentation_model()(
        model_input,
        training=False,
    ).numpy()[0]

    if probabilities.ndim != 3 or probabilities.shape[-1] != NUMBER_OF_CLASSES:
        raise ValueError(
            "Unexpected model output shape. Expected (height, width, 3), "
            f"received {probabilities.shape}."
        )

    probabilities = np.clip(probabilities.astype(np.float32), 1e-7, 1.0)
    predicted_mask = np.argmax(probabilities, axis=-1).astype(np.uint8)

    liver_pixels = int(np.count_nonzero(predicted_mask > 0))
    tumor_pixels = int(np.count_nonzero(predicted_mask == 2))
    tumor_detected = tumor_pixels > 0

    tumor_percentage = (
        (tumor_pixels / liver_pixels) * 100.0 if liver_pixels > 0 else 0.0
    )

    tumor_probability = probabilities[..., 2]
    peak_tumor_probability = float(tumor_probability.max()) * 100.0

    if tumor_detected:
        tumor_confidence = float(
            tumor_probability[predicted_mask == 2].mean()
        ) * 100.0
    else:
        tumor_confidence = 0.0

    entropy = -np.sum(probabilities * np.log(probabilities), axis=-1)
    uncertainty = np.clip(
        entropy / np.log(float(NUMBER_OF_CLASSES)),
        0.0,
        1.0,
    )
    mean_uncertainty = float(uncertainty.mean()) * 100.0
    region_details = describe_tumor_regions(predicted_mask)

    if tumor_detected:
        explanation_summary = (
            "The U-Net assigned the tumor class to "
            f"{tumor_pixels} processed-image pixels across "
            f"{region_details['tumor_region_count']} connected region(s)."
        )
        explanation_points = [
            (
                "Tumor-class probability was higher than both liver and "
                "background probability at the highlighted pixels."
            ),
            (
                f"Mean confidence inside predicted tumor pixels was "
                f"{tumor_confidence:.1f}%, with a peak probability of "
                f"{peak_tumor_probability:.1f}%."
            ),
            (
                f"The largest connected region contained "
                f"{region_details['largest_tumor_region_pixels']} pixels at "
                f"{region_details['tumor_location']}."
            ),
            (
                "The probability and uncertainty maps explain the pixel-level "
                "segmentation decision; they do not identify cancer subtype."
            ),
        ]
    else:
        explanation_summary = (
            "No pixel was assigned to the tumor class after comparing all "
            "three U-Net output probabilities."
        )
        explanation_points = [
            (
                f"The highest tumor-class probability anywhere in the image "
                f"was {peak_tumor_probability:.1f}%."
            ),
            (
                "The uncertainty map shows where the model was less certain "
                "between background, liver and tumor classes."
            ),
            (
                "A no-tumor segmentation result is not a clinical diagnosis."
            ),
        ]

    output_size = (original_width, original_height)
    mask_original = Image.fromarray(predicted_mask).resize(
        output_size,
        Image.Resampling.NEAREST,
    )
    mask_array = np.asarray(mask_original, dtype=np.uint8)
    grayscale_original = np.asarray(source_image, dtype=np.uint8)

    tumor_probability_original = resize_float_map(
        tumor_probability,
        output_size,
    )

    # Only the visualization is contrast-enhanced. Reported probabilities and
    # confidence values above continue to use the original model output.
    display_probability_map = np.power(
        tumor_probability_original,
        DISPLAY_GAMMA,
    )

    uncertainty_original = resize_float_map(uncertainty, output_size)
    tumor_heatmap = colorize_heatmap(display_probability_map)
    uncertainty_heatmap = colorize_heatmap(uncertainty_original)

    xai_overlay = create_xai_overlay(
        grayscale_original,
        tumor_heatmap,
        display_probability_map,
    )
    segmentation_overlay = create_segmentation_overlay(
        grayscale_original,
        mask_array,
    )

    colored_mask = np.zeros(
        (original_height, original_width, 3),
        dtype=np.uint8,
    )
    colored_mask[mask_array == 1] = [0, 255, 0]
    colored_mask[mask_array == 2] = [255, 0, 0]

    return {
        "tumor_detected": tumor_detected,
        "tumor_confidence": round(tumor_confidence, 2),
        "peak_tumor_probability": round(peak_tumor_probability, 2),
        "mean_uncertainty": round(mean_uncertainty, 2),
        "tumor_percentage_of_liver": round(tumor_percentage, 2),
        "liver_pixel_count": liver_pixels,
        "tumor_pixel_count": tumor_pixels,
        **region_details,
        "image_width": original_width,
        "image_height": original_height,
        "processed_width": MODEL_IMAGE_SIZE[0],
        "processed_height": MODEL_IMAGE_SIZE[1],
        "original_image": encode_png(source_image),
        "mask_image": encode_png(Image.fromarray(colored_mask)),
        "overlay_image": encode_png(Image.fromarray(segmentation_overlay)),
        "xai_overlay_image": encode_png(Image.fromarray(xai_overlay)),
        "tumor_probability_heatmap": encode_png(
            Image.fromarray(tumor_heatmap)
        ),
        "uncertainty_heatmap": encode_png(
            Image.fromarray(uncertainty_heatmap)
        ),
        "xai_method": "Pixel-level tumor-class softmax probability mapping",
        "xai_explanation": explanation_summary,
        "xai_explanation_points": explanation_points,
        "xai_limitations": (
            "This explanation represents model probabilities and predictive "
            "uncertainty, not causal evidence or a clinical diagnosis."
        ),
        "model_scope": "LiTS CT liver/tumor segmentation",
        "tumor_subtype": "Not classified",
        "tumor_subtype_status": (
            "Requires a separate classifier trained on labeled tumor subtypes"
        ),
        "progression_status": (
            "Requires longitudinal scans and clinical outcome labels"
        ),
    }
