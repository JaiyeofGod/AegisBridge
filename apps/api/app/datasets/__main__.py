"""Research dataset commands.

Usage from apps/api:

    uv run python -m app.datasets ingest DS-0006
    uv run python -m app.datasets derive DS-0006 --profile phreshphish-url-baseline-v1
"""

from __future__ import annotations

import sys

from app.services.dataset_derive import derive_dataset
from app.services.dataset_ingest import ingest_dataset


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) == 2 and args[0] == "ingest":
        return _ingest(args[1])
    if len(args) == 4 and args[0] == "derive" and args[2] == "--profile":
        return _derive(args[1], args[3])
    print("usage: python -m app.datasets ingest DS-0006")
    print("       python -m app.datasets derive DS-0006 --profile phreshphish-url-baseline-v1")
    return 2


def _ingest(dataset_id: str) -> int:
    result = ingest_dataset(dataset_id)
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


def _derive(dataset_id: str, profile_name: str) -> int:
    result = derive_dataset(dataset_id, profile_name)
    print(f"dataset {result['dataset_id']}")
    print(f"profile {result['profile']}")
    print(f"status {result['status']}")
    if result["reason"]:
        print(f"reason {result['reason']}")
    if result["revision"]:
        print(f"revision {result['revision']}")
    if result["fingerprint"]:
        print(f"fingerprint {result['fingerprint']}")
    if result["artifact_sha256"]:
        print(f"sha256 {result['artifact_sha256']}")
        print(f"train {result['train_rows']}")
        print(f"test {result['test_rows']}")
        print(f"test_benign {result['test_benign']}")
        print(f"test_phish {result['test_phish']}")
        print(f"bytes_downloaded {result['bytes_downloaded']}")
    print("integrity SHA-256 calculated by AegisBridge at ingestion.")
    print("derived artifact only; no model was trained.")
    return 0 if result["status"] in {"ready", "already_materialized"} else 1


if __name__ == "__main__":
    sys.exit(main())
