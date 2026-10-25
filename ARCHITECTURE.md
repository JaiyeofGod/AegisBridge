# AegisBridge Architecture

**Document version:** 1.0  
**Date:** October 20, 2026  
**Status:** Phase 0 baseline  
**Authority:** `MASTER_REQUIREMENTS.md` (product/security); this document summarizes architecture for implementation.

---

## 1. Purpose

AegisBridge is a browser-based enterprise cybersecurity / SOC / GRC platform connected to a separate, isolated cyber range. It is not a native desktop app and not a second SIEM.

Two components:

1. **AegisBridge Security Platform** — React UI + FastAPI API + PostgreSQL + workers + object storage  
2. **AegisBridge Cyber Range** — isolated VMs (Wazuh, Windows, Linux, gateway/Suricata, Kali) on the Lenovo lab host

---

## 2. Architecture Planes

| Plane | Responsibility |
|---|---|
| 1 Presentation | React / TypeScript UI |
| 2 Application / Control | FastAPI REST API, authorization, business logic |
| 3 Security Program Data | PostgreSQL structured records |
| 4 Asynchronous Processing | Celery + Redis-compatible queue |
| 5 Integration and Intelligence | NVD, EPSS, KEV, ATT&CK, OSV, lab sync |
| 6 Telemetry and Security Operations | Wazuh / Suricata retain raw events |

The first public deployment is a managed HTTPS frontend, a managed HTTPS API, managed PostgreSQL, a private Redis-compatible broker, and a private R2 bucket. Celery runs as one worker and one Beat scheduler. The Lenovo cyber range is not on that public path. See `docs/deployment/PRODUCTION_CHECKLIST.md`.
| 7 Cyber Range | Isolated lab systems generating authentic telemetry |

---

## 3. Logical Runtime Topology

```text
Browser
  | HTTPS
  v
React / TypeScript Web UI
  | REST/JSON
  v
FastAPI Application API
  |
  +------------------+------------------+
  |                  |                  |
PostgreSQL       Job Queue         Object Storage
                 / Redis             / R2 (prod)
                                     / SeaweedFS S3 (local)
  |
Background Workers / Scheduled Jobs
  |
External Intelligence + Lab Connector (outbound from lab)
```

Tracked CVE intelligence refreshes once a day at 06:00 UTC. Celery Beat enqueues one task, the Celery worker executes it, and Valkey is the broker. The worker reads tracked CVEs, calls NVD once per CVE, downloads the CISA KEV catalog once, and requests FIRST EPSS in batches of at most 100. Results are written to the CVE tables. The run row in `intelligence_sync_runs` is the system record. A Valkey lock with a TTL prevents overlapping runs. The manual refresh endpoint remains for one vulnerability. This job does not change remediation, asset context, or `action_decision`, and it does not produce a combined score.

ThreatFox and URLhaus indicators refresh every 6 hours, at 00:15, 06:15, 12:15, and 18:15 UTC. The task is `intelligence.sync_threat_intelligence_iocs`. It calls only the official abuse.ch endpoints, with the server `ABUSECH_AUTH_KEY` in the `Auth-Key` header. Each run keeps at most 500 indicators per source (`THREAT_INTEL_IOC_LIMIT`, hard cap 1000). ThreatFox asks for 1 day (`THREATFOX_DAYS`, clamped to 1–7). The same indicator from both sources stays as two rows. A failed source keeps its previous rows. Feed text is untrusted. A listed indicator is not a compromise, an ATT&CK mapping, or a block decision, and there is no aggregate IOC score. Historical rows are not deleted. The vulnerability job and its lock are unchanged.

API readiness does not require the worker or Beat. Redis/Valkey stays an optional health check.

MITRE ATT&CK Enterprise is loaded from a pinned STIX 2.1 bundle for release 20.0. Ingestion is a manual command, not a daily Beat job. The catalog stores tactics, techniques, sub-techniques, and tactic membership. Read APIs use `threat_intel.read`. Existing detection and indicator rows keep their string technique ids.

Wazuh remains the SIEM. When `WAZUH_ENABLED` is set, Celery polls the Wazuh indexer every five minutes for a 15-minute lookback and stores selected alert metadata on the existing `alert_references` table. The manager API, raw events, agents, and active response are not part of this path. Credentials stay in server settings. The integration does nothing until that configuration is present. The Lenovo single-node stack is specified in `docs/lab/LENOVO_WAZUH_SETUP.md` and is not deployed. A future Lenovo lab bridge is outbound-only; the hosted API does not open a path into the lab.

Research datasets are versioned artifacts, not live feeds. The first approved source is the public Hugging Face dataset `phreshphish/phreshphish` (`DS-0006`). A manual command resolves that catalog id, pins the source commit, checks the declared size, and refuses the download when it exceeds `DATASET_MAX_DOWNLOAD_BYTES` (default 512 MiB). A download that fits the cap is hashed, validated as Parquet, profiled with a row cap, and stored through the private object-storage interface. PostgreSQL keeps the revision, SHA-256, and profile. It does not keep raw rows. Ingestion has no Beat schedule. Callers cannot supply a download URL.

The full PhreshPhish artifact is about 36.6 GB, so it is not stored. `python -m app.datasets derive DS-0006 --profile phreshphish-url-baseline-v1` builds a separate derived version from the pinned revision `eca603e0ecd4f698f8d4d226c088659e72681239`. It reads only the `url` and `label` column chunks, samples 1,000 training rows from the official train split and 200 test rows (100 benign and 100 phish) from the official test split, and stores `train.parquet`, `test.parquet`, and a manifest. The derivation transfer cap is `DATASET_DERIVATION_MAX_DOWNLOAD_BYTES` (default 256 MiB). The catalog row stays `not_downloaded` because the full source was not ingested.

`python -m app.research run --profile phreshphish-url-ffn-v1` trains one small CPU network on that ready derived version. The profile pins dataset `DS-0006`, derivation profile `phreshphish-url-baseline-v1`, fingerprint `de5b492458c1173d4f267ec8c8ea301d224ba4dd4fd03a41859c66d8819a75f2`, character 4-grams, a 5,000-feature cap, seed 42, and the training settings. The vocabulary is fit on the training URLs only. Index 0 is a real feature column, and the final character window is kept. The network is input → 32 ReLU units → one sigmoid output, trained with Adam and binary cross-entropy for 10 epochs. The stored test split is scored once at threshold 0.5. Model bytes, the vocabulary, and the experiment manifest stay in private object storage. PostgreSQL stores the configuration, metrics, confusion counts, and SHA-256 values. There is no training HTTP route and no Beat job. This is a URL-only baseline with deterministic configuration and pinned inputs. It is not a reproduction of the PhreshPhish paper, it does not use HTML or a language model, and it does not request the URLs. The earlier adapted 79% run stays a separate historical result.

---

## 4. Critical Separations

| Store | Holds | Does not hold |
|---|---|---|
| PostgreSQL | Assets, risks, controls, evidence metadata, vulns, detections, incidents, audit, integration snapshots, selected Wazuh alert metadata | Massive raw SIEM telemetry |
| Wazuh | Raw security events / telemetry authority | AegisBridge business workflows |
| Cloudflare R2 (hosted) / SeaweedFS S3 (local) | Evidence files, reports, screenshots, ingested research-dataset artifacts | Primary relational state, dataset credentials |
| Local disk / lab | Temporary dataset downloads, PCAPs, VM disks | Permanent dataset copies, public demo content |

---

## 5. Technology Stack

| Layer | Choice |
|---|---|
| Frontend | React 19.3, TypeScript, Vite 8, React Router, TanStack Query/Table, Tailwind, shadcn/ui, Recharts, Zod |
| Backend | Python 3.14.x, FastAPI, Pydantic 2, SQLAlchemy 2, Alembic, HTTPX, Celery, psycopg, PyArrow, NumPy |
| Database | PostgreSQL 18 |
| Queue/cache | Redis-compatible (Render Key Value / Valkey hosted; Compose locally) |
| Object storage | R2 hosted; SeaweedFS `weed mini` S3 locally (ADR-021) |
| Hosting | Render (static web, API, worker, cron, Postgres, KV) |
| CI/CD | GitHub Actions |
| Frontend PM | pnpm |
| Python tooling | uv |
| Types / format | Pyright (Python), Prettier (frontend), Ruff (Python lint/format), ESLint |

Major changes require an ADR.

---

## 6. API Shape

Versioned REST under `/api/v1/…` (auth, users, assets, risks, frameworks, controls, evidence, vulnerabilities, intelligence, detections, attack, alerts, investigations, incidents, datasets, reports, integrations, metrics, lab-sync, audit, health).

OpenAPI is generated by FastAPI.

Health (Phase 1):

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready` — PostgreSQL required; Redis/Valkey and object storage optional. Worker and Beat are not readiness checks.

---

## 7. Frontend Architecture

- Monorepo app: `apps/web`
- Design authority: approved Figma file + `DESIGN_HANDOFF.md`
- Dark theme primary; Manrope + Inter; graphite / deep navy / cyan
- Shared shell, tokens, and primitives; module screens phased
- Initial fidelity targets after bootstrap: **Sign-in** (`/signin`) and **Overview** (`/overview`)
- Route hiding is convenience only; authorization is server-side
- Metrics must declare scope, source, period, and unknown/stale handling; no invented composite security score
- Fixtures must be labeled simulated / demo

---

## 8. AuthN / AuthZ (summary)

- Phase 2+: local accounts, Argon2id, HTTP-only secure cookies / server sessions, CSRF, rate limits, audit
- Later: TOTP MFA, optional OIDC/OAuth
- Figma SSO / Explore demo are UX concepts — no production auth bypass
- RBAC permissions evaluated on the API

Details: `SECURITY_REQUIREMENTS.md`, ADR set.

---

## 9. Integration Principles

Every external client: timeouts, retries with jitter, rate-limit handling, schema validation, provenance timestamps, health status, idempotent upserts. External outages must not take down the core app.

Lab connectivity is **outbound-only** via Aegis Lab Bridge (ADR-012). Never expose Wazuh 55000, dashboards, RDP, or SSH publicly.

---

## 10. Environments

| Environment | Role |
|---|---|
| Local development | Mac + Compose infra; host-run API/web early |
| Automated test | Ephemeral CI services |
| Staging | Separate Render + R2 staging |
| Production / portfolio demo | Render + sanitized synthetic data + Demo Mode |
| Cyber range | Private Lenovo VMs — not public production |

---

## 11. Development Topology

```text
Mac + Cursor  -->  GitHub  -->  Lenovo lab (pull) for heavy VMs
```

Early local: Compose for Postgres / Redis / SeaweedFS; FastAPI and React on the Mac host for hot reload; Dockerfiles kept for later parity.

---

## 12. Related Documents

- `DATA_ARCHITECTURE.md`
- `SECURITY_REQUIREMENTS.md`
- `THREAT_MODEL.md`
- `HOSTING_AND_DEPLOYMENT.md`
- `PHASE_1_IMPLEMENTATION_PLAN.md`
- `docs/decisions/`
