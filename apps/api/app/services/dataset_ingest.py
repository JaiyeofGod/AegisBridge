"""Ingest one approved research dataset revision.

HTTP and hashing finish before the ready transaction commits. A failed revision
does not remove an older ready revision. Raw rows are not written to PostgreSQL.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import TypedDict

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings, get_settings
from app.core.db import SessionLocal
from app.integrations.datasets.catalog import approved_dataset
from app.integrations.datasets.errors import DatasetError
from app.integrations.datasets.hashing import manifest_sha256
from app.integrations.datasets.huggingface import HuggingFacePhreshPhishSource
from app.integrations.datasets.models import DatasetSource, LocalArtifact, SourceManifest
from app.integrations.datasets.profiling import profile_parquet
from app.models.dataset import Dataset, DatasetFile, DatasetVersion
from app.storage.factory import get_object_storage
from app.storage.protocol import ObjectStorage

logger = logging.getLogger(__name__)

SessionFactory = Callable[[], Session]


class DatasetIngestResult(TypedDict):
    status: str
    reason: str | None
    dataset_id: str
    revision: str | None
    artifact_sha256: str | None
    byte_size: int
    row_count: int
    column_count: int


def ingest_dataset(
    dataset_id: str,
    *,
    session_factory: SessionFactory = SessionLocal,
    storage: ObjectStorage | None = None,
    source: DatasetSource | None = None,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> DatasetIngestResult:
    """Download, validate, hash, and store one approved dataset revision."""
    runtime = settings or get_settings()
    try:
        approved_dataset(dataset_id)
    except KeyError:
        return _result(dataset_id, "rejected", "unapproved_source")
    owns_source = source is None
    adapter = source or HuggingFacePhreshPhishSource(runtime)
    backend = storage or get_object_storage()
    moment = now or datetime.now(UTC)
    try:
        return _run(dataset_id, session_factory, backend, adapter, runtime, moment)
    finally:
        if owns_source and isinstance(adapter, HuggingFacePhreshPhishSource):
            adapter.close()


def _run(
    dataset_id: str,
    session_factory: SessionFactory,
    storage: ObjectStorage,
    source: DatasetSource,
    settings: Settings,
    moment: datetime,
) -> DatasetIngestResult:
    try:
        manifest = source.describe()
    except DatasetError as exc:
        logger.error("dataset describe failed dataset=%s reason=%s", dataset_id, exc.reason)
        _record_failure(
            session_factory,
            dataset_id,
            revision=exc.revision,
            reference=exc.reference,
            reason=exc.reason,
            moment=moment,
        )
        return _result(dataset_id, "failed", exc.reason, revision=exc.revision)
    if not _dataset_exists(session_factory, dataset_id):
        return _result(dataset_id, "failed", "dataset_missing", revision=manifest.revision)
    if _ready_revision(session_factory, dataset_id, manifest.revision) is not None:
        return _result(
            dataset_id,
            "already_ingested",
            None,
            revision=manifest.revision,
        )
    _record_status(
        session_factory,
        dataset_id,
        manifest,
        status="downloading",
        moment=moment,
    )
    with TemporaryDirectory(dir=settings.dataset_temp_dir, prefix="aegis-dataset-") as temporary:
        directory = Path(temporary)
        try:
            artifacts = source.download(directory)
            _record_status(
                session_factory,
                dataset_id,
                manifest,
                status="validating",
                moment=moment,
            )
            stored = _store_artifacts(
                storage,
                dataset_id,
                manifest,
                artifacts,
                settings.dataset_max_profile_rows,
            )
        except DatasetError as exc:
            logger.error("dataset ingest failed dataset=%s reason=%s", dataset_id, exc.reason)
            _record_failure(
                session_factory,
                dataset_id,
                revision=manifest.revision,
                reference=manifest.reference,
                reason=exc.reason,
                moment=moment,
            )
            return _result(dataset_id, "failed", exc.reason, revision=manifest.revision)
        except Exception:
            logger.error("dataset ingest failed dataset=%s reason=upload_failed", dataset_id)
            _record_failure(
                session_factory,
                dataset_id,
                revision=manifest.revision,
                reference=manifest.reference,
                reason="upload_failed",
                moment=moment,
            )
            return _result(dataset_id, "failed", "upload_failed", revision=manifest.revision)
    return _commit_ready(session_factory, dataset_id, manifest, stored, moment)


def _store_artifacts(
    storage: ObjectStorage,
    dataset_id: str,
    manifest: SourceManifest,
    artifacts: tuple[LocalArtifact, ...],
    max_rows: int,
) -> dict[str, object]:
    if not artifacts:
        raise DatasetError("empty_dataset")
    profiles = [profile_parquet(str(item.path), max_rows=max_rows) for item in artifacts]
    merged = _merge_profiles(profiles)
    digest = manifest_sha256(
        tuple((item.source_filename, item.sha256, item.size_bytes) for item in artifacts)
    )
    uploaded: list[dict[str, object]] = []
    for item in artifacts:
        key = _object_key(dataset_id, manifest.revision, item)
        with item.path.open("rb") as handle:
            storage.put_file(
                object_key=key,
                fileobj=handle,
                content_type="application/vnd.apache.parquet",
                size_bytes=item.size_bytes,
            )
        uploaded.append(
            {
                "filename": item.source_filename,
                "sha256": item.sha256,
                "size_bytes": item.size_bytes,
                "object_key": key,
            }
        )
    return {
        "sha256": digest,
        "byte_size": sum(item.size_bytes for item in artifacts),
        "profile": merged,
        "files": uploaded,
    }


def _merge_profiles(profiles: list[dict[str, object]]) -> dict[str, object]:
    first = profiles[0]
    names = [column["name"] for column in first["columns"]]  # type: ignore[index]
    for profile in profiles[1:]:
        other = [column["name"] for column in profile["columns"]]  # type: ignore[index]
        if other != names:
            raise DatasetError("schema_mismatch")
    truncated = any(bool(profile["profile_truncated"]) for profile in profiles)
    label_counts: dict[str, int] = {}
    if not truncated:
        for profile in profiles:
            counts = profile["label_counts"]
            if not isinstance(counts, dict):
                truncated = True
                break
            for key, value in counts.items():
                label_counts[str(key)] = label_counts.get(str(key), 0) + _as_int(value)
    merged = dict(first)
    merged["row_count"] = sum(_as_int(profile["row_count"]) for profile in profiles)
    merged["profile_truncated"] = truncated
    merged["label_counts"] = None if truncated else label_counts
    merged["label_count_scope"] = "bounded" if truncated else "full"
    merged["files"] = len(profiles)
    return merged


def _object_key(dataset_id: str, revision: str, artifact: LocalArtifact) -> str:
    name = Path(artifact.source_filename).name
    if name != artifact.source_filename or name in {"", ".", ".."}:
        raise DatasetError("unsafe_path")
    return f"datasets/{dataset_id}/{revision}/{artifact.sha256[:12]}/{name}"


def _dataset_exists(session_factory: SessionFactory, dataset_id: str) -> bool:
    session = session_factory()
    try:
        return session.scalar(select(Dataset.id).where(Dataset.human_id == dataset_id)) is not None
    finally:
        session.close()


def _ready_revision(
    session_factory: SessionFactory,
    dataset_id: str,
    revision: str,
) -> str | None:
    session = session_factory()
    try:
        version = session.scalar(
            select(DatasetVersion)
            .join(Dataset)
            .where(
                Dataset.human_id == dataset_id,
                DatasetVersion.version_label == revision,
                DatasetVersion.ingestion_status == "ready",
            )
        )
        if version is None:
            return None
        return version.artifact_sha256
    finally:
        session.close()


def _record_status(
    session_factory: SessionFactory,
    dataset_id: str,
    manifest: SourceManifest,
    *,
    status: str,
    moment: datetime,
) -> None:
    session = session_factory()
    try:
        dataset = _dataset(session, dataset_id)
        version = _version(session, dataset, manifest.revision)
        _apply_source(version, manifest)
        version.ingestion_status = status
        version.error_summary = None
        session.commit()
    except Exception:
        session.rollback()
        logger.error("dataset status update failed dataset=%s", dataset_id)
    finally:
        session.close()


def _record_failure(
    session_factory: SessionFactory,
    dataset_id: str,
    *,
    revision: str | None,
    reference: str | None,
    reason: str,
    moment: datetime,
) -> None:
    session = session_factory()
    try:
        dataset = _dataset(session, dataset_id)
        label = revision or "source-unavailable"
        version = _version(session, dataset, label)
        if version.ingestion_status == "ready":
            session.rollback()
            return
        version.source_type = version.source_type or "huggingface"
        version.source_revision = revision
        version.source_reference = reference
        version.ingestion_status = "failed"
        version.validation_status = "failed"
        version.error_summary = reason[:500]
        version.ingested_at = moment
        _refresh_dataset(dataset)
        session.commit()
    except Exception:
        session.rollback()
        logger.error("dataset failure record failed dataset=%s", dataset_id)
    finally:
        session.close()


def _commit_ready(
    session_factory: SessionFactory,
    dataset_id: str,
    manifest: SourceManifest,
    stored: dict[str, object],
    moment: datetime,
) -> DatasetIngestResult:
    session = session_factory()
    try:
        dataset = _dataset(session, dataset_id)
        version = _version(session, dataset, manifest.revision)
        profile = stored["profile"]
        if not isinstance(profile, dict):
            raise DatasetError("malformed_profile")
        _apply_source(version, manifest)
        version.ingestion_status = "ready"
        version.validation_status = "passed"
        version.ingested_at = moment
        version.row_count = _as_int(profile["row_count"])
        version.column_count = _as_int(profile["column_count"])
        version.byte_size = _as_int(stored["byte_size"])
        version.artifact_sha256 = str(stored["sha256"])
        version.profile = profile
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
        _refresh_dataset(dataset)
        session.commit()
    except Exception:
        session.rollback()
        logger.error("dataset ready commit failed dataset=%s", dataset_id)
        _record_failure(
            session_factory,
            dataset_id,
            revision=manifest.revision,
            reference=manifest.reference,
            reason="persist_failed",
            moment=moment,
        )
        return _result(dataset_id, "failed", "persist_failed", revision=manifest.revision)
    finally:
        session.close()
    profile = stored["profile"]
    assert isinstance(profile, dict)
    return _result(
        dataset_id,
        "ready",
        None,
        revision=manifest.revision,
        sha256=str(stored["sha256"]),
        byte_size=_as_int(stored["byte_size"]),
        row_count=_as_int(profile["row_count"]),
        column_count=_as_int(profile["column_count"]),
    )


def _dataset(session: Session, dataset_id: str) -> Dataset:
    dataset = session.scalar(
        select(Dataset)
        .where(Dataset.human_id == dataset_id)
        .options(selectinload(Dataset.versions))
    )
    if dataset is None:
        raise DatasetError("dataset_missing")
    return dataset


def _version(session: Session, dataset: Dataset, label: str) -> DatasetVersion:
    version = session.scalar(
        select(DatasetVersion).where(
            DatasetVersion.dataset_id == dataset.id,
            DatasetVersion.version_label == label,
        )
    )
    if version is None:
        version = DatasetVersion(dataset_id=dataset.id, version_label=label, dataset=dataset)
        session.add(version)
        session.flush()
    return version


def _apply_source(version: DatasetVersion, manifest: SourceManifest) -> None:
    version.source_type = manifest.source_type
    version.source_revision = manifest.revision
    version.source_reference = manifest.reference


def _refresh_dataset(dataset: Dataset) -> None:
    ready = [version for version in dataset.versions if version.ingestion_status == "ready"]
    if ready:
        latest = max(ready, key=lambda version: version.ingested_at or version.created_at)
        dataset.status = "ready"
        dataset.row_count = latest.row_count
        dataset.feature_count = latest.column_count
        return
    if any(version.ingestion_status == "failed" for version in dataset.versions):
        dataset.status = "failed"


def _as_int(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise DatasetError("malformed_profile")
    return value


def _result(
    dataset_id: str,
    status: str,
    reason: str | None,
    *,
    revision: str | None = None,
    sha256: str | None = None,
    byte_size: int = 0,
    row_count: int = 0,
    column_count: int = 0,
) -> DatasetIngestResult:
    return {
        "status": status,
        "reason": reason,
        "dataset_id": dataset_id,
        "revision": revision,
        "artifact_sha256": sha256,
        "byte_size": byte_size,
        "row_count": row_count,
        "column_count": column_count,
    }
