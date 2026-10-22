# AegisBridge Web (`apps/web`)

Phase 1/2 frontend with **Sign-in** (`/signin`), product modules, and **Account** pages wired to the FastAPI auth/session/account APIs, plus the first authenticated write slice.

## Commands

```bash
pnpm install   # from repo root or this package
pnpm dev
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Requires Node.js 24 LTS. Dev server: `http://127.0.0.1:5173` (proxies `/api` to `http://127.0.0.1:8000`).

## Authentication

- Session cookies are HttpOnly. All auth and account fetches use `credentials: "include"`.
- Session tokens are never stored in `localStorage` / `sessionStorage` and are never read from JavaScript.
- On load, the client calls `GET /api/v1/auth/session` before treating the user as authenticated.
- Sign-in posts to `POST /api/v1/auth/login`, stores the returned `csrf_token` in memory, invalidates session queries, and navigates to `/overview`.
- Logout / logout-all post with `X-CSRF-Token` and clear in-memory CSRF state afterward.
- Account pages read `/api/v1/account/profile|security|preferences|workspace`.

### CSRF (synchronizer token)

- `GET /api/v1/auth/csrf` (or login `csrf_token`) fills an **in-memory** token only.
- Authenticated mutations use `apiMutate` / `apiPatch` / `apiPostCsrf`, which attach `X-CSRF-Token`.
- On `csrf_failed`, the client refreshes the token once and retries once.
- CSRF is not authentication and must never be treated as a session substitute.

### First write APIs

| Action                | Endpoint                                         | Notes                                                                                                    |
| --------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Save preferences      | `PATCH /api/v1/account/preferences`              | Fields: theme, density, landing_page, reduced_motion. UI shows Default vs Stored.                        |
| Update risk treatment | `PATCH /api/v1/risks/{id}/treatment`             | Requires server permission `risk.manage`. Uses `expected_updated_at` when present.                       |
| Update incident       | `PATCH /api/v1/incidents/{id}`                   | Requires `incident.manage` (+ `incident.close` to resolve/close). Owner read-only in UI.                 |
| Update remediation    | `PATCH /api/v1/vulnerabilities/{id}/remediation` | Requires `vulnerability.manage`. CVSS/EPSS/KEV/action_decision immutable. `asset_id` is a selector only. |

Backend remains the authorization boundary. Incident task writes, administration, integrations, reports, and Cyber Range control stay disabled in the UI.

### Route guards (UX only)

`RequireAuth` / `GuestOnly` protect product and account routes in the SPA. They are **not** the security boundary; FastAPI enforces session + RBAC + CSRF on mutating routes.

## Notes

- Dark theme tokens are the Phase 1 default. Stored preference theme/density are persisted but not yet applied as a global theme engine.
- Overview through Reports and Cyber Range read from the development API (`VITE_API_BASE_URL`, default Vite proxy `/api`).
- Development sign-in hint shows the seeded email only; the password comes from private local env (`AEGIS_DEV_ADMIN_PASSWORD`) and is never displayed.
- Spline scene remains on the sign-in visual panel; reduced motion / compact viewports use the static fallback.
