"""Projected PhreshPhish columns at one pinned revision."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass

import httpx
import pyarrow.parquet as pq

from app.core.config import Settings
from app.integrations.datasets.catalog import PHRESHPHISH_REPO
from app.integrations.datasets.errors import DatasetError
from app.integrations.datasets.huggingface import HuggingFacePhreshPhishSource
from app.integrations.datasets.models import RemoteFile
from app.integrations.datasets.projection import (
    FOOTER_WINDOW,
    ByteBudget,
    HttpRangeReader,
    iter_url_label,
)


@dataclass(frozen=True)
class ProjectionEstimate:
    footer_bytes: int
    column_bytes: int
    files_touched: int


class PhreshPhishColumnSource:
    """Official Parquet files. Only url and label chunks are requested."""

    def __init__(
        self,
        settings: Settings,
        revision: str,
        *,
        limit: int,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.revision = revision
        self._settings = settings
        self._budget = ByteBudget(limit)
        self._hf = HuggingFacePhreshPhishSource(settings, transport=transport)
        self._files: list[tuple[str, RemoteFile]] = []

    def close(self) -> None:
        self._hf.close()

    def estimate(self) -> ProjectionEstimate:
        manifest = self._hf.list_revision(self.revision)
        if manifest.revision != self.revision:
            raise DatasetError("malformed_revision", revision=self.revision)
        files: list[tuple[str, RemoteFile]] = []
        column_bytes = 0
        for remote in manifest.files:
            split = _split(remote.path)
            if split is None:
                continue
            if remote.size_bytes <= FOOTER_WINDOW:
                raise DatasetError("projection_unsafe", revision=self.revision)
            reader = self._reader(remote)
            try:
                parquet = pq.ParquetFile(reader)
                column_bytes += reader.allow_columns(parquet, ("url", "label"))
            finally:
                reader.close()
            files.append((split, remote))
        if not any(split == "train" for split, _ in files):
            raise DatasetError("no_files", revision=self.revision)
        if not any(split == "test" for split, _ in files):
            raise DatasetError("no_files", revision=self.revision)
        self._files = files
        return ProjectionEstimate(self._budget.used, column_bytes, len(files))

    def iter_split(self, split: str) -> Iterator[tuple[object, object]]:
        if split not in {"train", "test"}:
            raise DatasetError("unsupported_split")
        for name, remote in self._files:
            if name != split:
                continue
            reader = self._reader(remote)
            try:
                parquet = pq.ParquetFile(reader)
                reader.allow_columns(parquet, ("url", "label"))
                yield from iter_url_label(parquet)
            finally:
                reader.close()

    def bytes_downloaded(self) -> int:
        return self._budget.used

    def _reader(self, remote: RemoteFile) -> HttpRangeReader:
        url = (
            f"https://huggingface.co/datasets/{PHRESHPHISH_REPO}/resolve/"
            f"{self.revision}/{remote.path}"
        )
        return HttpRangeReader(
            self._hf.http,
            url,
            remote.size_bytes,
            self._budget,
            token=self._settings.huggingface_token,
        )


def _split(path: str) -> str | None:
    name = path.rsplit("/", 1)[-1]
    if name.startswith("train-"):
        return "train"
    if name.startswith("test-"):
        return "test"
    return None
