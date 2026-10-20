# AegisBridge API (`apps/api`)

Phase 1 FastAPI bootstrap: settings, SQLAlchemy session foundation, Alembic baseline, and health endpoints.

## Commands

From this directory:

```bash
uv sync
uv run ruff check app tests
uv run ruff format --check app tests
uv run pyright
uv run pytest

# Run API against Compose Postgres (repo-root `.env`)
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Alembic (from repository root, with `apps/api` venv active or `uv run` from `apps/api`):

```bash
cd ../..
uv run --project apps/api alembic upgrade head
uv run --project apps/api alembic current
```

## Health

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready` (PostgreSQL required; Redis optional)
- `GET /api/v1/health`
