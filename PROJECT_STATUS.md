# AegisBridge Project Status

**Last updated:** October 22, 2026  
**Current phase:** Phase 2 — auth + domain GET RBAC + CSRF-protected writes, including evidence objects and policy lifecycle/versioning/acknowledgement  
**Next:** Remaining mutations (integrations, reports, incident tasks). MFA, SSO, password reset, rate limiting, and Cyber Range control remain out of scope.

---

## 1. Snapshot

| Item | Status |
|---|---|
| Master requirements | Present (`MASTER_REQUIREMENTS.md` v2.0) |
| Design handoff | Present (`DESIGN_HANDOFF.md` v1.0) |
| Phase 1 plan | Present (`PHASE_1_IMPLEMENTATION_PLAN.md` v1.1) — corrected routes/tooling |
| Minimal Phase 0 docs | Complete |
| Application code | API domain schema + web UI on local mocks |
| Domain schema | Through `20261020_0011` (policy↔control mappings) |
| Read API | `/api/v1` through reports, datasets, experiments, cyber-range, governance (controls catalog: page/`q`/framework/implementation_status/sort), policies (catalog: page/`q`/status/sort + mapped controls), evidence detail + private object download |
| Authentication | Sessions + CSRF synchronizer tokens; domain GET RBAC enforced |
| Write API | Preferences, risk, incident, vulnerability, administration, governance, evidence objects, policy lifecycle, and policy↔control link/unlink; integration/report/cyber-range writes deferred |
| Frontend API connection | Reads + CSRF client + preferences, risk, incident, vulnerability, administration, governance/evidence objects + Policy Management UI (lifecycle + policy↔control mapping + server-side control/policy catalog search/pagination; Add Control selector no longer assumes first 50); integration/report/cyber-range writes still disabled |
| Object storage | S3-compatible abstraction; SeaweedFS locally; Cloudflare R2 for hosted; optional health check |
| Package installs | API via uv; web via pnpm (`apps/web`) |
| Cyber range | Not started |
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
- Celery: minimal foundation, no meaningful jobs yet
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
