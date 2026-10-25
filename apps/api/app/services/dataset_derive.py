"""Materialize one approved derived dataset artifact.

The full PhreshPhish source is not downloaded. Raw URLs are not written to PostgreSQL.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Callable, Iterator
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Protocol, TypedDict

import pyarrow as pa
import pyarrow.parquet as pq
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.db import SessionLocal
from app.integrations.datasets.catalog import PHRESHPHISH_REPO, approved_dataset
from app.integrations.datasets.columns import PhreshPhishColumnSource, ProjectionEstimate
from app.integrations.datasets.errors import DatasetError
from app.integrations.datasets.hashing import file_sha256, manifest_sha256
from app.integrations.datasets.profiles import (
    DerivationProfile,
    approved_profile,
    derivation_fingerprint,
)
from app.integrations.datasets.profiling import INTEGRITY
from app.integrations.datasets.sampling import (
    SampleResult,
    label_counts,
    sample_test_split,
    sample_train_split,
)
from app.models.dataset import Dataset, DatasetFile, DatasetVersion
from app.storage.factory import get_object_storage
from app.storage.protocol import ObjectStorage

logger = logging.getLogger(__name__)

SessionFactory = Callable[[], Session]
_FILES = ("train.parquet", "test.parquet", "manifest.json")


class ColumnSource(Protocol):
    revision: str

    def estimate(self) -> ProjectionEstimate: ...

    def iter_split(self, split: str) -> Iterator[tuple[object, object]]: ...

    def bytes_downloaded(self) -> int: ...

    def close(self) -> None: ...


class DatasetDeriveResult(TypedDict):
    status: str
    reason: str | None
    dataset_id: str
    profile: str
    revision: str | None
    fingerprint: str | None
    artifact_sha256: str | None
    train_rows: int
    test_rows: int
    test_benign: int
    test_phish: int
    bytes_downloaded: int


def derive_dataset(
    dataset_id: str,
    profile_name: str,
    *,
    session_factory: SessionFactory = SessionLocal,
    storage: ObjectStorage | None = None,
    source: ColumnSource | None = None,
    profile: DerivationProfile | None = None,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> DatasetDeriveResult:
    """Build the named derivation profile for one approved dataset."""
    runtime = settings or get_settings()
    selected = _profile(dataset_id, profile_name, profile)
    if isinstance(selected, str):
        return _result(dataset_id, profile_name, "rejected", selected)
    fingerprint = derivation_fingerprint(selected)
    if _ready(session_factory, dataset_id, fingerprint):
        return _result(
            dataset_id,
            profile_name,
            "already_materialized",
            None,
            revision=selected.revision,
            fingerprint=fingerprint,
        )
    backend = storage or get_object_storage()
    owns_source = source is None
    limit = min(runtime.dataset_derivation_max_download_bytes, selected.max_download_bytes)
    adapter = source or PhreshPhishColumnSource(runtime, selected.revision, limit=limit)
    moment = now or datetime.now(UTC)
    uploaded: list[str] = []
    try:
        if not _dataset_exists(session_factory, dataset_id):
            return _result(
                dataset_id,
                profile_name,
                "failed",
                "dataset_missing",
                revision=selected.revision,
                fingerprint=fingerprint,
            )
        try:
            estimate = adapter.estimate()
            projected = estimate.footer_bytes * 2 + estimate.column_bytes
            if projected > limit:
                raise DatasetError(
                    "derivation_too_large",
                    revision=selected.revision,
                    byte_size=projected,
                    file_count=estimate.files_touched,
                )
            if not backend.ping():
                raise DatasetError("storage_unavailable", revision=selected.revision)
            built = _sample(adapter, selected, estimate)
        except DatasetError as exc:
            logger.error("dataset derive failed dataset=%s reason=%s", dataset_id, exc.reason)
            _record_failure(
                session_factory,
                dataset_id,
                selected,
                fingerprint,
                exc.reason,
                moment,
            )
            return _result(
                dataset_id,
                profile_name,
                "failed",
                exc.reason,
                revision=selected.revision,
                fingerprint=fingerprint,
                bytes_downloaded=adapter.bytes_downloaded(),
            )
        with TemporaryDirectory(dir=runtime.dataset_temp_dir, prefix="aegis-derived-") as temporary:
            directory = Path(temporary)
            try:
                artifacts = _write_artifacts(directory, selected, fingerprint, built, moment)
                for artifact in artifacts:
                    key = _object_key(dataset_id, selected.revision, fingerprint, artifact.name)
                    with artifact.open("rb") as handle:
                        backend.put_file(
                            object_key=key,
                            fileobj=handle,
                            content_type=_content_type(artifact.name),
                            size_bytes=artifact.stat().st_size,
                        )
                    uploaded.append(key)
                stored = _stored(artifacts, uploaded, built, selected, fingerprint)
                _commit_ready(
                    session_factory,
                    dataset_id,
                    selected,
                    fingerprint,
                    stored,
                    moment,
                )
            except DatasetError as exc:
                logger.error("dataset derive failed dataset=%s reason=%s", dataset_id, exc.reason)
                for key in uploaded:
                    backend.delete(object_key=key)
                _record_failure(
                    session_factory,
                    dataset_id,
                    selected,
                    fingerprint,
                    exc.reason,
                    moment,
                )
                return _result(
                    dataset_id,
                    profile_name,
                    "failed",
                    exc.reason,
                    revision=selected.revision,
                    fingerprint=fingerprint,
                )
            except Exception:
                logger.error("dataset derive failed dataset=%s reason=upload_failed", dataset_id)
                for key in uploaded:
                    backend.delete(object_key=key)
                _record_failure(
                    session_factory,
                    dataset_id,
                    selected,
                    fingerprint,
                    "upload_failed",
                    moment,
                )
                return _result(
                    dataset_id,
                    profile_name,
                    "failed",
                    "upload_failed",
                    revision=selected.revision,
                    fingerprint=fingerprint,
                )
        return _result(
            dataset_id,
            profile_name,
            "ready",
            None,
            revision=selected.revision,
            fingerprint=fingerprint,
            sha256=str(stored["sha256"]),
            train_rows=built.train_rows,
            test_rows=built.test_rows,
            test_benign=built.test_counts.get("benign", 0),
            test_phish=built.test_counts.get("phish", 0),
            bytes_downloaded=built.bytes_downloaded,
        )
    finally:
        if owns_source:
            adapter.close()


class _Built:
    def __init__(
        self,
        train: SampleResult,
        test: SampleResult,
        estimate: ProjectionEstimate,
        downloaded: int,
    ) -> None:
        self.train = train
        self.test = test
        self.estimate = estimate
        self.bytes_downloaded = downloaded
        self.train_rows = len(train.rows)
        self.test_rows = len(test.rows)
        self.train_counts = label_counts(train.rows)
        self.test_counts = label_counts(test.rows)


def _sample(
    source: ColumnSource,
    profile: DerivationProfile,
    estimate: ProjectionEstimate,
) -> _Built:
    test = sample_test_split(
        source.iter_split("test"),
        benign=profile.test_benign,
        phish=profile.test_phish,
        seed=profile.seed,
    )
    train = sample_train_split(
        source.iter_split("train"),
        count=profile.train_count,
        seed=profile.seed,
        excluded=test.selected_keys,
    )
    overlap = test.selected_keys & train.selected_keys
    if overlap:
        raise DatasetError("split_leakage")
    return _Built(train, test, estimate, source.bytes_downloaded())


def _write_artifacts(
    directory: Path,
    profile: DerivationProfile,
    fingerprint: str,
    built: _Built,
    moment: datetime,
) -> tuple[Path, Path, Path]:
    train_path = directory / "train.parquet"
    test_path = directory / "test.parquet"
    _write_parquet(train_path, built.train.rows)
    _write_parquet(test_path, built.test.rows)
    train_hash, train_size = file_sha256(train_path)
    test_hash, test_size = file_sha256(test_path)
    artifact = manifest_sha256(
        (
            ("train.parquet", train_hash, train_size),
            ("test.parquet", test_hash, test_size),
        )
    )
    manifest = {
        "artifact_sha256": artifact,
        "created_at": moment.isoformat(),
        "dataset_id": profile.dataset_id,
        "derivation_fingerprint": fingerprint,
        "derivation_profile": profile.name,
        "derivation_type": "column_projection_sample",
        "duplicates_removed": built.train.duplicates_removed + built.test.duplicates_removed,
        "empty_urls_skipped": built.train.empty_urls_skipped + built.test.empty_urls_skipped,
        "files": {
            "test.parquet": {"sha256": test_hash, "size_bytes": test_size},
            "train.parquet": {"sha256": train_hash, "size_bytes": train_size},
        },
        "integrity": INTEGRITY,
        "leakage_removed": built.train.leakage_removed,
        "note": "Derived URL and label sample. Not the full PhreshPhish dataset.",
        "null_labels_skipped": built.train.null_labels_skipped + built.test.null_labels_skipped,
        "parent_dataset": "PhreshPhish",
        "sampling_algorithm": "seeded_reservoir_v1",
        "seed": profile.seed,
        "selected_columns": ["url", "label"],
        "source_repository": profile.repository,
        "source_revision": profile.revision,
        "test_actual": built.test_rows,
        "test_label_counts": built.test_counts,
        "test_requested": profile.test_benign + profile.test_phish,
        "train_actual": built.train_rows,
        "train_balance": profile.train_balance,
        "train_label_counts": built.train_counts,
        "train_requested": profile.train_count,
    }
    manifest_path = directory / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, sort_keys=True, indent=2), encoding="utf-8")
    _reject_raw_columns(train_path)
    _reject_raw_columns(test_path)
    return train_path, test_path, manifest_path


def _write_parquet(path: Path, rows: tuple[tuple[str, str], ...]) -> None:
    table = pa.table(
        {
            "url": pa.array([url for url, _ in rows], type=pa.string()),
            "label": pa.array([label for _, label in rows], type=pa.string()),
        }
    )
    pq.write_table(table, path)


def _reject_raw_columns(path: Path) -> None:
    parquet = pq.ParquetFile(path)
    names = list(parquet.schema_arrow.names)
    if names != ["url", "label"]:
        raise DatasetError("schema_mismatch")


def _stored(
    artifacts: tuple[Path, Path, Path],
    keys: list[str],
    built: _Built,
    profile: DerivationProfile,
    fingerprint: str,
) -> dict[str, object]:
    files: list[dict[str, object]] = []
    hashed: list[tuple[str, str, int]] = []
    for path, key in zip(artifacts, keys, strict=True):
        digest, size = file_sha256(path)
        files.append(
            {
                "filename": path.name,
                "sha256": digest,
                "size_bytes": size,
                "object_key": key,
            }
        )
        if path.name != "manifest.json":
            hashed.append((path.name, digest, size))
    combined = label_counts(built.train.rows + built.test.rows)
    return {
        "sha256": manifest_sha256(tuple(hashed)),
        "byte_size": sum(_as_int(item["size_bytes"]) for item in files),
        "files": files,
        "profile": {
            "derived": True,
            "derivation_profile": profile.name,
            "derivation_fingerprint": fingerprint,
            "derivation_type": "column_projection_sample",
            "format": "parquet",
            "integrity": INTEGRITY,
            "row_count": built.train_rows + built.test_rows,
            "column_count": 2,
            "columns": ["url", "label"],
            "label_field": "label",
            "label_count_scope": "full",
            "label_counts": combined,
            "sampling_algorithm": "seeded_reservoir_v1",
            "seed": profile.seed,
            "train_balance": profile.train_balance,
            "train": {
                "requested": profile.train_count,
                "actual": built.train_rows,
                "label_counts": built.train_counts,
            },
            "test": {
                "requested": profile.test_benign + profile.test_phish,
                "actual": built.test_rows,
                "label_counts": built.test_counts,
            },
            "duplicates_removed": (built.train.duplicates_removed + built.test.duplicates_removed),
            "leakage_removed": built.train.leakage_removed,
            "null_labels_skipped": (
                built.train.null_labels_skipped + built.test.null_labels_skipped
            ),
            "empty_urls_skipped": built.train.empty_urls_skipped + built.test.empty_urls_skipped,
            "source_files_touched": built.estimate.files_touched,
            "bytes_downloaded": built.bytes_downloaded,
        },
    }


def _profile(
    dataset_id: str,
    profile_name: str,
    profile: DerivationProfile | None,
) -> DerivationProfile | str:
    try:
        approved_dataset(dataset_id)
    except KeyError:
        return "unapproved_source"
    try:
        selected = profile or approved_profile(profile_name)
    except KeyError:
        return "unapproved_profile"
    if (
        selected.name != profile_name
        or selected.dataset_id != dataset_id
        or selected.repository != PHRESHPHISH_REPO
        or selected.columns != ("url", "label")
        or selected.train_balance != "source_distribution"
        or selected.train_count < 1
        or selected.test_benign < 1
        or selected.test_phish < 1
        or len(selected.revision) != 40
    ):
        return "unapproved_profile"
    return selected


def _object_key(dataset_id: str, revision: str, fingerprint: str, filename: str) -> str:
    if filename not in _FILES:
        raise DatasetError("unsafe_path")
    return f"datasets/{dataset_id}/derived/{revision}/{fingerprint}/{filename}"


def _content_type(filename: str) -> str:
    if filename.endswith(".json"):
        return "application/json"
    return "application/vnd.apache.parquet"


def _ready(session_factory: SessionFactory, dataset_id: str, fingerprint: str) -> bool:
    session = session_factory()
    try:
        version = session.scalar(
            select(DatasetVersion)
            .join(Dataset)
            .where(
                Dataset.human_id == dataset_id,
                DatasetVersion.version_label == fingerprint,
                DatasetVersion.ingestion_status == "ready",
            )
        )
        return version is not None
    finally:
        session.close()


def _dataset_exists(session_factory: SessionFactory, dataset_id: str) -> bool:
    session = session_factory()
    try:
        found = session.scalar(select(Dataset.id).where(Dataset.human_id == dataset_id))
        return found is not None
    finally:
        session.close()


def _record_failure(
    session_factory: SessionFactory,
    dataset_id: str,
    profile: DerivationProfile,
    fingerprint: str,
    reason: str,
    moment: datetime,
) -> None:
    session = session_factory()
    try:
        dataset = _dataset(session, dataset_id)
        version = _version(session, dataset, fingerprint)
        if version.ingestion_status == "ready":
            session.rollback()
            return
        _apply(version, profile, fingerprint)
        version.ingestion_status = "failed"
        version.validation_status = "failed"
        version.error_summary = reason[:500]
        version.ingested_at = moment
        session.commit()
    except Exception:
        session.rollback()
        logger.error("dataset derive failure record failed dataset=%s", dataset_id)
    finally:
        session.close()


def _commit_ready(
    session_factory: SessionFactory,
    dataset_id: str,
    profile: DerivationProfile,
    fingerprint: str,
    stored: dict[str, object],
    moment: datetime,
) -> None:
    session = session_factory()
    try:
        dataset = _dataset(session, dataset_id)
        version = _version(session, dataset, fingerprint)
        payload = stored["profile"]
        if not isinstance(payload, dict):
            raise DatasetError("malformed_profile")
        _apply(version, profile, fingerprint)
        version.ingestion_status = "ready"
        version.validation_status = "passed"
        version.ingested_at = moment
        version.row_count = _as_int(payload["row_count"])
        version.column_count = _as_int(payload["column_count"])
        version.byte_size = _as_int(stored["byte_size"])
        version.artifact_sha256 = str(stored["sha256"])
        version.profile = payload
        version.error_summary = None
        for existing in list(version.files):
            session.delete(existing)
        files = stored["files"]
        if not isinstance(files, list):
            raise DatasetError("malformed_profile")
        for item in files:
            if not isinstance(item, dict):
                continue
            session.add(
                DatasetFile(
                    dataset_version=version,
                    filename=str(item["filename"]),
                    sha256=str(item["sha256"]),
                    size_bytes=_as_int(item["size_bytes"]),
                    storage_uri=str(item["object_key"]),
                )
            )
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _dataset(session: Session, dataset_id: str) -> Dataset:
    dataset = session.scalar(select(Dataset).where(Dataset.human_id == dataset_id))
    if dataset is None:
        raise DatasetError("dataset_missing")
    return dataset


def _version(session: Session, dataset: Dataset, fingerprint: str) -> DatasetVersion:
    version = session.scalar(
        select(DatasetVersion).where(
            DatasetVersion.dataset_id == dataset.id,
            DatasetVersion.version_label == fingerprint,
        )
    )
    if version is None:
        version = DatasetVersion(dataset_id=dataset.id, version_label=fingerprint, dataset=dataset)
        session.add(version)
        session.flush()
    return version


def _apply(version: DatasetVersion, profile: DerivationProfile, fingerprint: str) -> None:
    version.source_type = "derived"
    version.source_revision = profile.revision
    version.source_reference = (
        f"https://huggingface.co/datasets/{profile.repository}/tree/{profile.revision}"
    )
    if version.version_label != fingerprint:
        raise DatasetError("malformed_profile")


def _as_int(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise DatasetError("malformed_profile")
    return value


def _result(
    dataset_id: str,
    profile_name: str,
    status: str,
    reason: str | None,
    *,
    revision: str | None = None,
    fingerprint: str | None = None,
    sha256: str | None = None,
    train_rows: int = 0,
    test_rows: int = 0,
    test_benign: int = 0,
    test_phish: int = 0,
    bytes_downloaded: int = 0,
) -> DatasetDeriveResult:
    return {
        "status": status,
        "reason": reason,
        "dataset_id": dataset_id,
        "profile": profile_name,
        "revision": revision,
        "fingerprint": fingerprint,
        "artifact_sha256": sha256,
        "train_rows": train_rows,
        "test_rows": test_rows,
        "test_benign": test_benign,
        "test_phish": test_phish,
        "bytes_downloaded": bytes_downloaded,
    }
