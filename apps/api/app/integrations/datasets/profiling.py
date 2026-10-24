"""Bounded dataset profile. Raw text, HTML, and URLs are not stored."""

from __future__ import annotations

from typing import Any

import pyarrow.parquet as pq

from app.integrations.datasets.validators import require_labels, require_parquet

INTEGRITY = "SHA-256 calculated by AegisBridge at ingestion."


def profile_parquet(path: str, *, max_rows: int) -> dict[str, Any]:
    parquet = require_parquet(path)
    metadata = parquet.metadata
    assert metadata is not None
    schema = parquet.schema_arrow
    row_count = int(metadata.num_rows)
    columns = [_column(metadata, schema, index) for index in range(len(schema.names))]
    scanned = min(row_count, max_rows)
    labels, url_lengths = _scan(parquet, scanned)
    require_labels(set(labels))
    counts: dict[str, int] = {}
    for label in labels:
        if label is None:
            continue
        counts[label] = counts.get(label, 0) + 1
    url_stats = _lengths(url_lengths)
    return {
        "format": "parquet",
        "integrity": INTEGRITY,
        "row_count": row_count,
        "column_count": len(columns),
        "columns": columns,
        "label_field": "label",
        "label_counts": counts if scanned == row_count else None,
        "label_count_scope": "full" if scanned == row_count else "bounded",
        "profile_row_cap": max_rows,
        "profile_truncated": scanned < row_count,
        "url_length": url_stats,
        "duplicate_row_count": None,
    }


def _column(metadata: pq.FileMetaData, schema: Any, index: int) -> dict[str, Any]:
    field = schema.field(index)
    null_count = 0
    known = True
    for group_index in range(metadata.num_row_groups):
        column = metadata.row_group(group_index).column(index)
        stats = column.statistics
        if stats is None or not stats.has_null_count:
            known = False
            break
        null_count += int(stats.null_count)
    return {
        "name": field.name,
        "type": str(field.type),
        "null_count": null_count if known else None,
    }


def _scan(parquet: pq.ParquetFile, limit: int) -> tuple[list[str | None], list[int]]:
    labels: list[str | None] = []
    lengths: list[int] = []
    seen = 0
    for batch in parquet.iter_batches(batch_size=1024, columns=["label", "url"]):
        label_values = batch.column(0).to_pylist()
        url_values = batch.column(1).to_pylist()
        for label, url in zip(label_values, url_values, strict=True):
            if seen == limit:
                return labels, lengths
            labels.append(None if label is None else str(label))
            lengths.append(0 if not isinstance(url, str) else len(url))
            seen += 1
    return labels, lengths


def _lengths(values: list[int]) -> dict[str, float] | None:
    if not values:
        return None
    return {
        "min": min(values),
        "max": max(values),
        "mean": round(sum(values) / len(values), 2),
    }
