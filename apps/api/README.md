# AegisBridge API (`apps/api`)

FastAPI service with Phase 2 domain models, read-only domain `/api/v1` contracts, and the authentication/session/RBAC foundation. Frontend wiring, SSO/MFA, and domain write enforcement are not implemented in this package slice.

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
uv run --project apps/api alembic downgrade 20261020_0005
uv run --project apps/api alembic upgrade head
uv run --project apps/api alembic current
uv run --project apps/api python -m app.db.seed
uv run --project apps/api python -m app.db.seed --reset
```

The empty baseline remains `20261020_0001`. Domain tables are `20261020_0002`. Threat-intelligence tables and `integrations.human_id` are `20261020_0003`. Report definitions and dataset registry metadata are `20261020_0004`. Cyber-range catalog tables and detection metadata columns are `20261020_0005`. Local credentials and sessions are `20261020_0006`. Seed data is not in the migration. Re-running the seed ensures contract rows when the organization already exists.

## Authentication (local)

1. Set `AEGIS_DEV_ADMIN_PASSWORD` in the repo-root `.env` (local/dev/test only).
2. `alembic upgrade head` and `python -m app.db.seed`.
3. `POST /api/v1/auth/login` with email `amara.okonkwo@aegisbridge.example` and that password.
4. Cookie `aegis_session` is HttpOnly. Use it for `/api/v1/auth/me` and `/api/v1/account/*`.

See `docs/security/AUTHENTICATION_AND_RBAC.md`. Never commit a real password. Production must not bootstrap a default password from this variable.

## Health

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready` (PostgreSQL required; Redis optional)
- `GET /api/v1/health`

## Auth and account

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `GET /api/v1/auth/session`
- `GET /api/v1/auth/me`
- `GET /api/v1/account/profile`
- `GET /api/v1/account/security`
- `GET /api/v1/account/preferences`
- `GET /api/v1/account/workspace`

## Domain read API

Requires the domain migration and development seed. Contracts are documented in `docs/api/API_CONTRACTS.md`. These routes remain unauthenticated until the frontend auth wiring slice.

- `GET /api/v1/overview`
- `GET /api/v1/assets` and `GET /api/v1/assets/{asset_id}`
- `GET /api/v1/risks` and `GET /api/v1/risks/{risk_id}`
- `GET /api/v1/vulnerabilities` and `GET /api/v1/vulnerabilities/{vulnerability_id}`
- `GET /api/v1/alerts` and `GET /api/v1/alerts/{alert_id}`
- `GET /api/v1/incidents` and `GET /api/v1/incidents/{incident_id}`
- `GET /api/v1/governance/summary`
- `GET /api/v1/threat-intelligence/*`
- `GET /api/v1/administration/*`
- `GET /api/v1/reports/*`
- `GET /api/v1/datasets` and related experiment routes
- `GET /api/v1/cyber-range/*`

OpenAPI: `GET /openapi.json` and `/docs`. Path IDs are human-readable (`AST-0007`, `LAB-GW-01`, `SCN-0001`). List routes use `page` and `page_size`. Cyber-range routes are read-only catalog metadata. No remote lab control.
