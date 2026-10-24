# AegisBridge

Enterprise cybersecurity operations and GRC platform with a separate, isolated cyber range.

This repository is in **Phase 1 — Repository Bootstrap**. Application scaffolding and package installs are not complete yet.

## Authority

| Document | Role |
|---|---|
| `MASTER_REQUIREMENTS.md` | Product, architecture, security, phases |
| `DESIGN_HANDOFF.md` | Frontend visual and routing guidance |
| `ARCHITECTURE.md` and other Phase 0 docs | Implementation architecture baseline |
| `PHASE_1_IMPLEMENTATION_PLAN.md` | Phase 1 bootstrap plan |
| `docs/decisions/` | Architecture Decision Records |

## Local development topology (approved)

```text
Mac (primary development machine)
  ├── Cursor IDE, Git, React (Vite), FastAPI (host processes)
  └── Docker Compose → PostgreSQL 18, Redis/Valkey, SeaweedFS (S3)

Lenovo (later)
  └── Cyber range VMs (Wazuh, Windows, Linux, gateway/Suricata, Kali)
```

- **Mac** is the primary coding workstation.
- During early development, **React** and **FastAPI** run **on the Mac host** for hot reload.
- **PostgreSQL**, **Redis/Valkey**, and **SeaweedFS** (`weed mini` S3 mode) run through **Docker Compose** (`compose.yaml`).
- Production object storage remains **Cloudflare R2**. The API uses an **S3-compatible** storage abstraction (`apps/api/app/storage`) for private evidence objects (not SeaweedFS-specific APIs).
- Apps stay container-ready for later full Docker / Render deployment.
- The **Lenovo** hosts the heavier cyber range later; it is not required for Phase 1 bootstrap.

## Local infrastructure (Docker Compose)

Requires Docker Desktop (or equivalent) and a local `.env` copied from `.env.example`.

```bash
# Validate configuration
docker compose config

# Start data-plane services (Postgres, Valkey, SeaweedFS)
docker compose up -d

# Status / logs
docker compose ps
docker compose logs -f

# Stop (keeps named volumes)
docker compose stop

# Stop and remove containers (keeps named volumes)
docker compose down

# Stop and remove containers + named volumes (destructive to local data)
docker compose down -v
```

Published only on loopback for local Mac host access:

| Service | Ports |
|---|---|
| PostgreSQL 18 | `127.0.0.1:5432` |
| Valkey | `127.0.0.1:6379` |
| SeaweedFS S3 API | `127.0.0.1:8333` |

SeaweedFS image: `chrislusf/seaweedfs:4.48` (`weed mini`, creates `S3_BUCKET` from env).

## Tooling baselines

| Concern | Choice |
|---|---|
| Frontend package manager | pnpm |
| Python environments / locks | uv |
| Python types | Pyright |
| Frontend format | Prettier |
| Python lint/format | Ruff |
| Node | 24 LTS |
| Python | 3.14.x |
| PostgreSQL | 18 |
| Local object storage | SeaweedFS 4.48 (S3) |
| Hosted object storage | Cloudflare R2 |

See `VERSIONS.md` and ADRs in `docs/decisions/`.

## Environment variables

1. Copy `.env.example` to `.env`.
2. Replace placeholder values locally (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, etc.).
3. Never commit `.env` or real secrets (API keys, passwords, session secrets, lab credentials).

## Current status

Root hygiene, Compose infrastructure, and the **FastAPI API bootstrap** (`apps/api`) are in place.

**API (host-run):**

```bash
cd apps/api
uv sync
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Health: `/api/v1/health`, `/api/v1/health/live`, `/api/v1/health/ready`

Schema and development seed (from the repository root, with Compose Postgres running):

```bash
uv run --project apps/api alembic upgrade head
uv run --project apps/api python -m app.db.seed
uv run --project apps/api python -m app.db.seed --reset
```

`--reset` deletes domain rows only when `APP_ENV` is local. It does not drop tables.

Backend tests use a second database on that same PostgreSQL server. `TEST_DATABASE_URL` must name a different database from `DATABASE_URL` (default `aegis_test`). Create it once, then run pytest:

```bash
uv run --project apps/api python -m app.db.test_db ensure
cd apps/api && uv run pytest
```

Pytest migrates that database with Alembic and does not write to the development database. `APP_ENV=production` ignores `TEST_DATABASE_URL`. An existing Compose volume does not create the test database by itself, because PostgreSQL init scripts run only on a fresh data directory.

**Web (host-run):**

```bash
# Node 24 LTS recommended
cd apps/web
pnpm dev
```

The web app reads development API data through the Vite `/api` proxy (`VITE_API_BASE_URL`). Auth uses HttpOnly session cookies with `credentials: "include"`.

Domain read routes, including threat intelligence, administration, reports, datasets, dataset experiments, and cyber-range, are documented in `docs/api/API_CONTRACTS.md`. Auth and Account APIs are documented there and in `docs/security/AUTHENTICATION_AND_RBAC.md`.

**Auth status:** Argon2id passwords + HttpOnly sessions + synchronizer CSRF; domain GET RBAC enforced; preferences, risk treatment, risk↔control mapping, incident, vulnerability, administration, governance, evidence objects, policy lifecycle/versioning/acknowledgement, and policy↔control mapping are wired on the API and UI. Incident → Response Tasks uses public `TASK-NNNN` ids. Completing a task does not close the incident. Cancellation keeps the task in history, and there is no hard delete. Priority, due date, and description are not in the UI. The assignee picker uses `GET /api/v1/directory/users` for active same-organization users when the caller has both `incident.manage` and `directory.read`. It sends human ids only and does not use the Administration users API or show email, roles, or permissions. Automated containment and SOAR remain unsupported. Mapping is relationship-only (Risk → Control → Test → Evidence, and Policy → Control) and does not change scores or prove effectiveness. Governance UI covers policy lifecycle and policy↔control mapping. Control and policy catalogs (and the policy→control selector) use server-side pagination/search/filters with bounded page sizes—no full-catalog preload. Evidence bytes stay outside PostgreSQL (SeaweedFS locally; R2 later). SPA route guards remain UX only. Backend remains the authorization boundary.

On-demand vulnerability intelligence refresh (`POST /api/v1/vulnerabilities/{id}/intelligence/refresh`) reads NVD CVE metadata, the CISA Known Exploited Vulnerabilities catalog, and FIRST EPSS for one CVE. Those three stay separate. AegisBridge does not combine them into one score, and the refresh does not change remediation or `action_decision`.

The vulnerability detail page shows NVD, CISA KEV, and FIRST EPSS separately. A user with `vulnerability.manage` can refresh one CVE. That refresh does not change remediation or `action_decision`. A vulnerability without a CVE stays valid and is not sent to those sources. Scheduled refresh is still future work.

**Not yet created:** Policy rich-text/PDF/e-sign/email, integration/report/cyber-range writes, SSO/MFA, password reset, rate limiting, scheduled NVD/KEV/EPSS sync, malware scanning for evidence, background jobs, Celery worker, CI workflows.

Local login: set `AEGIS_DEV_ADMIN_PASSWORD` in the repo-root `.env` (no default password). From `apps/api`, run `python -m app.db.seed` so `USR-0001` (`amara.okonkwo@aegisbridge.example`) matches that value. Re-run the seed after changing it. Production does not sync this credential. Backend tests write only to `TEST_DATABASE_URL` and leave the development credential unchanged.

## Security reminders

- Do not fabricate evidence, SIEM alerts, or vulnerability scan results.
- Label synthetic / demo data clearly.
- Do not expose lab management ports to the public internet.
- Prefer outbound lab-bridge sync when the lab is connected later.
