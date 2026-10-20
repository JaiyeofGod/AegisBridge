# Phase 1 Implementation Plan — Repository Bootstrap

**Document version:** 1.2  
**Planning date:** October 20, 2026  
**Sources:** `MASTER_REQUIREMENTS.md` (v2.0), `DESIGN_HANDOFF.md` (v1.0)  
**Status:** Approved direction — execute only after Phase 0 gate completes  
**Phase 1 exit gate:** All local services start cleanly on the Mac.

> This plan describes what Phase 1 should create. It does not install packages or scaffold applications by itself. Phase 0 gate work is tracked separately.

---

## 1. Phase Objective

Bootstrap a portable monorepo with:

- React + TypeScript frontend skeleton (container-ready)
- FastAPI backend skeleton (container-ready)
- Local Docker Compose services (PostgreSQL, Redis/Valkey, SeaweedFS S3)
- Minimal Celery worker foundation (no meaningful jobs yet)
- Alembic migration foundation
- Minimal health-check API
- Test and CI skeletons
- Design-token / tooling foundations aligned with the approved visual direction

**Development approach (approved)**

| Layer | How it runs in early development |
|---|---|
| PostgreSQL, Redis/Valkey, SeaweedFS | Docker Compose |
| React frontend | Mac host (Vite hot reload) |
| FastAPI backend | Mac host (uvicorn reload) |
| Celery worker | Minimal foundation; host or Compose later; no real jobs yet |

Keep API and web container-ready for later full Docker / Render deployment.

**Explicitly out of scope for Phase 1 bootstrap exit gate**

| Deferred to | Work |
|---|---|
| Phase 0 (prerequisite) | Architecture docs, ADRs, threat model, risk register, `VERSIONS.md`, etc. |
| Phase 2 | Login/logout, sessions, users, roles, permissions, audit log (backend) |
| Phase 3+ | Domain modules, seed GRC data, intelligence sync |
| Phase 9–10 | Production-like compose parity, Render hosting |
| Phase 11+ | Cyber range / Wazuh / lab bridge |

**Post-bootstrap frontend implementation (approved, after Phase 1 exit gate)**

Once bootstrap succeeds and a frontend implementation sprint is authorized, implement the **actual** Sign-in and Overview screens from the approved Figma file — not permanent placeholders:

- Figma file: https://www.figma.com/design/iDkPVAlMAdCokcvecFF8vC/AegisBridge-%E2%80%94-Product-Design
- Sign-in: `/signin` (node `25:574`)
- Overview: `/overview` (node `2:63`)

Other module screens may remain stubs until their phases. Spline 3D may follow static artwork per `DESIGN_HANDOFF.md`. Do not create a production authentication bypass for demo exploration.

---

## 2. Prerequisites

### 2.1 Phase 0 gate

Complete the minimal Phase 0 documents and ADRs before Phase 1 scaffolding. See `PROJECT_STATUS.md`.

### 2.2 Workstation prerequisites (install during Phase 1, not Phase 0)

| Tool | Purpose |
|---|---|
| Git | Source control |
| Cursor IDE | Primary development |
| Docker Desktop (or equivalent) + Docker Compose | Local postgres / kv / SeaweedFS |
| Node.js 24 LTS | Frontend toolchain |
| Python 3.14.x | Backend baseline |
| **pnpm** | Frontend package manager (ADR-014) |
| **uv** | Python environment and lockfiles (ADR-015) |

Figma access is available (confirmed).

---

## 3. Required Development Tools

| Area | Tool | Phase 1 use |
|---|---|---|
| IDE | Cursor | Primary |
| VCS | Git + GitHub | Repo + CI |
| Containers | Docker + Compose | Postgres, Redis/Valkey, SeaweedFS |
| Frontend runtime | Node.js 24 LTS | Vite/React on host |
| Frontend PM | **pnpm** | Apps/web |
| Backend runtime | Python 3.14.x | FastAPI on host |
| Backend lock | **uv** | Apps/api + worker |
| Types (Python) | **Pyright** | Typecheck |
| Format (frontend) | **Prettier** | Format |
| DB migrations | Alembic | Schema bootstrap |
| Object storage local | SeaweedFS 4.48 (`weed mini`) | S3-compatible stub; prod remains R2 |
| Queue/cache local | Redis-compatible (Valkey OK) | Celery readiness |

Security scanners in CI skeleton (may run as non-blocking initially): Gitleaks, Semgrep, Trivy, CycloneDX SBOM generation.

---

## 4. Runtime Versions (Pinned Baselines)

From `MASTER_REQUIREMENTS.md` §19 and §154; see also `VERSIONS.md`.

| Component | Baseline | Phase 1 note |
|---|---|---|
| React | 19.3 | Skeleton; then Sign-in + Overview fidelity sprint |
| Vite | 8 | Scaffold |
| TypeScript | latest compatible with React 19.3 / Vite 8 | Strict mode |
| Node.js | 24 LTS | Engines field in root/package |
| Python | 3.14.x | Do not jump to 3.15 until matrix passes |
| PostgreSQL | 18 | Compose service; avoid PG 19 RC |
| FastAPI / Pydantic 2 / SQLAlchemy 2 | Current compatible with Py 3.14 | Pin via uv lock |
| Celery | Compatible Redis client | Minimal worker foundation |
| Wazuh / Suricata | N/A | Not Phase 1 |

Record exact resolved patch versions in `VERSIONS.md` once installs are authorized.

**Compatibility risk:** Python 3.14.x and React 19.3 / Vite 8 are aggressive baselines. Phase 1 must verify package availability on Apple Silicon before locking.

---

## 5. Proposed Monorepo Structure

Workspace root: `AegisBridge` (see ADR-018). Align with `MASTER_REQUIREMENTS.md` §116.

```text
AegisBridge/
|-- README.md
|-- MASTER_REQUIREMENTS.md
|-- DESIGN_HANDOFF.md
|-- PHASE_1_IMPLEMENTATION_PLAN.md
|-- VERSIONS.md
|-- .gitignore
|-- .env.example
|-- compose.yaml
|-- render.yaml                    # stub only in Phase 1 (no deploy)
|-- package.json                   # pnpm workspace root
|-- pnpm-workspace.yaml
|-- pnpm-lock.yaml
|
|-- apps/
|   |-- web/                       # React + Vite + TS (host-run in early dev)
|   |-- api/                       # FastAPI (host-run in early dev)
|   `-- worker/                    # Celery foundation (minimal)
|
|-- migrations/                    # Alembic at repo root (ADR-019)
|-- infra/
|   |-- docker/
|   |-- seaweedfs/   # optional notes only; service defined in compose.yaml
|   `-- scripts/
|
|-- docs/
|   |-- decisions/
|   `-- architecture/
|
|-- .cursor/rules/
|-- .github/workflows/
|
|-- frameworks/ … grc/ … detections/ … lab/ … datasets/ …
`   (empty README placeholders only; no downloads)
```

---

## 6. Frontend Dependencies (Phase 1 skeleton + foundation)

Install only what the skeleton and design foundation need.

### 6.1 Core

| Dependency | Role |
|---|---|
| `react`, `react-dom` | UI |
| `typescript` | Types |
| `vite` | Bundler |
| `react-router` | Routing |
| `tailwindcss` | Styling |
| `zod` | Selected validation |
| `@tanstack/react-query` | API client foundation |

### 6.2 Design-system related

| Dependency | Role |
|---|---|
| `shadcn/ui` pattern (Radix + local components) | Reusable primitives |
| Manrope + Inter fonts | Match approved Figma / handoff |
| CSS variables / Tailwind theme tokens | Graphite, deep navy, cyan accents |

### 6.3 For Sign-in + Overview fidelity sprint (after bootstrap)

| Dependency | Role |
|---|---|
| `@tanstack/react-table` | If Overview tables require it |
| `recharts` | Overview charts if present in Figma |
| Spline runtime | Optional after static Sign-in artwork works |

### 6.4 Frontend quality tooling

| Tool | Role |
|---|---|
| ESLint | Lint |
| TypeScript `strict` | Typecheck |
| Vitest + Testing Library | Unit/component tests |
| **Prettier** | Format (ADR-017) |

---

## 7. Backend Dependencies (Phase 1 skeleton)

### 7.1 Core

| Dependency | Role |
|---|---|
| `fastapi` | HTTP API |
| `uvicorn` | Local/dev serve on host |
| `pydantic` 2 + `pydantic-settings` | Settings / schemas |
| `sqlalchemy` 2 | ORM |
| `alembic` | Migrations |
| `psycopg` | PostgreSQL driver |
| `httpx` | Future outbound clients |
| `celery` | Worker foundation |
| Redis-compatible client | Broker/backend |
| S3-compatible SDK (e.g. `boto3`) | Storage abstraction stub |
| `argon2-cffi` | Declare for Phase 2 |

### 7.2 Backend quality tooling

| Tool | Role |
|---|---|
| `pytest` | Unit/API tests |
| `Ruff` | Lint + format |
| **Pyright** | Type check (ADR-016) |

---

## 8. Docker Compose Services

| Service | Image baseline | Ports (local) | Purpose |
|---|---|---|---|
| `postgres` | `postgres:18` | `5432` | App database |
| `redis` / `valkey` | Redis-compatible | `6379` | Queue/cache |
| `seaweedfs` | `chrislusf/seaweedfs:4.48` | `8333` | S3-compatible `weed mini`; creates `S3_BUCKET` |

API, web, and worker remain **host-run** in early development; Dockerfiles exist for later full containerization. Optional Compose service definitions may be added but are not required for the Phase 1 exit gate.

**Minimum exit-gate services:** `postgres`, redis/valkey, `seaweedfs`, plus host-run API health success.

---

## 9. Environment Variables

Committed: `.env.example` only. Never commit `.env`.

### 9.1 Application / API

| Variable | Example / notes |
|---|---|
| `APP_ENV` | `local` \| `test` \| `staging` \| `production` |
| `APP_NAME` | `aegisbridge` |
| `API_HOST` / `API_PORT` | `0.0.0.0` / `8000` |
| `LOG_LEVEL` | `INFO` |
| `CORS_ORIGINS` | `http://localhost:5173` |
| `SESSION_SECRET` | Placeholder for Phase 2 |
| `DATABASE_URL` | `postgresql+psycopg://aegis:aegis@localhost:5432/aegis` |
| `REDIS_URL` | `redis://localhost:6379/0` |
| `CELERY_BROKER_URL` | Redis URL |
| `CELERY_RESULT_BACKEND` | Redis URL |

### 9.2 Object storage

| Variable | Notes |
|---|---|
| `S3_ENDPOINT_URL` | `http://localhost:8333` locally |
| `AWS_ACCESS_KEY_ID` | Local SeaweedFS S3 key |
| `AWS_SECRET_ACCESS_KEY` | Local SeaweedFS S3 secret |
| `S3_BUCKET` | `aegis-dev-evidence` |
| `S3_REGION` | placeholder |

### 9.3 Frontend

| Variable | Notes |
|---|---|
| `VITE_API_BASE_URL` | `http://localhost:8000` |

---

## 10. Testing Tools and Phase 1 Test Scope

| Layer | Tool | Phase 1 tests |
|---|---|---|
| Backend unit/API | pytest | Health live/ready; settings; DB smoke |
| Frontend unit | Vitest + Testing Library | Shell / health smoke; expand for Sign-in/Overview sprint |
| E2E | Playwright | Skeleton optional; expand for Sign-in → Overview later |

---

## 11. Linting and Formatting

| Stack | Lint | Format | Types |
|---|---|---|---|
| Backend | Ruff | Ruff format | **Pyright** |
| Frontend | ESLint | **Prettier** | `tsc --noEmit` |
| Secrets | Gitleaks | — | — |

---

## 12. CI/CD Requirements (Skeleton)

```text
lint/format
 → backend unit tests
 → frontend unit tests
 → type checks
 → secret scan (Gitleaks)
 → SAST (Semgrep) — may be warn-only initially
 → dependency / container scan (Trivy) — may be warn-only initially
 → build artifacts
 → SBOM (CycloneDX)
 → optional E2E
```

No Render auto-deploy in Phase 1.

---

## 13. Design-System Implementation Approach

Authority: approved Figma file; `DESIGN_HANDOFF.md`; `MASTER_REQUIREMENTS.md` for security/behavior.

**Figma:** https://www.figma.com/design/iDkPVAlMAdCokcvecFF8vC/AegisBridge-%E2%80%94-Product-Design

### During Phase 1 bootstrap

1. Extract color, spacing, radius, and typography into CSS variables + Tailwind theme.
2. Primary theme: dark (graphite / deep navy / restrained cyan).
3. Typography: Manrope headings; Inter body/data.
4. Initialize shadcn/ui primitives.
5. Application shell foundation (no real RBAC).

### After bootstrap — frontend implementation sprint (approved)

1. Implement **actual Sign-in** at `/signin` from Figma node `25:574` (static Spline fallback first).
2. Implement **actual Overview** at `/overview` from Figma node `2:63` with clearly labeled fixtures.
3. Compare browser result to Figma; record gaps honestly.
4. Other module routes may remain “not in this phase” stubs.

---

## 14. Routing Structure

| Route | Treatment |
|---|---|
| `/signin` | **Actual Sign-in screen** in post-bootstrap frontend sprint (no real auth until Phase 2) |
| `/overview` | **Actual Overview screen** in post-bootstrap frontend sprint (fixtures labeled simulated) |
| `/governance`, `/risks`, `/assets`, `/assets/:assetId`, `/vulnerabilities`, `/soc`, `/incidents`, `/threat-intelligence`, `/cyber-range`, `/reports`, `/administration` | Stubs until authorized |
| `/account/profile`, `/account/security`, `/account/preferences` | Stubs |
| `/account/workspace` | Stub (was `/workspace` in early handoff draft) |

Backend Phase 1:

```text
GET /api/v1/health
GET /api/v1/health/live
GET /api/v1/health/ready
```

Do not implement `/api/v1/auth` until Phase 2. Sign-in UI may exist visually without production auth wiring.

---

## 15. Proposed Implementation Sequence (Phase 1 — after Phase 0)

1. Create `.gitignore`, `.env.example`, README scripts.
2. Add `compose.yaml` for postgres, redis/valkey, SeaweedFS.
3. Scaffold `apps/api` with settings, health routes, SQLAlchemy, Alembic baseline.
4. Scaffold `apps/worker` Celery foundation (no meaningful jobs).
5. Scaffold `apps/web` Vite React TS + Tailwind + tokens + router.
6. Add pytest / Vitest smoke tests + GitHub Actions skeleton.
7. Verify exit gate: Compose healthy, migrations apply, health ready OK, web loads.
8. **Stop for approval**, then frontend sprint: actual `/signin` + `/overview` from Figma.

Do not proceed to Phase 2 without approval.

---

## 16. Resolved Decisions and Remaining Risks

### 16.1 Resolved

| Topic | Decision |
|---|---|
| Phase 0 vs Phase 1 | **Option A** — complete minimal Phase 0 before Phase 1 |
| Package manager | **pnpm** |
| Python tooling | **uv** |
| Python types | **Pyright** |
| Frontend format | **Prettier** |
| App process model | Infra in Compose; API + web on Mac host early |
| Celery | Minimal worker foundation included; no jobs yet |
| Sign-in route | `/signin` |
| Workspace route | `/account/workspace` |
| Figma | Access available; file linked above |
| Sign-in / Overview | Real Figma implementations after bootstrap |

### 16.2 Remaining risks

| Risk | Mitigation |
|---|---|
| Python 3.14 / React 19.3 / Vite 8 compatibility | Verify at install; document in `VERSIONS.md` |
| Auth UX (SSO / Explore demo vs local accounts) | Record before wiring Phase 2; no production bypass |
| Scope creep beyond Sign-in + Overview | Other modules stay stubs |
| Secrets in git | `.gitignore` + Gitleaks |

---

## 17. Acceptance Checklist (Phase 1 Bootstrap Exit Gate)

- [ ] Monorepo directories exist per plan
- [ ] Compose starts postgres, redis/valkey, SeaweedFS on Mac
- [ ] `.env.example` present; `.env` gitignored
- [ ] FastAPI health live/ready on host
- [ ] Alembic baseline works
- [ ] Frontend starts on host with tokens/shell
- [ ] Celery worker foundation exists (no real jobs)
- [ ] pytest and Vitest smoke tests pass
- [ ] GitHub Actions skeleton runs lint/typecheck/tests
- [ ] No secrets, datasets, fabricated evidence, or cyber-range installs

**Post-bootstrap frontend sprint (separate approval):** actual `/signin` and `/overview` match Figma within documented limitations.

---

## 18. Next Step

Complete minimal Phase 0 gate → approve → execute §15 Phase 1 bootstrap.
