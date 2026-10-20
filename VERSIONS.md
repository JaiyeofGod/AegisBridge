# AegisBridge Version Baselines

**Document version:** 1.0  
**Planning baseline date:** October 19–20, 2026  
**Status:** Phase 0 — planning pins (resolved package patches recorded after Phase 1 install)

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
| React | 19.3 | Exact npm patch at install |
| Vite | 8 | Exact npm patch at install |
| Node.js | 24 LTS | Engines pin in package manifests |
| TypeScript | Compatible with above | Strict mode |
| Python | 3.14.x | Do not move to 3.15 until matrix passes (ADR-013) |
| PostgreSQL | 18 | Avoid PG 19 RC |
| FastAPI / Pydantic / SQLAlchemy | 2.x ecosystem compatible with Py 3.14 | Locked via uv |
| Celery | Compatible with Redis broker | Foundation in Phase 1 |
| Wazuh | 4.14.9 planning baseline | Lab phases |
| Suricata | 8.0.7 | Lab phases |

---

## 3. Tooling

| Tool | Choice | ADR |
|---|---|---|
| Frontend package manager | pnpm | ADR-014 |
| Python env / lock | uv | ADR-015 |
| Python typechecker | Pyright | ADR-016 |
| Frontend formatter | Prettier | ADR-017 |
| Python lint/format | Ruff | (master §110) |
| Frontend lint | ESLint | (master §110) |

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

_Populate during Phase 1 after first successful lockfile generation:_

| Package / image | Resolved version | Date | Notes |
|---|---|---|---|
| _(pending)_ | | | |
