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

`GET /api/v1/vulnerabilities/{id}` includes stored `intelligence` provenance for NVD, CISA KEV, and FIRST EPSS. The list response does not. The vulnerability detail page shows those source timestamps and KEV catalog fields after a normal load, including a browser reload. The CISA due date stays separate from the remediation due date. There is no source-health score. A user with `vulnerability.manage` can refresh one CVE. That refresh does not change remediation or `action_decision`. A vulnerability without a CVE stays valid and is not sent to those sources. A daily 06:00 UTC Celery job refreshes every tracked CVE the same way: NVD per CVE, the CISA KEV catalog once, and FIRST EPSS in batches of 100. Valkey is the broker. The job does not change remediation or `action_decision`. There is no combined score and no scheduler UI.

MITRE ATT&CK Enterprise release 20.0 loads from a pinned STIX 2.1 bundle into tactics, techniques, and sub-techniques. `GET /api/v1/attack/tactics` and `GET /api/v1/attack/techniques` require `threat_intel.read`. The Threat Intelligence page adds a MITRE ATT&CK tab for sessions with that permission. Search, tactic filter, and pagination stay on the server. Revoked and deprecated objects are kept and omitted from the default lists. Existing detection technique strings are unchanged. There is no Navigator export, coverage heatmap, or generated detection.

ThreatFox and URLhaus recent indicators are ingested every 6 hours into the existing indicator table. The default cap is 500 records per source per run. The same value from both sources stays as two rows. Feed text is untrusted, and a listed value is not a compromise or a block. Set `ABUSECH_AUTH_KEY` for the official Auth-Key header. The daily 06:00 UTC vulnerability sync is unchanged. There is no IOC score and no automatic expiry.

Wazuh remains the SIEM. Optional indexer polling stores selected alert metadata on the existing alert table. It is off until `WAZUH_ENABLED=true` and the indexer URL, username, and password are set on the server. The Lenovo install steps are in `docs/lab/LENOVO_WAZUH_SETUP.md`. That stack is not running, and the Mac `.env` stays disconnected. The poll looks back 15 minutes, keeps at most 500 alerts per run, and deduplicates by Wazuh alert id. Rule level is source metadata, not a risk score. New rows enter status `new` and do not open incidents. ATT&CK ids are taken from the alert, not invented from the description. Raw events are not copied. TLS verification stays on unless a non-production deployment explicitly opts out. A future lab path is Lenovo to Wazuh to an outbound-only bridge; this slice does not build that bridge.

Research dataset ingestion is a manual command, not a feed. From `apps/api`, `python -m app.datasets ingest DS-0006` resolves the approved PhreshPhish source `phreshphish/phreshphish`, pins the Hugging Face commit, and refuses a download larger than `DATASET_MAX_DOWNLOAD_BYTES` (default 512 MiB). A fitting artifact is validated as Parquet, hashed, profiled, and stored in private object storage. Dataset detail can show the revision, SHA-256, size, and label counts. The list stays lightweight. This command does not train a model. An earlier adapted CPU baseline on 1,000 training rows and 200 test rows is not an output of this pipeline.

`python -m app.datasets derive DS-0006 --profile phreshphish-url-baseline-v1` builds a small derived artifact from pinned revision `eca603e0ecd4f698f8d4d226c088659e72681239`. It keeps `url` and `label` only: 1,000 training rows from the official train split, preserving that split's label mix, and 200 test rows with 100 benign and 100 phish. The same URL cannot appear in both derived files. The transfer cap is 256 MiB. The full 36.6 GB source, including HTML, stays remote. Dataset detail can show the derivation profile, fingerprint, split counts, and label counts.

`python -m app.research run --profile phreshphish-url-ffn-v1` trains a small CPU feed-forward network on that ready derived version. URLs stay stored strings: no DNS lookup and no HTTP fetch. Character 4-grams are counted on the training rows only, capped at 5,000 features, and written as binary columns. The same vocabulary scores the stored test rows once at threshold 0.5. The completed run `RSCH-0005` measured accuracy 0.825, phishing caught 75/100, and benign false positives 10/100. Experiment detail shows the profile, fingerprint, feature settings, model settings, metrics, confusion counts, and artifact SHA-256 values. Object keys stay private. This is a URL-only baseline with deterministic configuration and pinned inputs. It does not reproduce the PhreshPhish paper, use HTML, or call a language model. The earlier adapted 79% result (64 phishing caught, 6 benign false positives) remains a separate historical run because the sampled rows and the feature indexing differ.

The Reports page Research tab lists stored experiments and opens one detail record. For `RSCH-0005` it shows dataset provenance, the derived profile and fingerprint, the corrected character 4-gram pipeline, the NumPy CPU model settings, the measured metrics, the confusion matrix, and the three artifact SHA-256 integrity hashes. A small table places those measurements next to the historical adapted run and states that the sampled rows differ and the feature pipeline was corrected. The page does not start training, edit hyperparameters, download the model or the dataset, or show raw URLs. Older experiments without those fields stay readable and do not invent metrics.

The Threat Intelligence indicator list shows those stored rows with server-side pagination (25 per page). A selected row shows where it came from, its type and subtype, the source's threat or malware text, tags, source status, source confidence when the feed supplied an integer, and when AegisBridge fetched it. External feed rows and simulated rows are labeled separately. A URL indicator is plain text and is not a link. A source reference, when the API returns an http(s) URL, is a separate link. Numeric source confidence is not the AegisBridge high/medium/low label. Nothing in this screen blocks an indicator or claims an asset was compromised.

**Not yet created:** Policy rich-text/PDF/e-sign/email, integration/report/cyber-range writes, SSO/MFA, password reset, rate limiting, malware scanning for evidence, scheduler UI, source-health dashboard, IOC expiry and asset correlation, notification rules, worker autoscaling, scheduled ATT&CK refresh, dataset revision checks, additional experiment seeds, confidence intervals, hyperparameter comparison, cross-dataset evaluation, feature ablation, TF-IDF comparison, a logistic-regression baseline, a model registry, a downloadable experiment report, scheduled experiment jobs, model promotion, a real-time phishing scoring API, VirusTotal, MISP/TAXII, ATT&CK Navigator, Sigma import, CI workflows, Wazuh agent or Suricata deployment, and the outbound Lenovo lab bridge.

Local login: set `AEGIS_DEV_ADMIN_PASSWORD` in the repo-root `.env` (no default password). From `apps/api`, run `python -m app.db.seed` so `USR-0001` (`amara.okonkwo@aegisbridge.example`) matches that value. Re-run the seed after changing it. Production does not sync this credential. Backend tests write only to `TEST_DATABASE_URL` and leave the development credential unchanged.

## Security reminders

- Do not fabricate evidence, SIEM alerts, or vulnerability scan results.
- Label synthetic / demo data clearly.
- Do not expose lab management ports to the public internet.
- Prefer outbound lab-bridge sync when the lab is connected later.
