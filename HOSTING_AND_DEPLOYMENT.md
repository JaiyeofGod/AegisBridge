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

Local and current application behavior is two Celery Beat schedules, not the three `aegis-sync-*` cron services. Every day at 06:00 UTC the worker refreshes CVEs already tracked by AegisBridge: NVD once per CVE, the CISA KEV catalog once, and FIRST EPSS in batches of at most 100. It does not download the full NVD database. Manual refresh (`POST /api/v1/vulnerabilities/{id}/intelligence/refresh`) remains. The job does not change remediation, asset context, or `action_decision`. Every 6 hours, at minute 15, the same worker ingests recent ThreatFox and URLhaus indicators. That job uses its own Valkey lock and does not change the vulnerability schedule.

ATT&CK Enterprise 20.0 is imported manually from pinned STIX 2.1. A weekly or version-based refresh is future work and is not on the Beat schedule.

Wazuh alert metadata is polled every five minutes on the `integrations` queue (`soc.sync_wazuh_alerts`) when `WAZUH_ENABLED=true`. The task exits without a network call while that flag is false. The indexer URL and basic-auth credentials come from server settings. `WAZUH_VERIFY_TLS` defaults to true, and production ignores a false value. A local worker must listen on `intelligence,integrations`. This poll does not install Wazuh, open port 55000, or require inbound access to the Lenovo lab.

Research datasets are not on the Beat schedule. `python -m app.datasets ingest DS-0006` is a manual command. It uses the same private S3 bucket as evidence (SeaweedFS locally, R2 when hosted). `DATASET_MAX_DOWNLOAD_BYTES` defaults to 512 MiB and `DATASET_TEMP_DIR` may point at a scratch directory outside the repository. Temporary files are removed when the command finishes. Dataset files are not committed.

`python -m app.datasets derive DS-0006 --profile phreshphish-url-baseline-v1` is also manual. `DATASET_DERIVATION_MAX_DOWNLOAD_BYTES` defaults to 256 MiB. The command reads Parquet footers and the `url` and `label` column ranges from the pinned PhreshPhish revision. It does not transfer the HTML column or the 36.6 GB source. Derived objects use the same private bucket.

The `aegis-sync-*` cron names, worker autoscaling, a source-health dashboard, refresh history in the UI, notification rules, user-editable schedules, scheduled MITRE ATT&CK refresh, dataset revision checks, background dataset downloads, and a production managed queue are not implemented. IOC expiry, asset correlation, and automated blocking are also not implemented.

`render.yaml` is a reviewed blueprint, not an applied deployment. The launch sequence is `docs/deployment/FIRST_PRODUCTION_LAUNCH.md`, and `docs/deployment/PRODUCTION_CHECKLIST.md` separates repository work from live-account work. Python 3.14.8, Node 24.22.0, and pnpm 10.18.2 are pinned. Migrations run once per release from the API pre-deploy command. The API, one solo-pool worker on `intelligence,integrations`, and one Beat process are separate.

---

## 4. Object Storage Buckets

```text
aegis-prod-evidence
aegis-stage-evidence
```

Optional later: `aegis-public-reports`

Local: `aegis-dev-evidence` on SeaweedFS S3 (`127.0.0.1:8333`)

The API uses an S3-compatible storage abstraction (`app/storage`). Hosted environments set `OBJECT_STORAGE_PROVIDER=r2` and put the R2 S3 token in `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. Evidence, derived datasets, and experiment artifacts use that private bucket. Downloads stay on authorized API routes. Production startup fails when that configuration is missing or still points at the local SeaweedFS bucket. A later storage outage does not by itself mark the API unready; PostgreSQL is the required readiness check.

---

## 5. Local Development Topology (Approved)

| Component | Runtime |
|---|---|
| PostgreSQL 18 | Docker Compose |
| Redis/Valkey | Docker Compose |
| SeaweedFS (S3 `weed mini`) | Docker Compose |
| FastAPI | Mac host (hot reload); container-ready |
| React (Vite) | Mac host (hot reload); container-ready |
| Celery worker and Beat | Host-run against Compose Valkey. Daily vulnerability intelligence at 06:00 UTC and ThreatFox/URLhaus indicators every 6 hours, both on the solo pool. No API image in Compose |
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

Production requires HTTPS origins, Secure cookies, HSTS `max-age=15552000` without `includeSubDomains` or preload, explicit CORS, and explicit `TRUSTED_HOSTS`. The platform proxy terminates TLS. `FORWARDED_ALLOW_IPS` names that proxy. The application does not redirect internal HTTP to HTTPS. Custom domain remains optional until the first deploy.

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

`aegis-lab-bridge` on Lenovo is future work and is not implemented:

```text
Lenovo cyber range --> Wazuh --> outbound-only Lab Bridge --> AegisBridge
```

Local development may later point `WAZUH_INDEXER_URL` at a LAN indexer. The public deployment must not accept inbound connections from the internet into the lab, and it must not require the lab to accept inbound connections from the cloud. The bridge, when it exists, will push sanitized metadata outbound. The hosted app must keep working when the lab is offline. Direct indexer polling is the first slice and does not replace that future bridge.

The Lenovo procedure is `docs/lab/LENOVO_WAZUH_SETUP.md`. It pins official single-node containers at Wazuh 4.14.9, binds ports to loopback, starts manually, and enrolls one host agent. That stack has not been installed. The Mac connector stays disabled. Lab certificates and passwords stay in `~/aegis-lab/wazuh/` and are not committed.

---

## 10. Deployment Gates

- Production deploy only after required CI checks pass
- Migrations via Alembic as part of release process
- Health: live + ready (DB/queue; not external intel)
- Backups: Postgres + critical evidence inventory; tested recovery procedure in later phases

---

## 11. Cost Control

Start with smallest practical Render/R2 configuration. Prefer local Lenovo compute for the cyber range. Re-check vendor pricing at deploy time. Do not depend on ephemeral free DB for long-term production demo.
