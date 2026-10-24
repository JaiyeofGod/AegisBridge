"""Load the pinned ATT&CK Enterprise bundle.

Usage from apps/api:

    uv run python -m app.integrations.attack
"""

from __future__ import annotations

import sys

from app.services.attack_sync import sync_attack_enterprise


def main() -> int:
    result = sync_attack_enterprise()
    if result["status"] != "completed":
        print(f"ATT&CK ingestion failed: {result['reason']}")
        return 1
    print(f"release {result['release_version']}")
    print(f"sha256 {result['bundle_sha256']}")
    print(f"fetched_at {result['fetched_at']}")
    print(f"tactics {result['tactics_processed']}")
    print(f"techniques {result['techniques_processed']}")
    print(f"subtechniques {result['subtechniques_processed']}")
    print(f"relationships {result['relationships_processed']}")
    print(f"revoked {result['revoked_count']}")
    print(f"deprecated {result['deprecated_count']}")
    print("status completed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
