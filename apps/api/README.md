# AegisBridge API (`apps/api`)

FastAPI service with Phase 2 domain models, session authentication, enforced RBAC on domain reads, synchronizer CSRF, and authenticated writes for account preferences, risk treatment, incidents, vulnerability remediation, administration (access reviews, user status, role assignment), governance control implementation/tests, and evidence metadata plus control linking. File upload / object storage for evidence is not implemented. Frontend guards are UX only. Integration/report/cyber-range writes, SSO/MFA, and rate limiting remain deferred.

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

The empty baseline remains `20261020_0001`. Domain tables are `20261020_0002`. Threat-intelligence tables and `integrations.human_id` are `20261020_0003`. Report definitions and dataset registry metadata are `20261020_0004`. Cyber-range catalog tables and detection metadata columns are `20261020_0005`. Local credentials and sessions are `20261020_0006`. CSRF digests and `user_preferences` are `20261020_0007`. Control-test public ids (`control_tests.human_id`) are `20261020_0008`. Seed data is not in the migration. Re-running the seed ensures contract rows when the organization already exists.

## Authentication (local)

1. Set `AEGIS_DEV_ADMIN_PASSWORD` in the repo-root `.env` (local/dev/test only).
2. `alembic upgrade head` and `python -m app.db.seed`.
3. `POST /api/v1/auth/login` with email `amara.okonkwo@aegisbridge.example` and that password.
4. Cookie `aegis_session` is HttpOnly. Use it for `/api/v1/auth/me`, `/api/v1/account/*`, and all domain GET routes.
5. Login returns `csrf_token` (or call `GET /api/v1/auth/csrf`). Send `X-CSRF-Token` on logout and all authenticated PATCH/POST mutations.

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
- `GET /api/v1/auth/csrf`
- `GET /api/v1/auth/me`
- `GET /api/v1/account/profile`
- `GET /api/v1/account/security`
- `GET` / `PATCH /api/v1/account/preferences`
- `GET /api/v1/account/workspace`
- `PATCH /api/v1/risks/{risk_id}/treatment` (`risk.manage` + CSRF)
- `PATCH /api/v1/incidents/{incident_id}` (`incident.manage` + CSRF; `incident.close` to resolve/close)
- `PATCH /api/v1/vulnerabilities/{vulnerability_id}/remediation` (`vulnerability.manage` + CSRF)
- `PATCH /api/v1/administration/access-reviews/{review_id}` (`administration.manage` + CSRF)
- `PATCH /api/v1/administration/users/{user_id}` (`administration.manage` + CSRF; status only)
- `PUT /api/v1/administration/users/{user_id}/roles` (`administration.manage` + `user.role.manage` + CSRF)

## Domain read API

Requires the domain migration, development seed, and a valid session cookie. Contracts: `docs/api/API_CONTRACTS.md`. Permission matrix: `docs/security/AUTHENTICATION_AND_RBAC.md`.

- `GET /api/v1/overview` — authenticated; sections filtered by effective permissions
- `GET /api/v1/assets*` — `asset.read`
- `GET /api/v1/risks*` — `risk.read`
- `GET /api/v1/vulnerabilities*` — `vulnerability.read`
- `GET /api/v1/alerts*` — `alert.read`
- `GET /api/v1/incidents*` — `incident.read`
- `GET /api/v1/governance/*` — `control.read`
- `PATCH /api/v1/governance/controls/{id}/implementation`, `POST .../tests`, `PATCH .../control-tests/{id}` — `control.manage` + CSRF
- `POST|DELETE /api/v1/governance/controls/{id}/evidence/{evidence_id}` — `control.manage` + `evidence.manage` + CSRF
- `GET /api/v1/evidence/{id}` — `evidence.read`; `POST /api/v1/evidence` — `evidence.manage` + CSRF (metadata only)
- `GET /api/v1/threat-intelligence/*` — `threat_intel.read`
- `GET /api/v1/administration/*` — `administration.read` (+ `audit.read` / `integration.read` where documented)
- `GET /api/v1/reports/*` — `report.read`
- `GET /api/v1/datasets*` / `dataset-experiments*` — `dataset.read`
- `GET /api/v1/cyber-range/*` — `cyber_range.read`

Unauthenticated callers receive `401`. Authenticated callers missing a permission receive `403`. OpenAPI documents a `SessionCookie` security scheme. Path IDs are human-readable (`AST-0007`, `LAB-GW-01`, `SCN-0001`). Cyber-range remains read-only catalog metadata with no execution.
