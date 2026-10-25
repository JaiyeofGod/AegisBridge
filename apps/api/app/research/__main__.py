"""Run one approved research profile.

Usage from apps/api:

    uv run python -m app.research run --profile phreshphish-url-ffn-v1
"""

from __future__ import annotations

import sys

from app.research.runner import run_experiment


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) == 3 and args[0] == "run" and args[1] == "--profile":
        return _run(args[2])
    print("usage: python -m app.research run --profile phreshphish-url-ffn-v1")
    return 2


def _run(profile_name: str) -> int:
    result = run_experiment(profile_name)
    print(f"status {result['status']}")
    if result["reason"]:
        print(f"reason {result['reason']}")
    if result["experiment_id"]:
        print(f"experiment {result['experiment_id']}")
    if result["status"] != "completed":
        return 1
    print(f"accuracy {result['accuracy']}")
    print(f"phishing_caught {result['phishing_caught']}/{result['phishing_support']}")
    print(f"benign_false_positives {result['benign_false_positives']}/{result['benign_support']}")
    print(f"vocabulary_size {result['vocabulary_size']}")
    print(f"parameter_count {result['parameter_count']}")
    print(f"model_sha256 {result['model_sha256']}")
    print(f"vocabulary_sha256 {result['vocabulary_sha256']}")
    print(f"manifest_sha256 {result['manifest_sha256']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
