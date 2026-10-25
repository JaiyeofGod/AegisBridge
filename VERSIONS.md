# AegisBridge Version Baselines

**Document version:** 1.1  
**Planning baseline date:** October 19–20, 2026  
**Status:** Phase 1 — API bootstrap pins recorded

Patch versions may move after testing. Major architectural changes require an ADR.

---

## 1. Framework and Standards

| Component | Baseline |
|---|---|
| NIST CSF | 2.0 |
| CIS Controls | 8.1 (IG1 initial target) |
| NIST SP 800-53 | Rev. 5 current OSCAL content |
| NIST Incident Response | SP 800-61 Rev. 3 |
| NIST SSDF | SP 800-218 v1.1 |
| MITRE ATT&CK | 20.0 (do not silently follow `latest`) |
| OWASP ASVS | 5.0.0 |
| OWASP Top 10 | 2025 |

---

## 2. Application Runtime

| Component | Baseline | Notes |
|---|---|---|
| React | **19.3.1** | Verified in `apps/web` |
| Vite | **8.3.4** | Verified |
| Node.js | **24.22.0** | LTS via nvm for web builds |
| TypeScript | **5.9.3** | Strict mode |
| TanStack Query | **5.104.5** | |
| React Router | **7.18.4** | |
| Tailwind CSS | **4.3.3** | |
| Vitest | **5.0.5** | |
| Python | **3.14.8** | Verified via uv (ADR-013) |
| PostgreSQL | 18 | Compose image `postgres:18` |
| FastAPI | **0.151.0** | Locked in `apps/api/uv.lock` |
| Pydantic | **2.14.1** | |
| pydantic-settings | **2.16.0** | |
| SQLAlchemy | **2.1.5** | |
| psycopg | **3.3.6** (+ binary) | |
| Alembic | **1.20.0** | Empty baseline `20261020_0001` |
| Uvicorn | **0.54.0** | |
| Redis client | **8.1.0** | Optional readiness probe |
| Celery | Deferred | Worker foundation not in this slice |
| PyArrow | **26.0.0** | Parquet metadata and bounded scans for research datasets |
| NumPy | **2.5.4** | CPU URL n-gram feed-forward baseline. No CUDA dependency |
| Wazuh | **4.14.9** (`wazuh-docker` tag `v4.14.9`) | Specified, not installed. Do not use the repository `main` branch |
| Suricata | 8.0.7 | Lab phases |

---

## 3. Tooling

| Tool | Choice | Verified version | ADR |
|---|---|---|---|
| Frontend package manager | pnpm | **10.18.2** | ADR-014 |
| Python env / lock | uv | **0.13.3** | ADR-015 |
| Python typechecker | Pyright | **1.1.414** | ADR-016 |
| Frontend formatter | Prettier | pending frontend | ADR-017 |
| Python lint/format | Ruff | **0.17.1** | master §110 |
| Frontend lint | ESLint | pending frontend | master §110 |
| pytest | pytest | **9.1.1** | |

---

## 4. Hosting / Lab Pins (later)

| Component | Baseline |
|---|---|
| Render Postgres | 18 |
| Render Key Value | Valkey-backed for new instances |
| Cloudflare R2 | S3-compatible API (hosted) |
| SeaweedFS (local S3) | `chrislusf/seaweedfs:4.48` (`weed mini`) |

---

## 5. Resolved Install Record

Recorded 2026-10-20 after `uv sync` in `apps/api` (lockfile: `apps/api/uv.lock`).

| Package / image | Resolved version | Date | Notes |
|---|---|---|---|
| CPython | 3.14.8 | 2026-10-20 | uv-managed |
| fastapi | 0.151.0 | 2026-10-20 | |
| pydantic | 2.14.1 | 2026-10-20 | |
| pydantic-settings | 2.16.0 | 2026-10-20 | |
| sqlalchemy | 2.1.5 | 2026-10-20 | |
| psycopg | 3.3.6 | 2026-10-20 | + psycopg-binary |
| alembic | 1.20.0 | 2026-10-20 | |
| uvicorn | 0.54.0 | 2026-10-20 | |
| redis | 8.1.0 | 2026-10-20 | |
| pytest | 9.1.1 | 2026-10-20 | |
| httpx | 0.28.1 | 2026-10-20 | |
| ruff | 0.17.1 | 2026-10-20 | |
| pyright | 1.1.414 | 2026-10-20 | |
| uv | 0.13.3 | 2026-10-20 | installer |
| postgres | 18 | Compose | healthy |
| valkey/valkey | 8 | Compose | healthy |
| chrislusf/seaweedfs | 4.48 | Compose | healthy |
