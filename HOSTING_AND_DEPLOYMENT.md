# AegisBridge Hosting and Deployment

**Document version:** 1.0  
**Date:** October 20, 2026  
**Status:** Phase 0 baseline  
**Authority:** `MASTER_REQUIREMENTS.md` Parts V, XIII, XIV

---

## 1. Hosting Decision

**Public application hosting:** Render  
**Object/evidence storage:** Cloudflare R2 (S3-compatible)  
**Local object emulation:** SeaweedFS `weed mini` S3 via Docker Compose (ADR-021)  
 
**CI/CD:** GitHub Actions  
**Cyber range:** Private Lenovo host — never public production

---

## 2. Public Topology

```text
Internet
  v
Render Static Site — React
  | HTTPS
  v
Render Web Service — FastAPI
  |
  +------------------+------------------+
  |                  |                  |
Render Postgres  Render Key Value  Cloudflare R2
  |                  |                  |
  +---------- Render Worker ------------+
                     |
                     +--> NVD / EPSS / KEV / ATT&CK / OSV
                     +--> Lab sync ingestion (push from lab)
```

---

## 3. Render Service Layout

| Service | Role |
|---|---|
| `aegis-web` | Static site (React build) |
| `aegis-api` | FastAPI web service |
| `aegis-worker` | Celery background worker |
| `aegis-postgres` | PostgreSQL 18 |
| `aegis-kv` | Redis-compatible Key Value (Valkey-backed for new instances) |
| `aegis-sync-kev` | Cron |
| `aegis-sync-epss` | Cron |
| `aegis-sync-nvd` | Cron or queued incremental worker |

ATT&CK updates are version-aware/manual — do not silently schedule to `latest`.

Describe deployable resources in `render.yaml` (stub allowed in Phase 1; live deploy Phase 10+).

---

## 4. Object Storage Buckets

```text
aegis-prod-evidence
aegis-stage-evidence
```

Optional later: `aegis-public-reports`

Local: `aegis-dev-evidence` on SeaweedFS S3 (`127.0.0.1:8333`)

The API uses an S3-compatible storage abstraction (`app/storage`). Switching hosted environments to Cloudflare R2 is a configuration change (`S3_ENDPOINT_URL`, credentials, bucket, `OBJECT_STORAGE_PROVIDER`), not a domain rewrite. Evidence objects are private; downloads are authorized API streams. Object-storage outage must not take down read-only platform readiness.

---

## 5. Local Development Topology (Approved)

| Component | Runtime |
|---|---|
| PostgreSQL 18 | Docker Compose |
| Redis/Valkey | Docker Compose |
| SeaweedFS (S3 `weed mini`) | Docker Compose |
| FastAPI | Mac host (hot reload); container-ready |
| React (Vite) | Mac host (hot reload); container-ready |
| Celery worker | Minimal foundation; host or Compose later; no meaningful jobs in Phase 1 |
| Backend tests | Same Compose PostgreSQL container. Development database `aegis`. Test database `aegis_test` via `TEST_DATABASE_URL`. No extra host port |

Local pytest does not use the development database. `python -m app.db.test_db ensure` creates the test database on an existing volume. Init scripts do not re-run after the first data directory is created. Production startup reads `DATABASE_URL` only.

Goals: fast iteration early; Dockerfiles and Compose service definitions prepared for Phase 9 local parity and Phase 10 hosting.

---

## 6. Environments

| Environment | Infra |
|---|---|
| Local | Mac + Compose data plane |
| Test | Local pytest uses `TEST_DATABASE_URL` on the Compose PostgreSQL server. Hosted CI is not configured yet |
| Staging | Separate Render services + R2 staging bucket |
| Production / portfolio demo | Render + R2 prod + Demo Mode rules |
| Cyber range | Lenovo VMs only |

---

## 7. Domain and TLS (future)

```text
app.<domain>
api.<domain>
```

or single-origin with `/api` proxy.

Requirements: HTTPS only, HSTS after stable config, secure cookies, no mixed content, restrictive CORS. Custom domain optional until portfolio demo matures.

---

## 8. Demo Mode

Hosted public app must support Demo Mode:

- Seeded fictional data only
- No personal information or live credentials
- No raw private lab logs
- No destructive actions for anonymous/read-only visitors
- Obvious synthetic-organization label
- Last-lab-sync and data-source labels visible

Private administrator interface remains authenticated.

---

## 9. Lab Connectivity

Do **not** expose Wazuh 55000, dashboards, RDP, SSH, or lab subnets to the public internet.

`aegis-lab-bridge` on Lenovo:

```text
Local Wazuh API --> Lab Bridge --> outbound HTTPS --> Hosted /api/v1/lab-sync
```

Bridge: normalize/sanitize, authenticate/sign requests, retry, record last success, queue when offline if practical. Hosted app must work when lab is offline.

---

## 10. Deployment Gates

- Production deploy only after required CI checks pass
- Migrations via Alembic as part of release process
- Health: live + ready (DB/queue; not external intel)
- Backups: Postgres + critical evidence inventory; tested recovery procedure in later phases

---

## 11. Cost Control

Start with smallest practical Render/R2 configuration. Prefer local Lenovo compute for the cyber range. Re-check vendor pricing at deploy time. Do not depend on ephemeral free DB for long-term production demo.
