# AegisBridge API (`apps/api`)

FastAPI service with Phase 2 domain models, session authentication, enforced RBAC on domain reads, synchronizer CSRF, and authenticated writes for account preferences, risk treatment, incidents, vulnerability remediation, administration, governance, evidence (including private objects), **policy lifecycle / versioning / acknowledgement**, and **policy↔control mapping**. Object storage uses an S3-compatible abstraction (SeaweedFS locally / Cloudflare R2 hosted). Frontend guards are UX only. Integration/report/cyber-range writes, SSO/MFA, and rate limiting remain deferred.

## Commands

From this directory:

```bash
uv sync
uv run ruff check app tests
uv run ruff format --check app tests
uv run pyright
uv run python -m app.db.test_db ensure
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

The empty baseline remains `20261020_0001`. Domain tables are `20261020_0002`. Threat-intelligence tables and `integrations.human_id` are `20261020_0003`. Report definitions and dataset registry metadata are `20261020_0004`. Cyber-range catalog tables and detection metadata columns are `20261020_0005`. Local credentials and sessions are `20261020_0006`. CSRF digests and `user_preferences` are `20261020_0007`. Control-test public ids (`control_tests.human_id`) are `20261020_0008`. Evidence object metadata (`evidence_objects`) is `20261020_0009`. Policy version lifecycle (`policy_versions.status`, `change_summary`, policy status check) is `20261020_0010`. Policy↔control relationship table (`policy_control_mappings`) is `20261020_0011`. Risk↔control relationship table (`risk_control_mappings`) is `20261020_0012`. Seed data is not in the migration. Re-running the seed ensures contract rows when the organization already exists.

### Policy ↔ control mappings

- Relationship-only rows in `policy_control_mappings` (unique `(policy_id, control_id)`). No control title/text duplication and no licensed CIS safeguard prose.
- `POST /api/v1/policies/{policy_id}/controls/{control_id}` (`policy.manage` + CSRF): link by human ids; duplicate links are idempotent (`linked: true`).
- `DELETE` same path: removes the relationship only (policy, control, evidence, and tests remain). Missing link → `404` (same convention as evidence unlink).
- `GET /policies/{id}` returns mapped controls with `licensed_text_included=false`. `GET /governance/controls/{id}` returns minimal mapped policy refs.
- Frontend mapping UI is not wired yet.

### Evidence object storage

- Bytes live outside PostgreSQL (SeaweedFS S3 locally; R2 in hosted envs).
- `POST /api/v1/evidence/{id}/object` (multipart `file`, `evidence.manage` + CSRF): one object per evidence; server-side SHA-256; max size `EVIDENCE_MAX_UPLOAD_BYTES` (default 25 MiB).
- `GET /api/v1/evidence/{id}/object` (`evidence.read`): authenticated private stream; no public URLs.
- `DELETE /api/v1/evidence/{id}/object` (`evidence.manage` + CSRF): removes object bytes; keeps evidence metadata.
- Malware scanning is not implemented. `integrity_verified` stays false (ingestion hash ≠ independent verification).
- Object storage is an optional health check; platform readiness does not require SeaweedFS.

## Authentication (local)

Settings load the repository-root `.env` (`AegisBridge/.env`) through `app.core.config.Settings`. There is no second dotenv reader in the seed command.

1. Set `AEGIS_DEV_ADMIN_PASSWORD` in that `.env`. There is no default password.
2. Ensure PostgreSQL is running and migrations are at head.
3. From `apps/api`, with the API virtualenv active: `python -m app.db.seed` (or `uv run python -m app.db.seed`).
4. Start FastAPI and sign in as `amara.okonkwo@aegisbridge.example` with the password from the environment.
5. Cookie `aegis_session` is HttpOnly. Use it for `/api/v1/auth/me`, `/api/v1/account/*`, and all domain GET routes.
6. Login returns `csrf_token` (or call `GET /api/v1/auth/csrf`). Send `X-CSRF-Token` on logout and all authenticated PATCH/POST mutations.

Re-running the seed is idempotent. In `local` / `development` / `dev` it rewrites the `USR-0001` Argon2id hash to the current `AEGIS_DEV_ADMIN_PASSWORD` and keeps that user active with the Administrator role. A missing or blank password in those environments stops the seed with `AEGIS_DEV_ADMIN_PASSWORD must be set before seeding development credentials.` Changing the local password requires running the seed again.

`APP_ENV=test` updates the hash only when the variable is set, so tests can use a synthetic password. `APP_ENV=production` never synchronizes this credential. `python -m app.db.seed --check` reports whether the user, credential row, and configured password match, without printing the password or hash.

Pytest sets `APP_ENV=test` and opens `TEST_DATABASE_URL` only. That URL must name a different database from `DATABASE_URL`; the suite refuses to migrate or seed when the two resolve to the same database. The schema comes from Alembic `upgrade head` on the test database. The development database, including the local Administrator hash, is not modified. `APP_ENV=production` ignores `TEST_DATABASE_URL`.

On an existing Compose volume, create the test database once:

```bash
python -m app.db.test_db ensure
python -m app.db.test_db check
```

`ensure` creates the missing test database and never drops the development database. It does not print credentials. PostgreSQL init scripts do not re-run against a volume that already has data.

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
- `GET /api/v1/governance/controls` — paginated catalog; optional `q` (metadata), `framework`, `implementation_status`, allowlisted `sort`/`direction`; `page_size` max 100; no licensed CIS text
- `PATCH /api/v1/governance/controls/{id}/implementation`, `POST .../tests`, `PATCH .../control-tests/{id}` — `control.manage` + CSRF
- `POST|DELETE /api/v1/governance/controls/{id}/evidence/{evidence_id}` — `control.manage` + `evidence.manage` + CSRF
- `GET /api/v1/policies*` — `policy.read`; list supports metadata `q`, `status`, allowlisted `sort`/`direction` (`page_size` max 100; no version bodies in list items)
- `POST /api/v1/policies`, `PATCH /api/v1/policies/{id}`, version create/update — `policy.manage` + CSRF
- `POST /api/v1/policies/{id}/transition` — `policy.manage` or `policy.approve` (transition-specific) + CSRF
- `POST /api/v1/policies/{id}/acknowledge` — self-ack current published version (`policy.read` + CSRF)
- `POST|DELETE /api/v1/policies/{id}/controls/{control_id}` — link/unlink control (`policy.manage` + CSRF); relationship only
- `POST|DELETE /api/v1/risks/{id}/controls/{control_id}` — link/unlink control (`risk.manage` + CSRF, no body). Mapping does not change scores, treatment, or implementation status and does not prove effectiveness. Risk detail `control_mappings` and control detail `risks` use human ids only.
- `GET /api/v1/evidence/{id}` — `evidence.read`; `POST /api/v1/evidence` — `evidence.manage` + CSRF (metadata)
- `POST|GET|DELETE /api/v1/evidence/{id}/object` — upload/download/delete private object (`evidence.manage` for mutations + CSRF; `evidence.read` for download)
- `GET /api/v1/threat-intelligence/*` — `threat_intel.read`
- `GET /api/v1/administration/*` — `administration.read` (+ `audit.read` / `integration.read` where documented)
- `GET /api/v1/reports/*` — `report.read`
- `GET /api/v1/datasets*` / `dataset-experiments*` — `dataset.read`
- `GET /api/v1/cyber-range/*` — `cyber_range.read`

Unauthenticated callers receive `401`. Authenticated callers missing a permission receive `403`. OpenAPI documents a `SessionCookie` security scheme. Path IDs are human-readable (`AST-0007`, `LAB-GW-01`, `SCN-0001`). Cyber-range remains read-only catalog metadata with no execution.
