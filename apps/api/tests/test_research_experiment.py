"""Experiment runner using synthetic parquet. No Hugging Face and no SeaweedFS."""

from __future__ import annotations

import json
from io import BytesIO
from typing import BinaryIO

import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from tests.test_read_api import FORBIDDEN_KEYS, UUID_RE, assert_safe

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.integrations.datasets.hashing import manifest_sha256
from app.main import create_app
from app.models.dataset import Dataset, DatasetExperiment, DatasetFile, DatasetVersion
from app.research.__main__ import main
from app.research.artifacts import sha256_bytes
from app.research.profiles import PINNED_DERIVATION_FINGERPRINT, PROFILE_NAME
from app.research.runner import run_experiment
from app.storage.factory import set_object_storage_override
from app.storage.memory import MemoryObjectStorage
from app.storage.protocol import StoredObjectInfo

DEV_PASSWORD = "Dev-Only-Local-Password-1!"
REVISION = "eca603e0ecd4f698f8d4d226c088659e72681239"
PREFIX = "abcdefghijklmnopqrstuvwxyz"


def _url(suffix: str) -> str:
    return f"{PREFIX}-{suffix}"


def _table(rows: list[tuple[str, str]]) -> bytes:
    table = pa.table(
        {
            "url": pa.array([url for url, _label in rows], type=pa.string()),
            "label": pa.array([label for _url, label in rows], type=pa.string()),
        }
    )
    sink = pa.BufferOutputStream()
    pq.write_table(table, sink)
    return sink.getvalue().to_pybytes()


def _train_rows() -> list[tuple[str, str]]:
    rows = [(_url(f"benign-{index:04d}"), "benign") for index in range(12)]
    rows.extend((_url(f"phish-{index:04d}"), "phish") for index in range(12))
    return rows


def _test_rows() -> list[tuple[str, str]]:
    rows = [(f"QQQQQQQQQQQQ-benign-{index}", "benign") for index in range(2)]
    rows.extend((f"QQQQQQQQQQQQ-phish-{index}", "phish") for index in range(2))
    return rows


def _manifest(train: bytes, test: bytes) -> bytes:
    files = {
        "test.parquet": {"sha256": sha256_bytes(test), "size_bytes": len(test)},
        "train.parquet": {"sha256": sha256_bytes(train), "size_bytes": len(train)},
    }
    artifact = manifest_sha256(
        (
            ("train.parquet", files["train.parquet"]["sha256"], len(train)),
            ("test.parquet", files["test.parquet"]["sha256"], len(test)),
        )
    )
    payload = {
        "artifact_sha256": artifact,
        "dataset_id": "DS-0006",
        "derivation_fingerprint": PINNED_DERIVATION_FINGERPRINT,
        "derivation_profile": "phreshphish-url-baseline-v1",
        "files": files,
        "source_revision": REVISION,
    }
    return json.dumps(payload, sort_keys=True).encode()


@pytest.fixture
def seeded(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", DEV_PASSWORD)
    monkeypatch.setenv("APP_ENV", "test")
    get_settings.cache_clear()
    with SessionLocal() as session:
        seed_development(session)
    _cleanup()
    yield
    set_object_storage_override(None)
    _cleanup()
    get_settings.cache_clear()


def _cleanup() -> None:
    with SessionLocal() as session:
        dataset = session.scalar(select(Dataset).where(Dataset.human_id == "DS-0006"))
        if dataset is None:
            return
        versions = session.scalars(
            select(DatasetVersion).where(
                DatasetVersion.dataset_id == dataset.id,
                DatasetVersion.version_label == PINNED_DERIVATION_FINGERPRINT,
            )
        ).all()
        version_ids = [version.id for version in versions]
        if version_ids:
            session.execute(
                delete(DatasetExperiment).where(
                    DatasetExperiment.dataset_version_id.in_(version_ids)
                )
            )
            session.execute(
                delete(DatasetFile).where(DatasetFile.dataset_version_id.in_(version_ids))
            )
            session.execute(delete(DatasetVersion).where(DatasetVersion.id.in_(version_ids)))
        session.commit()


def _install(
    storage: MemoryObjectStorage,
    *,
    train: bytes | None = None,
    test: bytes | None = None,
    manifest: bytes | None = None,
    recorded_train_sha: str | None = None,
) -> None:
    train_body = _table(_train_rows()) if train is None else train
    test_body = _table(_test_rows()) if test is None else test
    manifest_body = _manifest(train_body, test_body) if manifest is None else manifest
    bodies = {
        "train.parquet": train_body,
        "test.parquet": test_body,
        "manifest.json": manifest_body,
    }
    keys = {
        name: f"datasets/DS-0006/derived/{REVISION}/{PINNED_DERIVATION_FINGERPRINT}/{name}"
        for name in bodies
    }
    for name, payload in bodies.items():
        storage.put_file(
            object_key=keys[name],
            fileobj=BytesIO(payload),
            content_type="application/octet-stream",
            size_bytes=len(payload),
        )
    with SessionLocal() as session:
        dataset = session.scalar(select(Dataset).where(Dataset.human_id == "DS-0006"))
        assert dataset is not None
        version = DatasetVersion(
            dataset_id=dataset.id,
            version_label=PINNED_DERIVATION_FINGERPRINT,
            source_type="derived",
            source_revision=REVISION,
            ingestion_status="ready",
            validation_status="passed",
            profile={
                "derived": True,
                "derivation_profile": "phreshphish-url-baseline-v1",
                "derivation_fingerprint": PINNED_DERIVATION_FINGERPRINT,
            },
        )
        session.add(version)
        session.flush()
        for name, payload in bodies.items():
            digest = sha256_bytes(payload)
            if name == "train.parquet" and recorded_train_sha is not None:
                digest = recorded_train_sha
            session.add(
                DatasetFile(
                    dataset_version_id=version.id,
                    filename=name,
                    sha256=digest,
                    size_bytes=len(payload),
                    storage_uri=keys[name],
                )
            )
        session.commit()


def test_ready_artifact_trains_once_and_hides_storage_keys(seeded: None) -> None:
    storage = MemoryObjectStorage()
    _install(storage)
    set_object_storage_override(storage)
    assert main(["run", "--profile", PROFILE_NAME]) == 0
    assert main(["run", "--profile", PROFILE_NAME]) == 0
    with SessionLocal() as session:
        rows = session.scalars(
            select(DatasetExperiment)
            .where(DatasetExperiment.experiment_type == "url_ngram_ffn")
            .order_by(DatasetExperiment.human_id)
        ).all()
    assert [row.human_id for row in rows] == ["RSCH-0005", "RSCH-0006"]
    assert rows[0].status == "completed"
    assert rows[1].status == "completed"
    assert rows[0].metrics_summary == rows[1].metrics_summary
    assert rows[0].private_artifacts != rows[1].private_artifacts
    first_id = "RSCH-0005"
    first_model = rows[0].model_sha256
    first_vocabulary = rows[0].vocabulary_sha256
    first_manifest = rows[0].manifest_sha256
    manifest_key = f"experiments/{first_id}/experiment.json"
    vocabulary_key = f"experiments/{first_id}/vocabulary.json"
    model_key = f"experiments/{first_id}/model.bin"
    manifest = json.loads(storage._objects[manifest_key][0])
    vocabulary = json.loads(storage._objects[vocabulary_key][0])
    encoded = json.dumps(manifest)
    assert "example" not in encoded
    assert PREFIX not in encoded
    assert "QQQQ" not in json.dumps(vocabulary["tokens"])
    assert sha256_bytes(storage._objects[model_key][0]) == first_model
    assert sha256_bytes(storage._objects[vocabulary_key][0]) == first_vocabulary
    assert sha256_bytes(storage._objects[manifest_key][0]) == first_manifest
    with SessionLocal() as session:
        historical = session.scalar(
            select(DatasetExperiment).where(DatasetExperiment.human_id == "RSCH-0001")
        )
        assert historical is not None
        assert historical.metrics_summary is not None
        assert "No model runtime" in historical.metrics_summary
        assert historical.model_sha256 is None
    application = create_app()
    with TestClient(application) as client:
        assert client.get(f"/api/v1/dataset-experiments/{first_id}").status_code == 401
        login = client.post(
            "/api/v1/auth/login",
            json={"email": "amara.okonkwo@aegisbridge.example", "password": DEV_PASSWORD},
        )
        assert login.status_code == 200
        detail = client.get(f"/api/v1/dataset-experiments/{first_id}").json()
        spec = client.get("/openapi.json").json()
    assert detail["experiment_profile"] == PROFILE_NAME
    assert detail["derivation_fingerprint"] == PINNED_DERIVATION_FINGERPRINT
    assert detail["feature_config"]["vocabulary_fit"] == "train_only"
    assert detail["model_settings"]["device"] == "cpu"
    assert detail["metrics"]["threshold"] == 0.5
    assert detail["confusion_matrix"]["labels"] == ["benign", "phish"]
    assert detail["model_sha256"] == first_model
    assert_safe(detail)
    rendered = str(detail)
    assert "experiments/" not in rendered
    assert PREFIX not in rendered
    assert set(_keys(detail)).isdisjoint(FORBIDDEN_KEYS)
    assert UUID_RE.search(rendered) is None
    spec = client.get("/openapi.json").json()
    experiment_path = spec["paths"]["/api/v1/dataset-experiments/{experiment_id}"]
    assert set(experiment_path) == {"get"}
    properties = spec["components"]["schemas"]["ExperimentDetail"]["properties"]
    assert "model_settings" in properties
    assert "confusion_matrix" in properties
    assert "private_artifacts" not in properties
    assert "storage_uri" not in properties


def test_bad_train_hash_does_not_train(seeded: None) -> None:
    storage = MemoryObjectStorage()
    _install(storage, recorded_train_sha="a" * 64)
    result = run_experiment(PROFILE_NAME, storage=storage)
    assert result["status"] == "failed"
    assert result["reason"] == "integrity_failed"
    assert result["model_sha256"] is None
    assert not any(key.startswith("experiments/") for key in storage._objects)
    _assert_failed(result["experiment_id"])


def test_bad_test_hash_does_not_train(seeded: None) -> None:
    storage = MemoryObjectStorage()
    train = _table(_train_rows())
    test = _table(_test_rows())
    manifest = json.loads(_manifest(train, test))
    manifest["files"]["test.parquet"]["sha256"] = "b" * 64
    _install(storage, train=train, test=test, manifest=json.dumps(manifest).encode())
    result = run_experiment(PROFILE_NAME, storage=storage)
    assert result["reason"] == "integrity_failed"
    assert not any(key.startswith("experiments/") for key in storage._objects)


def test_manifest_fingerprint_mismatch_does_not_train(seeded: None) -> None:
    storage = MemoryObjectStorage()
    train = _table(_train_rows())
    test = _table(_test_rows())
    manifest = json.loads(_manifest(train, test))
    manifest["derivation_fingerprint"] = "c" * 64
    _install(storage, train=train, test=test, manifest=json.dumps(manifest).encode())
    result = run_experiment(PROFILE_NAME, storage=storage)
    assert result["reason"] == "integrity_failed"


def test_invalid_label_fails(seeded: None) -> None:
    storage = MemoryObjectStorage()
    rows = _train_rows()
    rows[0] = (_url("bad"), "phishing")
    _install(storage, train=_table(rows))
    result = run_experiment(PROFILE_NAME, storage=storage)
    assert result["reason"] == "invalid_label"
    assert not any(key.startswith("experiments/") for key in storage._objects)


def test_missing_object_fails(seeded: None) -> None:
    storage = MemoryObjectStorage()
    _install(storage)
    test_key = f"datasets/DS-0006/derived/{REVISION}/{PINNED_DERIVATION_FINGERPRINT}/test.parquet"
    storage.delete(object_key=test_key)
    result = run_experiment(PROFILE_NAME, storage=storage)
    assert result["reason"] == "missing_artifact"
    assert result["model_sha256"] is None
    _assert_failed(result["experiment_id"])


def test_storage_failure_marks_the_experiment_failed(seeded: None) -> None:
    class BoomStorage(MemoryObjectStorage):
        def put_file(
            self,
            *,
            object_key: str,
            fileobj: BinaryIO,
            content_type: str | None,
            size_bytes: int,
        ) -> StoredObjectInfo:
            if object_key.startswith("experiments/"):
                raise RuntimeError("upload failed")
            return super().put_file(
                object_key=object_key,
                fileobj=fileobj,
                content_type=content_type,
                size_bytes=size_bytes,
            )

    storage = BoomStorage()
    _install(storage)
    result = run_experiment(PROFILE_NAME, storage=storage)
    assert result["reason"] == "storage_failed"
    _assert_failed(result["experiment_id"])
    assert not any(key.startswith("experiments/") for key in storage._objects)


def test_cli_rejects_unknown_flags() -> None:
    assert main(["run", "--profile", "missing"]) == 1
    assert main(["run", "--epochs", "1"]) == 2


def _assert_failed(experiment_id: str | None) -> None:
    assert experiment_id is not None
    with SessionLocal() as session:
        row = session.scalar(
            select(DatasetExperiment).where(DatasetExperiment.human_id == experiment_id)
        )
        assert row is not None
        assert row.status == "failed"
        assert row.model_sha256 is None


def _keys(value: object):
    if isinstance(value, dict):
        for key, item in value.items():
            yield key
            yield from _keys(item)
    elif isinstance(value, list):
        for item in value:
            yield from _keys(item)
