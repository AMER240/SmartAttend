"""
Face encoding & matching utilities for SmartAttend.

This module wraps `face_recognition` (dlib-based) and OpenCV behind a small,
defensive API used by the FastAPI route `POST /attendance/live_match`.

Heavy native dependencies (`face_recognition`, `cv2`, `numpy`) are imported
lazily so the FastAPI app can still boot in environments where they are not
installed (e.g. CI / first-time setup) – the offending endpoints will then
return a clear 503 instead of crashing the entire process.
"""

from __future__ import annotations

import io
import logging
import pickle
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy import helpers
# ---------------------------------------------------------------------------

_face_recognition = None
_cv2 = None
_np = None


def _ensure_libs() -> Tuple[object, object, object]:
    """Import heavy CV libraries on first use.

    Raises:
        RuntimeError: if libraries cannot be imported – callers should turn
        this into an HTTP 503 in the FastAPI layer.
    """
    global _face_recognition, _cv2, _np
    if _face_recognition is None or _cv2 is None or _np is None:
        try:
            import face_recognition  # type: ignore
            import cv2  # type: ignore
            import numpy as np  # type: ignore
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError(
                "face_recognition / opencv-python / numpy are not installed. "
                "Run `pip install -r requirements.txt` before using the AI engine."
            ) from exc
        _face_recognition, _cv2, _np = face_recognition, cv2, np
    return _face_recognition, _cv2, _np


# ---------------------------------------------------------------------------
# Encoding helpers
# ---------------------------------------------------------------------------


def encode_face_from_bytes(image_bytes: bytes) -> Optional["object"]:
    """
    Take raw image bytes (e.g. an uploaded JPEG/PNG) and return a single
    128-d face encoding (numpy.ndarray) or None if no face was detected.
    """
    fr, cv2, np = _ensure_libs()
    try:
        # Decode bytes -> BGR image (OpenCV) -> RGB image (face_recognition).
        file_bytes = np.frombuffer(image_bytes, dtype=np.uint8)
        bgr_image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        if bgr_image is None:
            logger.warning("encode_face_from_bytes: could not decode image bytes.")
            return None

        rgb_image = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2RGB)
        face_locations = fr.face_locations(rgb_image, model="hog")
        if not face_locations:
            return None

        encodings = fr.face_encodings(rgb_image, face_locations)
        if not encodings:
            return None
        # Return only the largest (most prominent) face.
        return encodings[0]
    except Exception as exc:
        logger.exception("encode_face_from_bytes failed: %s", exc)
        return None


def serialize_encoding(encoding) -> bytes:
    """Pickle a numpy 128-d encoding into bytes for DB LargeBinary storage."""
    return pickle.dumps(encoding, protocol=pickle.HIGHEST_PROTOCOL)


def deserialize_encoding(blob: bytes):
    """Inverse of serialize_encoding."""
    return pickle.loads(blob)


# ---------------------------------------------------------------------------
# Matching
# ---------------------------------------------------------------------------


def match_encoding(
    candidate_encoding,
    known_encodings: List["object"],
    known_student_ids: List[str],
    tolerance: float = 0.55,
) -> Tuple[Optional[str], Optional[float]]:
    """
    Compare a single candidate encoding against many known encodings.

    Returns:
        (student_id, distance) if best match is within `tolerance`, else (None, None).
    """
    fr, _cv2, np = _ensure_libs()
    if not known_encodings:
        return None, None

    distances = fr.face_distance(known_encodings, candidate_encoding)
    if len(distances) == 0:
        return None, None

    best_idx = int(np.argmin(distances))
    best_distance = float(distances[best_idx])
    if best_distance <= tolerance:
        return known_student_ids[best_idx], best_distance
    return None, best_distance


def match_image_bytes(
    image_bytes: bytes,
    known_encodings: List["object"],
    known_student_ids: List[str],
    tolerance: float = 0.55,
) -> Tuple[Optional[str], Optional[float], str]:
    """
    Higher-level helper used directly by the FastAPI live_match endpoint.

    Returns:
        (student_id_or_none, distance_or_none, human_readable_message)
    """
    encoding = encode_face_from_bytes(image_bytes)
    if encoding is None:
        return None, None, "No face detected in the provided frame."

    student_id, distance = match_encoding(
        encoding, known_encodings, known_student_ids, tolerance=tolerance
    )
    if student_id is None:
        return None, distance, "Face detected but no matching student found."
    return student_id, distance, "Match found."
