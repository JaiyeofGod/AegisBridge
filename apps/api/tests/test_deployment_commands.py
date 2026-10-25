"""Prove the repository-root launch commands resolve without starting servers."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_api_import_and_alembic_resolve_from_the_repository_root() -> None:
    env = os.environ.copy()
    env["APP_ENV"] = "local"
    env["PYTHONPATH"] = "apps/api"
    env.pop("AEGIS_DEV_ADMIN_PASSWORD", None)
    imports = subprocess.run(
        [
            "uv",
            "run",
            "--project",
            "apps/api",
            "python",
            "-c",
            (
                "import app.main; "
                "from app.workers.celery_app import celery_app; "
                "assert celery_app.conf.worker_pool == 'solo'"
            ),
        ],
        cwd=ROOT,
        env=env,
        check=False,
        capture_output=True,
        text=True,
        timeout=90,
    )
    assert imports.returncode == 0, imports.stderr
    heads = subprocess.run(
        ["uv", "run", "--project", "apps/api", "alembic", "heads"],
        cwd=ROOT,
        env=env,
        check=False,
        capture_output=True,
        text=True,
        timeout=90,
    )
    assert heads.returncode == 0, heads.stderr
    assert "(head)" in heads.stdout
    node = subprocess.run(
        ["node", "--version"],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=20,
    )
    assert node.returncode == 0, node.stderr
    pnpm = subprocess.run(
        ["pnpm", "--version"],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=20,
    )
    assert pnpm.returncode == 0, pnpm.stderr
    assert pnpm.stdout.strip() == "10.18.2"
