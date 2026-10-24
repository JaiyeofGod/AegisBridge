"""PhreshPhish structure checks. Nulls are allowed. Unexpected labels are not."""

from __future__ import annotations

import pyarrow.parquet as pq

from app.integrations.datasets.errors import DatasetError

REQUIRED_COLUMNS = (
    "sha256",
    "url",
    "label",
    "target",
    "date",
    "lang",
    "lang_score",
    "html",
)
ALLOWED_LABELS = frozenset({"benign", "phish"})


def require_parquet(path: str) -> pq.ParquetFile:
    try:
        parquet = pq.ParquetFile(path)
    except Exception as exc:
        raise DatasetError("malformed_file") from exc
    if parquet.metadata is None or parquet.metadata.num_rows < 1:
        raise DatasetError("empty_dataset")
    names = set(parquet.schema_arrow.names)
    missing = [column for column in REQUIRED_COLUMNS if column not in names]
    if missing:
        raise DatasetError("missing_column")
    return parquet


def require_labels(values: set[str | None]) -> None:
    unexpected = {value for value in values if value is not None and value not in ALLOWED_LABELS}
    if unexpected:
        raise DatasetError("unexpected_label")
