import io
import json
from dataclasses import dataclass

import face_recognition
import numpy as np
from PIL import Image, ImageOps


@dataclass
class FaceMatch:
    location: tuple[int, int, int, int]
    student_id: int | None
    distance: float | None


def _load_rgb(data: bytes) -> np.ndarray:
    image = Image.open(io.BytesIO(data))
    image = ImageOps.exif_transpose(image).convert("RGB")
    return np.array(image)


def encode_single_face(data: bytes) -> list[float] | None:
    """Extract a single face encoding from an enrollment photo.

    Returns the 128-d encoding as a plain list, or None if the photo does not
    contain exactly one detectable face.
    """
    image = _load_rgb(data)
    locations = face_recognition.face_locations(image, model="hog")
    if len(locations) != 1:
        return None
    encodings = face_recognition.face_encodings(image, known_face_locations=locations)
    if not encodings:
        return None
    return encodings[0].tolist()


def encoding_to_json(encoding: list[float]) -> str:
    return json.dumps(encoding)


def encoding_from_json(data: str | None) -> np.ndarray | None:
    if not data:
        return None
    return np.array(json.loads(data), dtype=np.float64)


def match_faces(
    image_bytes: bytes,
    known: list[tuple[int, np.ndarray]],
    tolerance: float,
) -> list[FaceMatch]:
    """Detect every face in the frame and return the best matching student per face."""
    image = _load_rgb(image_bytes)
    small = image
    scale = 1.0
    max_side = max(image.shape[:2])
    if max_side > 640:
        scale = 640 / max_side
        new_size = (int(image.shape[1] * scale), int(image.shape[0] * scale))
        small = np.array(Image.fromarray(image).resize(new_size))

    locations = face_recognition.face_locations(small, model="hog")
    if not locations:
        return []

    encodings = face_recognition.face_encodings(small, known_face_locations=locations)

    known_encodings = [enc for _, enc in known]
    known_ids = [sid for sid, _ in known]

    results: list[FaceMatch] = []
    for loc, enc in zip(locations, encodings):
        top, right, bottom, left = loc
        if scale != 1.0:
            inv = 1.0 / scale
            loc_full = (int(top * inv), int(right * inv), int(bottom * inv), int(left * inv))
        else:
            loc_full = (top, right, bottom, left)

        if not known_encodings:
            results.append(FaceMatch(location=loc_full, student_id=None, distance=None))
            continue

        distances = face_recognition.face_distance(known_encodings, enc)
        best_idx = int(np.argmin(distances))
        best_dist = float(distances[best_idx])
        if best_dist <= tolerance:
            results.append(FaceMatch(location=loc_full, student_id=known_ids[best_idx], distance=best_dist))
        else:
            results.append(FaceMatch(location=loc_full, student_id=None, distance=best_dist))

    return results
