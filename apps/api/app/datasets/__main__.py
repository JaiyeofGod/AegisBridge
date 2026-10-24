"""Ingest one approved research dataset.

Usage from apps/api:

    uv run python -m app.datasets ingest DS-0006
"""

from __future__ import annotations

import sys

from app.services.dataset_ingest import ingest_dataset


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) != 2 or args[0] != "ingest":
        print("usage: python -m app.datasets ingest DS-0006")
        return 2
    result = ingest_dataset(args[1])
    print(f"dataset {result['dataset_id']}")
    print(f"status {result['status']}")
    if result["reason"]:
        print(f"reason {result['reason']}")
    if result["revision"]:
        print(f"revision {result['revision']}")
    if result["artifact_sha256"]:
        print(f"sha256 {result['artifact_sha256']}")
        print(f"bytes {result['byte_size']}")
        print(f"rows {result['row_count']}")
        print(f"columns {result['column_count']}")
    print("integrity SHA-256 calculated by AegisBridge at ingestion.")
    return 0 if result["status"] in {"ready", "already_ingested"} else 1


if __name__ == "__main__":
    sys.exit(main())
