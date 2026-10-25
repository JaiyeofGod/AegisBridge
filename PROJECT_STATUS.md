# AegisBridge Project Status

**Last updated:** October 24, 2026  
**Current phase:** Phase 2 — auth + domain GET RBAC + CSRF-protected writes, including evidence objects and policy lifecycle/versioning/acknowledgement  
**Next:** Remaining mutations (integrations, reports). MFA, SSO, password reset, rate limiting, and Cyber Range control remain out of scope.

---

## 1. Snapshot

| Item | Status |
|---|---|
| Master requirements | Present (`MASTER_REQUIREMENTS.md` v2.0) |
| Design handoff | Present (`DESIGN_HANDOFF.md` v1.0) |
| Phase 1 plan | Present (`PHASE_1_IMPLEMENTATION_PLAN.md` v1.1) — corrected routes/tooling |
| Minimal Phase 0 docs | Complete |
| Application code | API domain schema + web UI on local mocks |
| Domain schema | Through `20261024_0019` (research-dataset provenance on `dataset_versions`) |
| Read API | `/api/v1` through reports, datasets, experiments, cyber-range, governance (controls catalog: page/`q`/framework/implementation_status/sort; control detail includes mapped risks), policies (catalog: page/`q`/status/sort + mapped controls), risks (detail includes mapped controls), incidents (detail task summaries + `/incidents/{id}/tasks`), operational directory (`GET /directory/users`, `directory.read`, active same-organization users only), evidence detail + private object download, vulnerability detail `intelligence` provenance (NVD timestamps, KEV catalog metadata, selected EPSS fetch time; list payload unchanged) |
| Authentication | Sessions + CSRF synchronizer tokens; domain GET RBAC enforced |
| Write API | Preferences, risk treatment, risk↔control link/unlink, incident update, incident response tasks (`TASK-NNNN`; completion does not close the incident), vulnerability remediation, vulnerability intelligence refresh (`POST /vulnerabilities/{id}/intelligence/refresh`; external CVSS/EPSS/KEV only; does not change remediation or `action_decision`), administration, governance, evidence objects, policy lifecycle, and policy↔control link/unlink; integration/report/cyber-range writes deferred |
| Local admin credential | `AEGIS_DEV_ADMIN_PASSWORD` is the only development password source. Seed rewrites the `USR-0001` Argon2id hash in local/dev; production skips it. Pytest does not touch that row |
| Backend tests | Dedicated PostgreSQL database via `TEST_DATABASE_URL` (default `aegis_test`). Alembic `upgrade head` once per session. Same database as `DATABASE_URL` is refused. The previous Administrator hash snapshot/restore workaround is removed |
| Frontend API connection | Reads + CSRF client + preferences, risk treatment, risk↔control mapping UI (paginated control selector; relationship-only, no score/effectiveness changes), incident update, incident response tasks (`TASK-NNNN` on the incident Tasks section; completion does not close the incident; cancellation preserves history; no delete; assignee picker uses `GET /directory/users` when `incident.manage` and `directory.read` are both present), vulnerability (detail shows NVD, CISA KEV, and FIRST EPSS separately, including persisted provenance and KEV catalog metadata from `intelligence`; CISA due date stays separate from remediation due date; `vulnerability.manage` can refresh one CVE and does not change remediation or `action_decision`), administration, governance/evidence objects + Policy Management UI (lifecycle + policy↔control mapping + server-side control/policy catalog search/pagination); Threat Intelligence indicators show source, data origin (external feed or simulated), and selected-row provenance for ThreatFox and URLhaus. Malicious URL values stay plain text. Source confidence stays separate from the AegisBridge confidence label. The list is server-paged at 25 rows. There is no blocking and no compromise inference. The MITRE ATT&CK tab (`threat_intel.read`) browses the pinned Enterprise 20.0 catalog with server-side search, tactic filter, and pagination; integration/report/cyber-range writes still disabled |
| Object storage | S3-compatible abstraction; SeaweedFS locally; Cloudflare R2 for hosted; optional health check |
| Package installs | API via uv; web via pnpm (`apps/web`) |
| Cyber range | Not deployed. Lenovo runbook is `docs/lab/LENOVO_WAZUH_SETUP.md` (official single-node Wazuh 4.14.9, loopback only, one host agent). The Mac session cannot reach the Lenovo, so nothing was installed |
| Background sync | Celery worker and Beat on the host. Valkey is the broker. Daily 06:00 UTC refresh of tracked CVEs: NVD per CVE, CISA KEV once, FIRST EPSS in batches of 100. ThreatFox and URLhaus recent indicators run at 00:15, 06:15, 12:15, and 18:15 UTC, at most 500 records per source. Wazuh indexer alerts poll every 5 minutes on the `integrations` queue when `WAZUH_ENABLED=true`, with a 15-minute lookback and a 500-row cap. Disabled Wazuh polling makes no indexer call. Run status is stored in PostgreSQL. Manual vulnerability refresh remains. Remediation and `action_decision` are unchanged. ATT&CK Enterprise 20.0 is a manual STIX import, not a Beat job |
| ATT&CK catalog | Pinned Enterprise STIX 2.1 release 20.0. Tactics, techniques, and sub-techniques. Read APIs under `/api/v1/attack` use `threat_intel.read`. The Threat Intelligence page shows that catalog when the session has `threat_intel.read`. Detection string ids stay on `attack_techniques` |
| Research datasets | Manual ingest for approved catalog ids. PhreshPhish (`DS-0006`, `phreshphish/phreshphish`) is the first source. The full artifact is about 36.6 GB and is refused by the 512 MiB cap, so no full copy is stored. Profile `phreshphish-url-baseline-v1` derives a private `url`/`label` sample (1,000 train, 200 balanced test) from pinned revision `eca603e0ecd4f698f8d4d226c088659e72681239` when the column transfer stays within 256 MiB. The catalog status stays `not_downloaded`. There is no training job and no dataset Beat schedule |
| Hosting | Not started |

---

## 2. Phase 0 Minimal Gate Checklist

| Artifact | Status |
|---|---|
| `ARCHITECTURE.md` | Created |
| `DATA_ARCHITECTURE.md` | Created |
| `SECURITY_REQUIREMENTS.md` | Created |
| `THREAT_MODEL.md` | Created |
| `HOSTING_AND_DEPLOYMENT.md` | Created |
| `ROADMAP.md` | Created |
| `PROJECT_STATUS.md` | Created |
| `VERSIONS.md` | Created |
| `docs/decisions/` initial ADRs | Created |
| Project risk register | Created (`PROJECT_RISK_REGISTER.md`) |
| `PHASE_1_IMPLEMENTATION_PLAN.md` corrections | Applied |

### Deferred beyond minimal gate (optional follow-ups)

| Artifact | Notes |
|---|---|
| `FRAMEWORK_STRATEGY.md` | Can expand from master Parts II before Phase 5 |
| `LAB_ARCHITECTURE.md` | Before Phase 11 |
| `DATASET_CATALOG.md` | Before Phase 8 |
| `API_INTEGRATION_MATRIX.md` | Before Phase 7 (Appendix A exists in master) |
| `CONTRIBUTING.md` / `SECURITY.md` / `CHANGELOG.md` | With Phase 1 bootstrap |

---

## 3. Approved Decisions (Phase 0)

- Complete Phase 0 before Phase 1 (**Option A**)
- Tooling: **pnpm**, **uv**, **Pyright**, **Prettier**
- Early dev: Compose for Postgres/Redis/Valkey/SeaweedFS; **host-run** React + FastAPI
- Celery: Phase 0 started from a minimal foundation. Current code schedules the daily vulnerability-intelligence job and a 6-hour ThreatFox/URLhaus IOC job. UI schedules, autoscaling, and a production managed queue remain future work
- Routes: `/signin`, `/account/workspace`
- Post-bootstrap UI: real Figma Sign-in + Overview
- Figma access available

---

## 4. Blockers for Phase 1

**Minimal Phase 0 gate:** complete. Phase 1 may start after explicit approval.

Still verify at Phase 1 start:

- Docker available on Mac
- Node 24 LTS and Python 3.14.x installable
- Package version availability for React 19.3 / Vite 8 on Apple Silicon

---

## 5. What Not To Do Until Phase 1 Is Approved

- Do not scaffold React or FastAPI until Phase 1 authorization
- Do not install application packages during Phase 0
- Do not download datasets, install Wazuh, or fabricate evidence
