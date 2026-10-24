"""Research dataset ingestion. Fixtures stand in for the PhreshPhish download."""

from __future__ import annotations

import hashlib
from datetime import date
from pathlib import Path
from typing import BinaryIO

import httpx
import pyarrow as pa
import pyarrow.parquet as pq
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.core.config import Settings, get_settings
from app.core.db import SessionLocal
from app.db.seed import seed_development
from app.integrations.datasets.errors import DatasetError
from app.integrations.datasets.hashing import file_sha256, manifest_sha256
from app.integrations.datasets.huggingface import HuggingFacePhreshPhishSource
from app.integrations.datasets.models import LocalArtifact, RemoteFile, SourceManifest
from app.integrations.datasets.profiling import profile_parquet
from app.models.dataset import Dataset, DatasetFile, DatasetVersion
from app.services.dataset_ingest import ingest_dataset
from app.storage.memory import MemoryObjectStorage
from app.storage.protocol import StoredObjectInfo

REVISION = "eca603e0ecd4f698f8d4d226c088659e72681239"
OTHER = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
DEV_PASSWORD = "Dev-Only-Local-Password-1!"


def _settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "dataset_max_download_bytes": 1024 * 1024,
        "dataset_max_profile_rows": 100,
        "huggingface_token": None,
        "app_env": "test",
    }
    values.update(overrides)
    return get_settings().model_copy(update=values)


def _table(rows: list[dict[str, object]]) -> pa.Table:
    return pa.table(
        {
            "sha256": [row["sha256"] for row in rows],
            "url": [row["url"] for row in rows],
            "label": [row["label"] for row in rows],
            "target": [row["target"] for row in rows],
            "date": pa.array([row["date"] for row in rows], type=pa.date32()),
            "lang": [row["lang"] for row in rows],
            "lang_score": pa.array([row["lang_score"] for row in rows], type=pa.float32()),
            "html": [row["html"] for row in rows],
        }
    )


def _row(label: str | None, url: str = "https://example.invalid/item") -> dict[str, object]:
    return {
        "sha256": "ab" * 32,
        "url": url,
        "label": label,
        "target": None,
        "date": date(2026, 1, 2),
        "lang": "en",
        "lang_score": 0.5,
        "html": "<p>fixture</p>",
    }


def _write(
    directory: Path,
    rows: list[dict[str, object]],
    name: str = "train-000.parquet",
) -> LocalArtifact:
    path = directory / name
    pq.write_table(_table(rows), path)
    digest, size = file_sha256(path)
    return LocalArtifact(path=path, source_filename=name, sha256=digest, size_bytes=size)


class ScriptedSource:
    def __init__(
        self,
        rows: list[dict[str, object]] | None = None,
        *,
        revision: str = REVISION,
        error: Exception | None = None,
        malformed: bool = False,
    ) -> None:
        self.rows = rows if rows is not None else [_row("phish"), _row("benign"), _row(None)]
        self.revision = revision
        self.error = error
        self.malformed = malformed
        self.downloads = 0
        self.manifest = SourceManifest(
            source_type="huggingface",
            repository="phreshphish/phreshphish",
            revision=revision,
            files=(RemoteFile(path="data/train-000.parquet", size_bytes=100),),
            license_label="CC BY 4.0",
            reference=f"https://huggingface.co/datasets/phreshphish/phreshphish/tree/{revision}",
        )

    def describe(self) -> SourceManifest:
        if self.error is not None:
            raise self.error
        return self.manifest

    def download(self, directory: Path) -> tuple[LocalArtifact, ...]:
        self.downloads += 1
        if self.malformed:
            path = directory / "train-000.parquet"
            path.write_bytes(b"not-parquet")
            return (
                LocalArtifact(
                    path=path,
                    source_filename=path.name,
                    sha256="cd" * 32,
                    size_bytes=path.stat().st_size,
                ),
            )
        return (_write(directory, self.rows),)


@pytest.fixture
def seeded(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("AEGIS_DEV_ADMIN_PASSWORD", DEV_PASSWORD)
    monkeypatch.setenv("APP_ENV", "test")
    get_settings.cache_clear()
    with SessionLocal() as session:
        seed_development(session)
    _restore()
    yield
    _restore()
    get_settings.cache_clear()


def _restore() -> None:
    with SessionLocal() as session:
        dataset = session.scalar(select(Dataset).where(Dataset.human_id == "DS-0006"))
        if dataset is not None:
            versions = session.scalars(
                select(DatasetVersion).where(
                    DatasetVersion.dataset_id == dataset.id,
                    DatasetVersion.version_label != "registry",
                )
            ).all()
            version_ids = [version.id for version in versions]
            if version_ids:
                session.execute(
                    delete(DatasetFile).where(DatasetFile.dataset_version_id.in_(version_ids))
                )
                session.execute(delete(DatasetVersion).where(DatasetVersion.id.in_(version_ids)))
            dataset.status = "not_downloaded"
            dataset.row_count = None
            dataset.feature_count = None
        session.commit()


def _ingest(
    source: ScriptedSource,
    storage: MemoryObjectStorage | None = None,
    **overrides: object,
) -> dict[str, object]:
    return dict(
        ingest_dataset(
            "DS-0006",
            source=source,
            storage=storage or MemoryObjectStorage(),
            settings=_settings(**overrides),
        )
    )


def test_hash_and_profile_keep_metadata_only(tmp_path: Path) -> None:
    artifact = _write(tmp_path, [_row("phish"), _row("phish"), _row("benign"), _row(None)])
    again, size = file_sha256(artifact.path)
    assert again == artifact.sha256
    assert size == artifact.size_bytes
    assert len(again) == 64
    profile = profile_parquet(str(artifact.path), max_rows=10)
    bounded = profile_parquet(str(artifact.path), max_rows=1)
    assert profile["row_count"] == 4
    assert bounded["profile_truncated"] is True
    assert bounded["label_counts"] is None
    assert profile["duplicate_row_count"] is None
    assert profile["column_count"] == 8
    assert profile["label_counts"] == {"phish": 2, "benign": 1}
    assert "fixture" not in str(profile)
    assert "example.invalid" not in str(profile)
    assert (
        manifest_sha256((("train-000.parquet", again, size),))
        == hashlib.sha256(f"train-000.parquet {again} {size}\n".encode()).hexdigest()
    )


def test_validation_rejects_bad_shapes_and_allows_null_labels(tmp_path: Path) -> None:
    missing = tmp_path / "missing.parquet"
    pq.write_table(pa.table({"label": ["phish"]}), missing)
    with pytest.raises(DatasetError) as missing_column:
        profile_parquet(str(missing), max_rows=10)
    assert missing_column.value.reason == "missing_column"
    empty = tmp_path / "empty.parquet"
    pq.write_table(_table([]), empty)
    with pytest.raises(DatasetError) as empty_error:
        profile_parquet(str(empty), max_rows=10)
    assert empty_error.value.reason == "empty_dataset"
    broken = tmp_path / "broken.parquet"
    broken.write_text("nope", encoding="utf-8")
    with pytest.raises(DatasetError) as malformed:
        profile_parquet(str(broken), max_rows=10)
    assert malformed.value.reason == "malformed_file"
    unexpected = _write(tmp_path, [_row("malware")])
    with pytest.raises(DatasetError) as label_error:
        profile_parquet(str(unexpected.path), max_rows=10)
    assert label_error.value.reason == "unexpected_label"
    nullable = _write(tmp_path, [_row(None), _row("benign")], name="nulls.parquet")
    profile = profile_parquet(str(nullable.path), max_rows=10)
    assert profile["label_counts"] == {"benign": 1}


def test_ingest_stores_private_object_and_cleans_temp(
    seeded: None,
    tmp_path: Path,
) -> None:
    storage = MemoryObjectStorage()
    result = _ingest(ScriptedSource(), storage, dataset_temp_dir=str(tmp_path))
    assert result["status"] == "ready"
    assert result["row_count"] == 3
    assert result["column_count"] == 8
    assert list(tmp_path.iterdir()) == []
    assert storage._objects
    key = next(iter(storage._objects))
    assert key.startswith(f"datasets/DS-0006/{REVISION}/")
    assert "train-000.parquet" in key
    with SessionLocal() as session:
        version = session.scalar(
            select(DatasetVersion).where(DatasetVersion.version_label == REVISION)
        )
        assert version is not None
        assert version.ingestion_status == "ready"
        assert version.artifact_sha256 == result["artifact_sha256"]
        assert version.profile is not None
        assert "fixture" not in str(version.profile)
        dataset = session.scalar(select(Dataset).where(Dataset.human_id == "DS-0006"))
        assert dataset is not None
        assert dataset.status == "ready"
        registry = session.scalar(
            select(DatasetVersion).where(
                DatasetVersion.dataset_id == dataset.id,
                DatasetVersion.version_label == "registry",
            )
        )
        assert registry is not None
        assert registry.ingestion_status is None


def test_same_revision_is_not_downloaded_twice(seeded: None) -> None:
    source = ScriptedSource()
    storage = MemoryObjectStorage()
    first = _ingest(source, storage)
    second = _ingest(source, storage)
    assert first["status"] == "ready"
    assert second["status"] == "already_ingested"
    assert source.downloads == 1
    with SessionLocal() as session:
        ready = session.scalars(
            select(DatasetVersion).where(DatasetVersion.ingestion_status == "ready")
        ).all()
    assert len(ready) == 1


def test_new_revision_keeps_the_previous_ready_version(seeded: None) -> None:
    storage = MemoryObjectStorage()
    _ingest(ScriptedSource(revision=REVISION), storage)
    failed = _ingest(ScriptedSource(revision=OTHER, malformed=True), storage)
    assert failed["status"] == "failed"
    with SessionLocal() as session:
        rows = session.scalars(select(DatasetVersion)).all()
        by_label = {row.version_label: row.ingestion_status for row in rows}
        dataset = session.scalar(select(Dataset).where(Dataset.human_id == "DS-0006"))
    assert by_label[REVISION] == "ready"
    assert by_label[OTHER] == "failed"
    assert dataset is not None
    assert dataset.status == "ready"


def test_upload_failure_does_not_mark_ready(seeded: None) -> None:
    class BoomStorage(MemoryObjectStorage):
        def put_file(
            self,
            *,
            object_key: str,
            fileobj: BinaryIO,
            content_type: str | None,
            size_bytes: int,
        ) -> StoredObjectInfo:
            raise RuntimeError("disk")

    result = _ingest(ScriptedSource(), BoomStorage())
    assert result["status"] == "failed"
    assert result["reason"] == "upload_failed"
    with SessionLocal() as session:
        ready = session.scalar(
            select(DatasetVersion).where(DatasetVersion.ingestion_status == "ready")
        )
        dataset = session.scalar(select(Dataset).where(Dataset.human_id == "DS-0006"))
    assert ready is None
    assert dataset is not None
    assert dataset.status == "failed"


def test_ingestion_does_not_accept_a_caller_url_or_pickle() -> None:
    import inspect

    parameters = inspect.signature(ingest_dataset).parameters
    assert "url" not in parameters
    assert "source_url" not in parameters
    package = Path(__file__).resolve().parents[1] / "app" / "integrations" / "datasets"
    source = "\n".join(path.read_text(encoding="utf-8") for path in package.glob("*.py"))
    assert "pickle" not in source
    assert "eval(" not in source


def test_unapproved_dataset_makes_no_source_call() -> None:
    class Boom:
        def describe(self) -> SourceManifest:
            raise AssertionError("network")

        def download(self, directory: Path) -> tuple[LocalArtifact, ...]:
            raise AssertionError("network")

    result = ingest_dataset("DS-0001", source=Boom(), storage=MemoryObjectStorage())
    assert result["status"] == "rejected"
    assert result["reason"] == "unapproved_source"


def test_oversized_source_is_rejected_before_download(seeded: None) -> None:
    source = ScriptedSource(
        error=DatasetError(
            "too_large",
            revision=REVISION,
            reference="https://huggingface.co/datasets/phreshphish/phreshphish",
        )
    )
    result = _ingest(source, dataset_max_download_bytes=10)
    assert result["status"] == "failed"
    assert result["reason"] == "too_large"
    assert source.downloads == 0


def test_huggingface_client_rejects_foreign_redirects_and_hides_token(
    caplog: pytest.LogCaptureFixture,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/phreshphish"):
            return httpx.Response(302, headers={"location": "https://evil.example/dataset"})
        return httpx.Response(404)

    source = HuggingFacePhreshPhishSource(
        _settings(huggingface_token="hf-unit-token"),
        transport=httpx.MockTransport(handler),
    )
    with caplog.at_level("DEBUG"), pytest.raises(DatasetError) as error:
        source.describe()
    assert error.value.reason == "endpoint_rejected"
    assert "hf-unit-token" not in caplog.text
    assert "hf-unit-token" not in str(error.value)
    source.close()


def test_detail_exposes_profile_without_rows_or_object_keys(
    seeded: None,
    client: TestClient,
) -> None:
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "amara.okonkwo@aegisbridge.example", "password": DEV_PASSWORD},
    )
    assert login.status_code == 200
    _ingest(ScriptedSource([_row("phish"), _row("benign")]))
    detail = client.get("/api/v1/datasets/DS-0006").json()
    ingested = next(item for item in detail["versions"] if item["version_label"] == REVISION)
    assert ingested["ingestion_status"] == "ready"
    assert ingested["sha256"]
    assert ingested["row_count"] == 2
    assert ingested["label_counts"] == {"phish": 1, "benign": 1}
    assert detail["files"][0]["has_storage_uri"] is True
    assert "storage_uri" not in detail["files"][0]
    encoded = str(detail)
    assert "datasets/DS-0006" not in encoded
    assert "<p>" not in encoded
    spec = client.get("/openapi.json").json()
    properties = spec["components"]["schemas"]["DatasetVersionItem"]["properties"]
    assert "sha256" in properties
    assert "storage_uri" not in properties
    assert "html" not in properties
