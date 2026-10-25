"""Load one ready derived dataset, verify it, and train the pinned URL FFN."""

from __future__ import annotations

import json
import logging
import platform
import resource
from collections.abc import Callable
from datetime import UTC, datetime
from io import BytesIO
from typing import TypedDict

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.db import SessionLocal
from app.integrations.datasets.hashing import manifest_sha256
from app.models.dataset import Dataset, DatasetExperiment, DatasetVersion
from app.research.artifacts import canonical_json, pack_model, pack_vocabulary, sha256_bytes
from app.research.features.url_ngrams import Vocabulary, fit_vocabulary, transform
from app.research.metrics import classification_metrics
from app.research.model import train_model
from app.research.profiles import CODE_VERSION, ExperimentProfile, approved_experiment
from app.services.support import next_human_id
from app.storage.factory import get_object_storage
from app.storage.protocol import ObjectStorage

logger = logging.getLogger(__name__)

SessionFactory = Callable[[], Session]
LABELS = {"benign": 0, "phish": 1}
_REQUIRED_FILES = ("train.parquet", "test.parquet", "manifest.json")


class ExperimentRunResult(TypedDict):
    status: str
    reason: str | None
    experiment_id: str | None
    accuracy: float | None
    phishing_caught: int | None
    phishing_support: int | None
    benign_false_positives: int | None
    benign_support: int | None
    vocabulary_size: int | None
    parameter_count: int | None
    model_sha256: str | None
    vocabulary_sha256: str | None
    manifest_sha256: str | None


class _FileRef:
    def __init__(self, sha256: str, storage_uri: str) -> None:
        self.sha256 = sha256
        self.storage_uri = storage_uri


class ResearchError(Exception):
    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


class _StoredRun:
    def __init__(
        self,
        *,
        accuracy: float,
        phishing_caught: int,
        phishing_support: int,
        benign_false_positives: int,
        benign_support: int,
        vocabulary_size: int,
        parameter_count: int,
        model_sha256: str,
        vocabulary_sha256: str,
        manifest_sha256: str,
        config: dict[str, object],
        metrics: dict[str, object],
        keys: dict[str, str],
    ) -> None:
        self.accuracy = accuracy
        self.phishing_caught = phishing_caught
        self.phishing_support = phishing_support
        self.benign_false_positives = benign_false_positives
        self.benign_support = benign_support
        self.vocabulary_size = vocabulary_size
        self.parameter_count = parameter_count
        self.model_sha256 = model_sha256
        self.vocabulary_sha256 = vocabulary_sha256
        self.manifest_sha256 = manifest_sha256
        self.config = config
        self.metrics = metrics
        self.keys = keys


def run_experiment(
    profile_name: str,
    *,
    session_factory: SessionFactory = SessionLocal,
    storage: ObjectStorage | None = None,
) -> ExperimentRunResult:
    try:
        profile = approved_experiment(profile_name)
    except KeyError:
        return _empty("failed", "unknown_profile")
    backend = storage or get_object_storage()
    try:
        version_id, files = _resolve(session_factory, profile)
    except ResearchError as exc:
        return _empty("failed", exc.code)
    experiment_id = _open_experiment(session_factory, version_id, profile)
    uploaded: list[str] = []
    try:
        train_bytes, test_bytes, manifest_bytes = _verified_bytes(backend, profile, files)
        stored = _train_and_store(
            backend,
            profile,
            experiment_id,
            train_bytes,
            test_bytes,
            manifest_bytes,
            uploaded,
        )
        _complete(session_factory, experiment_id, stored)
    except ResearchError as exc:
        _fail(session_factory, experiment_id, exc.code)
        _delete_uploaded(backend, uploaded)
        return _empty("failed", exc.code, experiment_id)
    except Exception:
        logger.exception("experiment failed without a safe detail")
        _fail(session_factory, experiment_id, "experiment_failed")
        _delete_uploaded(backend, uploaded)
        return _empty("failed", "experiment_failed", experiment_id)
    return _public_result(experiment_id, stored)


def _train_and_store(
    storage: ObjectStorage,
    profile: ExperimentProfile,
    experiment_id: str,
    train_bytes: bytes,
    test_bytes: bytes,
    manifest_bytes: bytes,
    uploaded: list[str],
) -> _StoredRun:
    started = datetime.now(UTC)
    feature_started = datetime.now(UTC)
    train_urls, train_labels = _rows(train_bytes)
    test_urls, test_labels = _rows(test_bytes)
    vocabulary = fit_vocabulary(
        train_urls,
        ngram_length=profile.ngram_length,
        min_count_exclusive=profile.min_count_exclusive,
        max_features=profile.max_features,
    )
    if not vocabulary.tokens:
        raise ResearchError("empty_vocabulary")
    train_matrix = transform(train_urls, vocabulary, ngram_length=profile.ngram_length)
    test_matrix = transform(test_urls, vocabulary, ngram_length=profile.ngram_length)
    feature_seconds = (datetime.now(UTC) - feature_started).total_seconds()
    train_started = datetime.now(UTC)
    model = train_model(
        train_matrix,
        np.asarray(train_labels, dtype=np.float64),
        hidden_units=profile.hidden_units,
        seed=profile.seed,
        epochs=profile.epochs,
        batch_size=profile.batch_size,
        learning_rate=profile.learning_rate,
    )
    train_seconds = (datetime.now(UTC) - train_started).total_seconds()
    from app.research.model import predict_proba

    probabilities = predict_proba(model, test_matrix)
    measured = classification_metrics(
        np.asarray(test_labels, dtype=np.int64),
        probabilities,
        threshold=profile.threshold,
    )
    public_metrics: dict[str, object] = dict(measured)
    public_metrics["seconds"] = {"features": feature_seconds, "training": train_seconds}
    public_metrics["vocabulary_size"] = len(vocabulary.tokens)
    public_metrics["parameter_count"] = model.parameter_count
    public_metrics["peak_rss_bytes"] = _peak_rss()
    config = _config(
        profile,
        vocabulary,
        model.parameter_count,
        train_bytes,
        test_bytes,
        manifest_bytes,
    )
    model_bytes = pack_model(model)
    vocabulary_bytes = pack_vocabulary(vocabulary)
    finished = datetime.now(UTC)
    manifest = _manifest(
        experiment_id,
        profile,
        config,
        public_metrics,
        sha256_bytes(model_bytes),
        sha256_bytes(vocabulary_bytes),
        started,
        finished,
    )
    manifest_body = canonical_json(manifest)
    keys = _store(storage, experiment_id, model_bytes, vocabulary_bytes, manifest_body, uploaded)
    return _StoredRun(
        accuracy=measured["accuracy"],
        phishing_caught=measured["phishing_caught"],
        phishing_support=measured["phishing_support"],
        benign_false_positives=measured["benign_false_positives"],
        benign_support=measured["benign_support"],
        vocabulary_size=len(vocabulary.tokens),
        parameter_count=model.parameter_count,
        model_sha256=sha256_bytes(model_bytes),
        vocabulary_sha256=sha256_bytes(vocabulary_bytes),
        manifest_sha256=sha256_bytes(manifest_body),
        config=config,
        metrics=public_metrics,
        keys=keys,
    )


def _rows(payload: bytes) -> tuple[list[str], list[int]]:
    table = pq.read_table(pa.BufferReader(payload))
    if list(table.column_names) != ["url", "label"]:
        raise ResearchError("schema_mismatch")
    urls = table.column("url").to_pylist()
    labels = table.column("label").to_pylist()
    mapped: list[int] = []
    texts: list[str] = []
    for url, label in zip(urls, labels, strict=True):
        if not isinstance(url, str) or not isinstance(label, str):
            raise ResearchError("invalid_label")
        if label not in LABELS:
            raise ResearchError("invalid_label")
        texts.append(url)
        mapped.append(LABELS[label])
    return texts, mapped


def _resolve(
    session_factory: SessionFactory,
    profile: ExperimentProfile,
) -> tuple[object, dict[str, _FileRef]]:
    session = session_factory()
    try:
        rows = session.scalars(
            select(DatasetVersion)
            .join(Dataset)
            .where(
                Dataset.human_id == profile.dataset_id,
                DatasetVersion.source_type == "derived",
                DatasetVersion.ingestion_status == "ready",
                DatasetVersion.validation_status == "passed",
                DatasetVersion.version_label == profile.derivation_fingerprint,
                DatasetVersion.source_revision == profile.source_revision,
            )
            .options(selectinload(DatasetVersion.files))
        ).all()
        matched = [row for row in rows if _profile_matches(row, profile)]
        if len(matched) != 1:
            raise ResearchError("dataset_not_ready")
        version = matched[0]
        files = {
            item.filename: _FileRef(item.sha256 or "", item.storage_uri or "")
            for item in version.files
        }
        if any(_file_missing(files.get(name)) for name in _REQUIRED_FILES):
            raise ResearchError("missing_artifact")
        return version.id, files
    finally:
        session.close()


def _file_missing(record: _FileRef | None) -> bool:
    return record is None or not record.storage_uri or not record.sha256


def _profile_matches(version: DatasetVersion, profile: ExperimentProfile) -> bool:
    stored = version.profile if isinstance(version.profile, dict) else {}
    return (
        stored.get("derived") is True
        and stored.get("derivation_profile") == profile.derivation_profile
        and stored.get("derivation_fingerprint") == profile.derivation_fingerprint
    )


def _verified_bytes(
    storage: ObjectStorage,
    profile: ExperimentProfile,
    files: dict[str, _FileRef],
) -> tuple[bytes, bytes, bytes]:
    bodies = {name: _read(storage, files[name]) for name in _REQUIRED_FILES}
    for name in _REQUIRED_FILES:
        digest = sha256_bytes(bodies[name])
        recorded = files[name].sha256
        if digest != recorded:
            raise ResearchError("integrity_failed")
    try:
        manifest = json.loads(bodies["manifest.json"])
    except json.JSONDecodeError as exc:
        raise ResearchError("integrity_failed") from exc
    if not isinstance(manifest, dict):
        raise ResearchError("integrity_failed")
    if manifest.get("derivation_fingerprint") != profile.derivation_fingerprint:
        raise ResearchError("integrity_failed")
    if manifest.get("derivation_profile") != profile.derivation_profile:
        raise ResearchError("integrity_failed")
    if manifest.get("source_revision") != profile.source_revision:
        raise ResearchError("integrity_failed")
    listed = manifest.get("files")
    if not isinstance(listed, dict):
        raise ResearchError("integrity_failed")
    hashed: list[tuple[str, str, int]] = []
    for name in ("train.parquet", "test.parquet"):
        entry = listed.get(name)
        if not isinstance(entry, dict):
            raise ResearchError("integrity_failed")
        digest = sha256_bytes(bodies[name])
        if entry.get("sha256") != digest or entry.get("size_bytes") != len(bodies[name]):
            raise ResearchError("integrity_failed")
        hashed.append((name, digest, len(bodies[name])))
    if manifest.get("artifact_sha256") != manifest_sha256(tuple(hashed)):
        raise ResearchError("integrity_failed")
    return bodies["train.parquet"], bodies["test.parquet"], bodies["manifest.json"]


def _read(storage: ObjectStorage, record: _FileRef) -> bytes:
    key = record.storage_uri
    if not key:
        raise ResearchError("missing_artifact")
    try:
        stream, _info = storage.get_stream(object_key=key)
    except Exception as exc:
        raise ResearchError("missing_artifact") from exc
    return b"".join(stream)


def _open_experiment(
    session_factory: SessionFactory,
    version_id: object,
    profile: ExperimentProfile,
) -> str:
    session = session_factory()
    try:
        human_id = next_human_id(session, DatasetExperiment.human_id, "RSCH")
        session.add(
            DatasetExperiment(
                dataset_version_id=version_id,  # type: ignore[arg-type]
                human_id=human_id,
                name="PhreshPhish URL n-gram FFN",
                status="running",
                experiment_type="url_ngram_ffn",
                approach="URL character 4-gram binary bag-of-words, CPU FFN",
                started_at=datetime.now(UTC),
                config=_public_config(profile),
            )
        )
        session.commit()
        return human_id
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _complete(session_factory: SessionFactory, experiment_id: str, stored: _StoredRun) -> None:
    session = session_factory()
    try:
        row = session.scalar(
            select(DatasetExperiment).where(DatasetExperiment.human_id == experiment_id)
        )
        if row is None:
            raise ResearchError("experiment_missing")
        row.status = "completed"
        row.completed_at = datetime.now(UTC)
        row.config = stored.config
        row.metrics = stored.metrics
        row.model_sha256 = stored.model_sha256
        row.vocabulary_sha256 = stored.vocabulary_sha256
        row.manifest_sha256 = stored.manifest_sha256
        artifacts: dict[str, object] = dict(stored.keys)
        row.private_artifacts = artifacts
        row.metrics_summary = (
            f"accuracy {stored.accuracy:.4f}; "
            f"phishing caught {stored.phishing_caught}/{stored.phishing_support}; "
            f"benign false positives {stored.benign_false_positives}/{stored.benign_support}"
        )
        row.notes = "Deterministic configuration and pinned inputs. Not a paper reproduction."
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def _public_result(experiment_id: str, stored: _StoredRun) -> ExperimentRunResult:
    return {
        "status": "completed",
        "reason": None,
        "experiment_id": experiment_id,
        "accuracy": stored.accuracy,
        "phishing_caught": stored.phishing_caught,
        "phishing_support": stored.phishing_support,
        "benign_false_positives": stored.benign_false_positives,
        "benign_support": stored.benign_support,
        "vocabulary_size": stored.vocabulary_size,
        "parameter_count": stored.parameter_count,
        "model_sha256": stored.model_sha256,
        "vocabulary_sha256": stored.vocabulary_sha256,
        "manifest_sha256": stored.manifest_sha256,
    }


def _fail(session_factory: SessionFactory, experiment_id: str, code: str) -> None:
    session = session_factory()
    try:
        row = session.scalar(
            select(DatasetExperiment).where(DatasetExperiment.human_id == experiment_id)
        )
        if row is None:
            return
        row.status = "failed"
        row.completed_at = datetime.now(UTC)
        row.notes = code
        row.metrics_summary = None
        session.commit()
    except Exception:
        session.rollback()
        logger.exception("could not record experiment failure")
    finally:
        session.close()


def _store(
    storage: ObjectStorage,
    experiment_id: str,
    model_bytes: bytes,
    vocabulary_bytes: bytes,
    manifest_body: bytes,
    uploaded: list[str],
) -> dict[str, str]:
    names = {
        "model": ("model.bin", model_bytes, "application/octet-stream"),
        "vocabulary": ("vocabulary.json", vocabulary_bytes, "application/json"),
        "manifest": ("experiment.json", manifest_body, "application/json"),
    }
    keys: dict[str, str] = {}
    try:
        for label, (filename, payload, content_type) in names.items():
            key = f"experiments/{experiment_id}/{filename}"
            storage.put_file(
                object_key=key,
                fileobj=BytesIO(payload),
                content_type=content_type,
                size_bytes=len(payload),
            )
            uploaded.append(key)
            keys[label] = key
    except Exception as exc:
        raise ResearchError("storage_failed") from exc
    return keys


def _delete_uploaded(storage: ObjectStorage, keys: list[str]) -> None:
    for key in keys:
        try:
            storage.delete(object_key=key)
        except Exception:
            logger.exception("could not delete a partial experiment object")


def _config(
    profile: ExperimentProfile,
    vocabulary: Vocabulary,
    parameter_count: int,
    train_bytes: bytes,
    test_bytes: bytes,
    manifest_bytes: bytes,
) -> dict[str, object]:
    public = _public_config(profile)
    feature = public["feature"]
    model = public["model"]
    if isinstance(feature, dict):
        feature["vocabulary_size"] = len(vocabulary.tokens)
    if isinstance(model, dict):
        model["parameter_count"] = parameter_count
        model["input_dim"] = len(vocabulary.tokens)
    public["dataset"] = {
        "id": profile.dataset_id,
        "version_label": profile.derivation_fingerprint,
        "derivation_profile": profile.derivation_profile,
        "derivation_fingerprint": profile.derivation_fingerprint,
        "source_revision": profile.source_revision,
        "train_sha256": sha256_bytes(train_bytes),
        "test_sha256": sha256_bytes(test_bytes),
        "manifest_sha256": sha256_bytes(manifest_bytes),
    }
    public["library_versions"] = {
        "numpy": np.__version__,
        "python": platform.python_version(),
    }
    return public


def _public_config(profile: ExperimentProfile) -> dict[str, object]:
    return {
        "profile": profile.name,
        "code_version": CODE_VERSION,
        "seed": profile.seed,
        "label_mapping": {"benign": 0, "phish": 1},
        "url_preprocessing": "stored_string_unchanged",
        "feature": {
            "pipeline": "url-char-ngram-bow-v1",
            "ngram_length": profile.ngram_length,
            "min_count_exclusive": profile.min_count_exclusive,
            "max_features": profile.max_features,
            "representation": "binary",
            "vocabulary_fit": "train_only",
            "ordering": "count_desc_then_token",
            "index_zero_included": True,
            "final_ngram_included": True,
        },
        "model": {
            "architecture": "dense-32-relu-sigmoid-v1",
            "framework": "numpy",
            "device": "cpu",
            "hidden_units": profile.hidden_units,
            "activation": "relu",
            "output": "sigmoid",
            "loss": "binary_cross_entropy",
            "optimizer": "adam",
            "learning_rate": profile.learning_rate,
            "epochs": profile.epochs,
            "batch_size": profile.batch_size,
            "threshold": profile.threshold,
            "validation": "none_train_all_rows_evaluate_test_once",
        },
    }


def _manifest(
    experiment_id: str,
    profile: ExperimentProfile,
    config: dict[str, object],
    metrics: dict[str, object],
    model_sha256: str,
    vocabulary_sha256: str,
    started: datetime,
    finished: datetime,
) -> dict[str, object]:
    dataset = config.get("dataset")
    feature = config.get("feature")
    model = config.get("model")
    return {
        "experiment_id": experiment_id,
        "profile": profile.name,
        "code_version": CODE_VERSION,
        "dataset": dataset,
        "label_mapping": {"benign": 0, "phish": 1},
        "url_preprocessing": "stored_string_unchanged",
        "feature": feature,
        "model": model,
        "seed": profile.seed,
        "library_versions": config.get("library_versions"),
        "metrics": metrics,
        "model_sha256": model_sha256,
        "vocabulary_sha256": vocabulary_sha256,
        "started_at": started.isoformat(),
        "finished_at": finished.isoformat(),
        "note": "Deterministic configuration and pinned inputs. Not a paper reproduction.",
    }


def _peak_rss() -> int | None:
    try:
        return int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss)
    except AttributeError, OSError, ValueError:
        return None


def _empty(
    status: str,
    reason: str | None,
    experiment_id: str | None = None,
) -> ExperimentRunResult:
    return {
        "status": status,
        "reason": reason,
        "experiment_id": experiment_id,
        "accuracy": None,
        "phishing_caught": None,
        "phishing_support": None,
        "benign_false_positives": None,
        "benign_support": None,
        "vocabulary_size": None,
        "parameter_count": None,
        "model_sha256": None,
        "vocabulary_sha256": None,
        "manifest_sha256": None,
    }
