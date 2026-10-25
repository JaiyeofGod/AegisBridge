"""Server-controlled derivation recipes. Callers select a name, not a URL."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass

from app.integrations.datasets.catalog import PHRESHPHISH_ID, PHRESHPHISH_REPO

PINNED_PHRESHPHISH_REVISION = "eca603e0ecd4f698f8d4d226c088659e72681239"
URL_BASELINE_PROFILE = "phreshphish-url-baseline-v1"


@dataclass(frozen=True)
class DerivationProfile:
    name: str
    dataset_id: str
    repository: str
    revision: str
    columns: tuple[str, ...]
    train_count: int
    test_benign: int
    test_phish: int
    seed: int
    train_balance: str
    max_download_bytes: int


def _url_baseline() -> DerivationProfile:
    return DerivationProfile(
        name=URL_BASELINE_PROFILE,
        dataset_id=PHRESHPHISH_ID,
        repository=PHRESHPHISH_REPO,
        revision=PINNED_PHRESHPHISH_REVISION,
        columns=("url", "label"),
        train_count=1000,
        test_benign=100,
        test_phish=100,
        seed=42,
        train_balance="source_distribution",
        max_download_bytes=256 * 1024 * 1024,
    )


APPROVED_PROFILES = {URL_BASELINE_PROFILE: _url_baseline()}


def approved_profile(name: str) -> DerivationProfile:
    profile = APPROVED_PROFILES.get(name.strip())
    if profile is None:
        raise KeyError(name)
    return profile


def derivation_fingerprint(profile: DerivationProfile) -> str:
    """Recipe identity. Timestamps and file hashes are not part of this value."""
    payload = {
        "algorithm": "seeded_reservoir_v1",
        "columns": list(profile.columns),
        "dataset_id": profile.dataset_id,
        "dedup": "exact_stripped_url",
        "label_policy": "exact_benign_or_phish_skip_null_fail_unexpected",
        "normalization": "strip_url",
        "profile": profile.name,
        "repository": profile.repository,
        "revision": profile.revision,
        "seed": profile.seed,
        "test_balance": {"benign": profile.test_benign, "phish": profile.test_phish},
        "test_split": "test",
        "train_balance": profile.train_balance,
        "train_count": profile.train_count,
        "train_split": "train",
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()
