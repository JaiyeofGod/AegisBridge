# AegisBridge API (`apps/api`)

FastAPI service with the Phase 2 domain models. Authentication and domain HTTP routes are not implemented.

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
uv run --project apps/api alembic downgrade 20261020_0001
uv run --project apps/api alembic upgrade head
uv run --project apps/api alembic current
uv run --project apps/api python -m app.db.seed
uv run --project apps/api python -m app.db.seed --reset
```

The empty baseline remains `20261020_0001`. Domain tables are `20261020_0002`. Seed data is not in the migration.

## Health

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready` (PostgreSQL required; Redis optional)
- `GET /api/v1/health`
