"""Server-controlled experiment profiles. Callers select a name, not hyperparameters."""

from __future__ import annotations

from dataclasses import dataclass

from app.integrations.datasets.profiles import (
    PINNED_PHRESHPHISH_REVISION,
    URL_BASELINE_PROFILE,
    approved_profile,
    derivation_fingerprint,
)

PROFILE_NAME = "phreshphish-url-ffn-v1"
CODE_VERSION = "aegisbridge-url-ffn-1"
PINNED_DERIVATION_FINGERPRINT = "de5b492458c1173d4f267ec8c8ea301d224ba4dd4fd03a41859c66d8819a75f2"

if derivation_fingerprint(approved_profile(URL_BASELINE_PROFILE)) != PINNED_DERIVATION_FINGERPRINT:
    raise RuntimeError("Pinned PhreshPhish URL baseline fingerprint does not match the recipe.")


@dataclass(frozen=True, slots=True)
class ExperimentProfile:
    name: str
    dataset_id: str
    derivation_profile: str
    derivation_fingerprint: str
    source_revision: str
    seed: int
    ngram_length: int
    min_count_exclusive: int
    max_features: int
    hidden_units: int
    epochs: int
    batch_size: int
    learning_rate: float
    threshold: float


def _url_ffn() -> ExperimentProfile:
    return ExperimentProfile(
        name=PROFILE_NAME,
        dataset_id="DS-0006",
        derivation_profile=URL_BASELINE_PROFILE,
        derivation_fingerprint=PINNED_DERIVATION_FINGERPRINT,
        source_revision=PINNED_PHRESHPHISH_REVISION,
        seed=42,
        ngram_length=4,
        min_count_exclusive=10,
        max_features=5000,
        hidden_units=32,
        epochs=10,
        batch_size=32,
        learning_rate=0.001,
        threshold=0.5,
    )


APPROVED_EXPERIMENTS = {PROFILE_NAME: _url_ffn()}


def approved_experiment(name: str) -> ExperimentProfile:
    profile = APPROVED_EXPERIMENTS.get(name.strip())
    if profile is None:
        raise KeyError(name)
    return profile
