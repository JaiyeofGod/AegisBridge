# AegisBridge API (`apps/api`)

FastAPI service with the Phase 2 domain models and read-only `/api/v1` contracts. Authentication, writes, and frontend wiring are not implemented.

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

The empty baseline remains `20261020_0001`. Domain tables are `20261020_0002`. Threat-intelligence tables and `integrations.human_id` are `20261020_0003`. Report definitions and dataset registry metadata are `20261020_0004`. Seed data is not in the migration. Re-running the seed ensures contract rows when the organization already exists.

## Health

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready` (PostgreSQL required; Redis optional)
- `GET /api/v1/health`

## Read-only domain API

Requires the domain migration and development seed. Contracts are documented in `docs/api/API_CONTRACTS.md`.

- `GET /api/v1/overview`
- `GET /api/v1/assets` and `GET /api/v1/assets/{asset_id}`
- `GET /api/v1/risks` and `GET /api/v1/risks/{risk_id}`
- `GET /api/v1/vulnerabilities` and `GET /api/v1/vulnerabilities/{vulnerability_id}`
- `GET /api/v1/alerts` and `GET /api/v1/alerts/{alert_id}`
- `GET /api/v1/incidents` and `GET /api/v1/incidents/{incident_id}`
- `GET /api/v1/governance/summary`
- `GET /api/v1/threat-intelligence/summary`
- `GET /api/v1/threat-intelligence/indicators` and `GET /api/v1/threat-intelligence/indicators/{indicator_id}`
- `GET /api/v1/threat-intelligence/advisories`
- `GET /api/v1/threat-intelligence/sources`
- `GET /api/v1/administration/summary`
- `GET /api/v1/administration/integrations`
- `GET /api/v1/administration/users`
- `GET /api/v1/administration/roles`
- `GET /api/v1/administration/audit-events`
- `GET /api/v1/administration/access-reviews`
- `GET /api/v1/reports/summary`
- `GET /api/v1/reports/definitions` and `GET /api/v1/reports/definitions/{report_id}`
- `GET /api/v1/datasets` and `GET /api/v1/datasets/{dataset_id}`
- `GET /api/v1/dataset-experiments` and `GET /api/v1/dataset-experiments/{experiment_id}`

OpenAPI: `GET /openapi.json` and `/docs`. Path IDs are human-readable (`AST-0007`). List routes use `page` and `page_size`.
