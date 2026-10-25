"""Read Parquet column chunks. The HTML column is outside the allowed byte ranges."""

from __future__ import annotations

import struct
from collections.abc import Iterator

import httpx
import pyarrow.parquet as pq

from app.integrations.datasets.errors import DatasetError
from app.integrations.datasets.huggingface import _headers, _require_host

FOOTER_WINDOW = 8 * 1024 * 1024
_PAD = 64


class ByteBudget:
    def __init__(self, limit: int) -> None:
        self.limit = limit
        self.used = 0

    def charge(self, amount: int) -> None:
        if amount < 0 or self.used + amount > self.limit:
            raise DatasetError("derivation_too_large", byte_size=self.limit)
        self.used += amount


class BoundedReader:
    """Seekable reader. Before a column allowlist, only the Parquet tail is readable."""

    closed = False

    def __init__(
        self,
        size: int,
        budget: ByteBudget,
        *,
        footer_window: int = FOOTER_WINDOW,
    ) -> None:
        if size <= footer_window:
            raise DatasetError("projection_unsafe")
        self.size = size
        self.pos = 0
        self.budget = budget
        self.footer_window = footer_window
        self.allowed: list[tuple[int, int]] | None = None
        self._footer_blob: bytes | None = None
        self._footer_start = 0

    def seekable(self) -> bool:
        return True

    def readable(self) -> bool:
        return True

    def writable(self) -> bool:
        return False

    def tell(self) -> int:
        return self.pos

    def close(self) -> None:
        self.closed = True

    def seek(self, offset: int, whence: int = 0) -> int:
        if whence == 0:
            self.pos = offset
        elif whence == 1:
            self.pos += offset
        elif whence == 2:
            self.pos = self.size + offset
        else:
            raise DatasetError("malformed_file")
        return self.pos

    def read(self, size: int = -1) -> bytes:
        if size is None or size < 0:
            size = self.size - self.pos
        size = min(size, self.size - self.pos)
        if size <= 0:
            return b""
        self._permit(self.pos, size)
        if self.allowed is None:
            payload = self._read_metadata(self.pos, size)
        else:
            self.budget.charge(size)
            payload = self._fetch(self.pos, size)
            if len(payload) != size:
                raise DatasetError("malformed_file")
        self.pos += size
        return payload

    def allow_columns(self, parquet: pq.ParquetFile, columns: tuple[str, ...]) -> int:
        spans, estimate = column_spans(parquet, columns)
        tail = max(0, self.size - self.footer_window)
        self.allowed = _merge([*spans, (tail, self.size)])
        return estimate

    def _read_metadata(self, start: int, size: int) -> bytes:
        """Serve the Parquet footer and zeros for any buffered bytes before it."""
        if self._footer_blob is None:
            tail = self._fetch(self.size - 8, 8)
            self.budget.charge(len(tail))
            if len(tail) != 8 or tail[-4:] != b"PAR1":
                raise DatasetError("malformed_file")
            footer_len = struct.unpack("<I", tail[:4])[0]
            if footer_len < 1 or footer_len > self.footer_window:
                raise DatasetError("malformed_file")
            self._footer_start = self.size - 8 - footer_len
            blob = self._fetch(self._footer_start, footer_len + 8)
            self.budget.charge(len(blob))
            if len(blob) != footer_len + 8:
                raise DatasetError("malformed_file")
            self._footer_blob = blob
        out = bytearray(size)
        for index in range(size):
            position = start + index
            if position >= self._footer_start:
                out[index] = self._footer_blob[position - self._footer_start]
        return bytes(out)

    def _permit(self, start: int, size: int) -> None:
        end = start + size
        if self.allowed is None:
            tail = self.size - self.footer_window
            if start < tail:
                raise DatasetError("projection_rejected")
            return
        if any(start >= span_start and end <= span_end for span_start, span_end in self.allowed):
            return
        raise DatasetError("projection_rejected")

    def _fetch(self, start: int, size: int) -> bytes:
        raise NotImplementedError


class MemoryRangeReader(BoundedReader):
    def __init__(
        self,
        payload: bytes,
        budget: ByteBudget,
        *,
        footer_window: int = FOOTER_WINDOW,
    ) -> None:
        super().__init__(len(payload), budget, footer_window=footer_window)
        self.payload = payload
        self.reads: list[tuple[int, int]] = []

    def _fetch(self, start: int, size: int) -> bytes:
        self.reads.append((start, size))
        return self.payload[start : start + size]


class HttpRangeReader(BoundedReader):
    def __init__(
        self,
        client: httpx.Client,
        url: str,
        size: int,
        budget: ByteBudget,
        *,
        token: str | None,
        footer_window: int = FOOTER_WINDOW,
    ) -> None:
        super().__init__(size, budget, footer_window=footer_window)
        self._client = client
        self._url = url
        self._token = token
        self._resolved: str | None = None

    def _fetch(self, start: int, size: int) -> bytes:
        end = start + size - 1
        headers = _headers(self._token)
        headers["Range"] = f"bytes={start}-{end}"
        url = self._resolved or self._url
        for _ in range(4):
            _require_host(url)
            with self._client.stream("GET", url, headers=headers) as response:
                if response.status_code in {301, 302, 303, 307, 308}:
                    location = response.headers.get("location")
                    if not location:
                        raise DatasetError("endpoint_rejected")
                    url = location
                    continue
                if response.status_code != 206:
                    raise DatasetError("range_unsupported")
                declared = response.headers.get("content-length")
                if declared is not None and declared != str(size):
                    raise DatasetError("range_unsupported")
                body = bytearray()
                for chunk in response.iter_bytes():
                    if len(body) + len(chunk) > size:
                        raise DatasetError("range_unsupported")
                    body.extend(chunk)
                if len(body) != size:
                    raise DatasetError("malformed_file")
                self._resolved = url
                return bytes(body)
        raise DatasetError("endpoint_rejected")


def _merge(spans: list[tuple[int, int]]) -> list[tuple[int, int]]:
    merged: list[list[int]] = []
    for start, end in sorted(spans):
        if not merged or start > merged[-1][1]:
            merged.append([start, end])
        else:
            merged[-1][1] = max(merged[-1][1], end)
    return [(start, end) for start, end in merged]


def column_spans(
    parquet: pq.ParquetFile,
    columns: tuple[str, ...],
) -> tuple[list[tuple[int, int]], int]:
    names = list(parquet.schema_arrow.names)
    missing = [column for column in columns if column not in names]
    if missing:
        raise DatasetError("missing_column")
    indexes = [names.index(column) for column in columns]
    metadata = parquet.metadata
    if metadata is None:
        raise DatasetError("malformed_file")
    spans: list[tuple[int, int]] = []
    estimate = 0
    for group_index in range(metadata.num_row_groups):
        group = metadata.row_group(group_index)
        for index in indexes:
            column = group.column(index)
            start = column.dictionary_page_offset
            data_offset = column.data_page_offset
            if start is None or (data_offset is not None and data_offset < start):
                start = data_offset
            if start is None:
                raise DatasetError("malformed_file")
            size = int(column.total_compressed_size)
            if size < 0:
                raise DatasetError("malformed_file")
            spans.append((max(0, int(start) - _PAD), int(start) + size))
            estimate += size
    return spans, estimate


def iter_url_label(parquet: pq.ParquetFile) -> Iterator[tuple[object, object]]:
    for batch in parquet.iter_batches(batch_size=2048, columns=["url", "label"]):
        urls = batch.column(0).to_pylist()
        labels = batch.column(1).to_pylist()
        yield from zip(urls, labels, strict=True)


def html_spans(parquet: pq.ParquetFile) -> list[tuple[int, int]]:
    names = list(parquet.schema_arrow.names)
    if "html" not in names:
        return []
    spans, _ = column_spans(parquet, ("html",))
    return [(start + _PAD, end) for start, end in spans]
