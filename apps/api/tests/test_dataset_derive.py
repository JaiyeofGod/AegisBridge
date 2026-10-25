"""Derived PhreshPhish artifacts. Fixtures stand in for the Hugging Face download."""

from __future__ import annotations

import inspect
from collections.abc import Iterator
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
from app.datasets.__main__ import main
from app.db.seed import seed_development
from app.integrations.datasets.columns import ProjectionEstimate
from app.integrations.datasets.errors import DatasetError
from app.integrations.datasets.profiles import DerivationProfile, derivation_fingerprint
from app.integrations.datasets.projection import (
    ByteBudget,
    HttpRangeReader,
    MemoryRangeReader,
    html_spans,
    iter_url_label,
)
from app.integrations.datasets.sampling import sample_test_split, sample_train_split
from app.models.dataset import Dataset, DatasetFile, DatasetVersion
from app.services.dataset_derive import derive_dataset
from app.storage.memory import MemoryObjectStorage
from app.storage.protocol import StoredObjectInfo

REVISION = "eca603e0ecd4f698f8d4d226c088659e72681239"
OTHER = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
DEV_PASSWORD = "Dev-Only-Local-Password-1!"


def _profile(**overrides: object) -> DerivationProfile:
    values: dict[str, object] = {
        "name": "fixture-url-v1",
        "dataset_id": "DS-0006",
        "repository": "phreshphish/phreshphish",
        "revision": REVISION,
        "columns": ("url", "label"),
        "train_count": 4,
        "test_benign": 2,
        "test_phish": 2,
        "seed": 42,
        "train_balance": "source_distribution",
        "max_download_bytes": 10_000,
    }
    values.update(overrides)
    return DerivationProfile(**values)  # type: ignore[arg-type]


def _settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "dataset_derivation_max_download_bytes": 10_000,
        "dataset_temp_dir": None,
        "app_env": "test",
        "huggingface_token": None,
    }
    values.update(overrides)
    return get_settings().model_copy(update=values)


def _url(prefix: str, index: int) -> str:
    return f"https://example.invalid/{prefix}-{index}"


def _rows(prefix: str, benign: int, phish: int) -> list[tuple[object, object]]:
    rows: list[tuple[object, object]] = [(_url(prefix, index), "benign") for index in range(benign)]
    rows.extend((_url(prefix, benign + index), "phish") for index in range(phish))
    return rows


class FixtureSource:
    def __init__(
        self,
        train: list[tuple[object, object]],
        test: list[tuple[object, object]],
        *,
        footer_bytes: int = 20,
        column_bytes: int = 30,
        revision: str = REVISION,
    ) -> None:
        self.revision = revision
        self.train = train
        self.test = test
        self.estimate_value = ProjectionEstimate(footer_bytes, column_bytes, 2)
        self.downloaded = footer_bytes
        self.scans: list[str] = []

    def estimate(self) -> ProjectionEstimate:
        return self.estimate_value

    def iter_split(self, split: str) -> Iterator[tuple[object, object]]:
        self.scans.append(split)
        self.downloaded += 15
        rows = self.train if split == "train" else self.test
        return iter(rows)

    def bytes_downloaded(self) -> int:
        return self.downloaded

    def close(self) -> None:
        return None


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


def _derive(
    source: FixtureSource,
    profile: DerivationProfile,
    storage: MemoryObjectStorage | None = None,
    **overrides: object,
) -> dict[str, object]:
    return dict(
        derive_dataset(
            "DS-0006",
            profile.name,
            source=source,
            profile=profile,
            storage=storage or MemoryObjectStorage(),
            settings=_settings(**overrides),
        )
    )


def test_sampling_is_deterministic_balanced_and_isolated() -> None:
    test_rows = _rows("test", 12, 12)
    test_rows.append((_url("test", 0), "benign"))
    test_rows.append((None, "phish"))
    test_rows.append(("  ", "benign"))
    test_rows.append((_url("test", 20), None))
    first = sample_test_split(test_rows, benign=4, phish=4, seed=42)
    second = sample_test_split(test_rows, benign=4, phish=4, seed=42)
    third = sample_test_split(test_rows, benign=4, phish=4, seed=7)
    assert first.rows == second.rows
    assert first.rows != third.rows
    assert [label for _, label in first.rows].count("benign") == 4
    assert [label for _, label in first.rows].count("phish") == 4
    assert first.duplicates_removed == 1
    assert first.null_labels_skipped == 1
    assert first.empty_urls_skipped == 2
    train_rows: list[tuple[object, object]] = [(url, label) for url, label in first.rows]
    train_rows.extend(_rows("train", 8, 3))
    train = sample_train_split(train_rows, count=6, seed=42, excluded=first.selected_keys)
    assert len(train.rows) == 6
    assert first.selected_keys.isdisjoint(train.selected_keys)
    assert train.leakage_removed == 8
    with pytest.raises(DatasetError) as insufficient:
        sample_test_split(_rows("tiny", 1, 5), benign=2, phish=2, seed=42)
    assert insufficient.value.reason == "insufficient_class_rows"
    with pytest.raises(DatasetError) as unexpected:
        sample_test_split([(_url("bad", 1), "malware")], benign=1, phish=1, seed=42)
    assert unexpected.value.reason == "unexpected_label"


def test_fingerprint_tracks_the_recipe_only() -> None:
    profile = _profile()
    original = derivation_fingerprint(profile)
    assert original == derivation_fingerprint(profile)
    assert len(original) == 64
    assert derivation_fingerprint(_profile(seed=7)) != original
    assert derivation_fingerprint(_profile(revision=OTHER)) != original
    assert derivation_fingerprint(_profile(train_count=5)) != original


def test_projection_reads_url_and_label_without_html(tmp_path: Path) -> None:
    path = tmp_path / "test-000.parquet"
    rows = 40
    table = pa.table(
        {
            "url": [_url("proj", index) for index in range(rows)],
            "label": ["phish" if index % 2 == 0 else "benign" for index in range(rows)],
            "html": [f"H{index}-" + ("H" * 5000) for index in range(rows)],
        }
    )
    pq.write_table(table, path, compression="NONE")
    payload = path.read_bytes()
    budget = ByteBudget(len(payload))
    reader = MemoryRangeReader(payload, budget, footer_window=65_536)
    parquet = pq.ParquetFile(reader)
    reader.allow_columns(parquet, ("url", "label"))
    projected = list(iter_url_label(parquet))
    assert len(projected) == rows
    assert {label for _, label in projected} == {"benign", "phish"}
    blocked = html_spans(parquet)
    for start, size in reader.reads:
        end = start + size
        assert all(end <= span_start or start >= span_end for span_start, span_end in blocked)
    assert budget.used < len(payload) // 2
    with pytest.raises(DatasetError) as rejected:
        reader.seek(0)
        reader.allowed = None
        reader.read(16)
    assert rejected.value.reason == "projection_rejected"


def test_http_ranges_reject_a_full_body_and_foreign_host(tmp_path: Path) -> None:
    path = tmp_path / "shard.parquet"
    pq.write_table(
        pa.table(
            {
                "url": [_url("http", index) for index in range(20)],
                "label": ["benign"] * 20,
                "html": ["<p>marker</p>"] * 20,
            }
        ),
        path,
    )
    payload = path.read_bytes()

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host != "huggingface.co":
            return httpx.Response(200, content=payload)
        header = request.headers.get("range")
        if header is None or not header.startswith("bytes="):
            return httpx.Response(200, content=payload)
        start_text, end_text = header.removeprefix("bytes=").split("-", maxsplit=1)
        start = int(start_text)
        end = int(end_text)
        chunk = payload[start : end + 1]
        return httpx.Response(
            206,
            content=chunk,
            headers={"content-length": str(len(chunk))},
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    reader = HttpRangeReader(
        client,
        "https://evil.example/data/test-000.parquet",
        len(payload),
        ByteBudget(10_000_000),
        token="hf-unit-token",
        footer_window=8,
    )
    with pytest.raises(DatasetError) as foreign:
        reader.seek(len(payload) - 8)
        reader.read(8)
    assert foreign.value.reason == "endpoint_rejected"
    assert "hf-unit-token" not in str(foreign.value)
    client.close()


def test_derive_stores_private_parquet_and_cleans_temp(
    seeded: None,
    tmp_path: Path,
    client: TestClient,
) -> None:
    profile = _profile()
    test_rows = _rows("test", 3, 3)
    test_rows.append((_url("test", 0), "benign"))
    test_rows.append((_url("test", 9), None))
    train_rows: list[tuple[object, object]] = [
        (url, label) for url, label in test_rows if isinstance(url, str)
    ]
    train_rows.extend(_rows("train", 5, 2))
    source = FixtureSource(train_rows, test_rows)
    storage = MemoryObjectStorage()
    result = _derive(source, profile, storage, dataset_temp_dir=str(tmp_path))
    assert result["status"] == "ready"
    assert result["train_rows"] == 4
    assert result["test_rows"] == 4
    assert result["test_benign"] == 2
    assert result["test_phish"] == 2
    assert list(tmp_path.iterdir()) == []
    keys = sorted(storage._objects)
    assert len(keys) == 3
    assert all(key.startswith(f"datasets/DS-0006/derived/{REVISION}/") for key in keys)
    assert {key.rsplit("/", 1)[-1] for key in keys} == {
        "train.parquet",
        "test.parquet",
        "manifest.json",
    }
    for name in ("train.parquet", "test.parquet"):
        key = next(item for item in keys if item.endswith(name))
        body = storage._objects[key][0]
        parquet = pq.ParquetFile(pa.BufferReader(body))
        assert list(parquet.schema_arrow.names) == ["url", "label"]
        assert "html" not in parquet.schema_arrow.names
    manifest = next(storage._objects[key][0] for key in keys if key.endswith("manifest.json"))
    assert b"example.invalid" not in manifest
    assert b"html" not in manifest
    with SessionLocal() as session:
        dataset = session.scalar(select(Dataset).where(Dataset.human_id == "DS-0006"))
        assert dataset is not None
        assert dataset.status == "not_downloaded"
        assert dataset.row_count is None
        ready = session.scalar(
            select(DatasetVersion).where(DatasetVersion.version_label == result["fingerprint"])
        )
        assert ready is not None
        assert ready.ingestion_status == "ready"
        assert ready.source_type == "derived"
        assert ready.source_revision == REVISION
        registry = session.scalar(
            select(DatasetVersion).where(
                DatasetVersion.dataset_id == dataset.id,
                DatasetVersion.version_label == "registry",
            )
        )
        assert registry is not None
        assert registry.ingestion_status is None
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "amara.okonkwo@aegisbridge.example", "password": DEV_PASSWORD},
    )
    assert login.status_code == 200
    detail = client.get("/api/v1/datasets/DS-0006").json()
    derived = next(item for item in detail["versions"] if item["derived"] is True)
    assert derived["derivation_profile"] == profile.name
    assert derived["derivation_fingerprint"] == result["fingerprint"]
    assert derived["split_label_counts"]["test"] == {"benign": 2, "phish": 2}
    assert derived["row_count"] == 8
    encoded = str(detail)
    assert "example.invalid" not in encoded
    assert "datasets/DS-0006" not in encoded
    assert "storage_uri" not in detail["files"][0]
    again = _derive(source, profile, storage)
    assert again["status"] == "already_materialized"
    assert source.scans == ["test", "train"]


def test_new_recipe_keeps_the_previous_ready_version(seeded: None) -> None:
    profile = _profile()
    source = FixtureSource(_rows("train", 6, 2), _rows("test", 3, 3))
    storage = MemoryObjectStorage()
    first = _derive(source, profile, storage)
    changed = _profile(seed=7)
    second = _derive(FixtureSource(_rows("train", 6, 2), _rows("test", 3, 3)), changed, storage)
    assert first["status"] == "ready"
    assert second["status"] == "ready"
    assert first["fingerprint"] != second["fingerprint"]
    with SessionLocal() as session:
        ready = session.scalars(
            select(DatasetVersion).where(
                DatasetVersion.ingestion_status == "ready",
                DatasetVersion.source_type == "derived",
            )
        ).all()
        dataset = session.scalar(select(Dataset).where(Dataset.human_id == "DS-0006"))
    assert len(ready) == 2
    assert dataset is not None
    assert dataset.status == "not_downloaded"


def test_oversize_and_upload_failure_do_not_replace_a_ready_version(seeded: None) -> None:
    profile = _profile()
    storage = MemoryObjectStorage()
    ready = _derive(FixtureSource(_rows("train", 6, 2), _rows("test", 3, 3)), profile, storage)
    assert ready["status"] == "ready"

    class BoomStorage(MemoryObjectStorage):
        def __init__(self) -> None:
            super().__init__()
            self.puts = 0

        def put_file(
            self,
            *,
            object_key: str,
            fileobj: BinaryIO,
            content_type: str | None,
            size_bytes: int,
        ) -> StoredObjectInfo:
            self.puts += 1
            if self.puts > 1:
                raise RuntimeError("disk")
            return super().put_file(
                object_key=object_key,
                fileobj=fileobj,
                content_type=content_type,
                size_bytes=size_bytes,
            )

    boom = BoomStorage()
    failed = _derive(
        FixtureSource(_rows("train", 6, 2), _rows("test", 3, 3)),
        _profile(seed=9),
        boom,
    )
    assert failed["status"] == "failed"
    assert failed["reason"] == "upload_failed"
    assert boom._objects == {}
    oversized = FixtureSource(
        _rows("train", 6, 2),
        _rows("test", 3, 3),
        footer_bytes=9_000,
        column_bytes=9_000,
    )
    too_large = _derive(oversized, _profile(seed=11), storage)
    assert too_large["status"] == "failed"
    assert too_large["reason"] == "derivation_too_large"
    assert oversized.scans == []
    with SessionLocal() as session:
        previous = session.scalar(
            select(DatasetVersion).where(DatasetVersion.version_label == ready["fingerprint"])
        )
    assert previous is not None
    assert previous.ingestion_status == "ready"


def test_redirects_stay_on_official_huggingface_domains() -> None:
    from app.integrations.datasets.huggingface import _require_host

    _require_host("https://us.aws.cdn.hf.co/file")
    _require_host("https://huggingface.co/datasets/phreshphish/phreshphish")
    with pytest.raises(DatasetError) as rejected:
        _require_host("https://evil.example/file")
    assert rejected.value.reason == "endpoint_rejected"


def test_callers_cannot_choose_a_url_or_execute_content() -> None:
    parameters = inspect.signature(derive_dataset).parameters
    assert "url" not in parameters
    assert "source_url" not in parameters
    package = Path(__file__).resolve().parents[1] / "app" / "integrations" / "datasets"
    source = "\n".join(path.read_text(encoding="utf-8") for path in package.glob("*.py"))
    assert "pickle" not in source
    assert "eval(" not in source
    rejected = derive_dataset(
        "DS-0001",
        "phreshphish-url-baseline-v1",
        source=FixtureSource([], []),
    )
    assert rejected["status"] == "rejected"
    assert rejected["reason"] == "unapproved_source"
    assert main(["derive", "DS-0006", "--url", "https://evil.example/data"]) == 2
