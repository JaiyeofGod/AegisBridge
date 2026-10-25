"""Seeded reservoir samples. The RNG is random.Random, not process hash entropy."""

from __future__ import annotations

import hashlib
import random
from collections.abc import Iterable
from dataclasses import dataclass

from app.integrations.datasets.errors import DatasetError

ALLOWED_LABELS = frozenset({"benign", "phish"})


@dataclass(frozen=True)
class SampleResult:
    rows: tuple[tuple[str, str], ...]
    duplicates_removed: int
    null_labels_skipped: int
    empty_urls_skipped: int
    leakage_removed: int
    selected_keys: frozenset[bytes]


def sample_test_split(
    rows: Iterable[tuple[object, object]],
    *,
    benign: int,
    phish: int,
    seed: int,
) -> SampleResult:
    """Balanced reservoirs drawn from the official test split."""
    return _sample(
        rows,
        targets={"benign": benign, "phish": phish},
        seed=seed,
        excluded=frozenset(),
    )


def sample_train_split(
    rows: Iterable[tuple[object, object]],
    *,
    count: int,
    seed: int,
    excluded: frozenset[bytes],
) -> SampleResult:
    """Uniform reservoir. The label mix follows the source split."""
    return _sample(rows, targets=None, count=count, seed=seed, excluded=excluded)


def _sample(
    rows: Iterable[tuple[object, object]],
    *,
    targets: dict[str, int] | None,
    seed: int,
    excluded: frozenset[bytes],
    count: int = 0,
) -> SampleResult:
    rng = random.Random(seed)
    reservoirs: dict[str, list[tuple[str, str]]] = {}
    seen_counts: dict[str, int] = {}
    if targets is None:
        reservoirs["*"] = []
        seen_counts["*"] = 0
        limit = {"*": count}
    else:
        limit = targets
        for label in targets:
            reservoirs[label] = []
            seen_counts[label] = 0
    seen: dict[bytes, str] = {}
    duplicates = 0
    nulls = 0
    empty = 0
    leakage = 0
    for raw_url, raw_label in rows:
        url = _url(raw_url)
        if url is None:
            empty += 1
            continue
        label = _label(raw_label)
        if label is None:
            nulls += 1
            continue
        key = hashlib.sha256(url.encode()).digest()
        if key in excluded:
            leakage += 1
            continue
        previous = seen.get(key)
        if previous is not None:
            if previous != label:
                raise DatasetError("conflicting_label")
            duplicates += 1
            continue
        seen[key] = label
        bucket = label if targets is not None else "*"
        seen_counts[bucket] += 1
        _offer(reservoirs[bucket], (url, label), seen_counts[bucket], limit[bucket], rng)
    if targets is not None:
        for label, needed in targets.items():
            if len(reservoirs[label]) != needed:
                raise DatasetError("insufficient_class_rows")
        chosen = [row for label in ("benign", "phish") for row in reservoirs[label]]
    else:
        if len(reservoirs["*"]) != count:
            raise DatasetError("insufficient_rows")
        chosen = reservoirs["*"]
    ordered = tuple(sorted(chosen, key=lambda item: (item[1], item[0])))
    selected = frozenset(hashlib.sha256(url.encode()).digest() for url, _ in ordered)
    return SampleResult(
        rows=ordered,
        duplicates_removed=duplicates,
        null_labels_skipped=nulls,
        empty_urls_skipped=empty,
        leakage_removed=leakage,
        selected_keys=selected,
    )


def _offer(
    reservoir: list[tuple[str, str]],
    row: tuple[str, str],
    seen: int,
    limit: int,
    rng: random.Random,
) -> None:
    if len(reservoir) < limit:
        reservoir.append(row)
        return
    index = rng.randrange(seen)
    if index < limit:
        reservoir[index] = row


def _url(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    return text


def _label(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str) or value not in ALLOWED_LABELS:
        raise DatasetError("unexpected_label")
    return value


def label_counts(rows: tuple[tuple[str, str], ...]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for _, label in rows:
        counts[label] = counts.get(label, 0) + 1
    return counts
