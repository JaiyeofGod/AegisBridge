"""Stable artifact bytes. SHA-256 here is an integrity hash, not a signature."""

from __future__ import annotations

import hashlib
import json
import struct

import numpy as np

from app.research.features.url_ngrams import Vocabulary
from app.research.model import FeedForwardModel


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def canonical_json(payload: dict[str, object]) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()


def pack_vocabulary(vocabulary: Vocabulary) -> bytes:
    payload: dict[str, object] = {
        "counts": list(vocabulary.counts),
        "tokens": list(vocabulary.tokens),
    }
    return canonical_json(payload)


def pack_model(model: FeedForwardModel) -> bytes:
    return b"".join(
        _pack_array(name, array)
        for name, array in (
            ("w1", model.w1),
            ("b1", model.b1),
            ("w2", model.w2),
            ("b2", model.b2),
        )
    )


def _pack_array(name: str, array: np.ndarray) -> bytes:
    values = np.ascontiguousarray(array, dtype="<f8")
    header = json.dumps({"dtype": "<f8", "name": name, "shape": list(values.shape)}).encode()
    return struct.pack("<I", len(header)) + header + values.tobytes()
