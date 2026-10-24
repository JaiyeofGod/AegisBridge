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
- Authenticated mutations use `apiMutate` / `apiPatch` / `apiPut` / `apiPostCsrf` / `apiDelete`, which attach `X-CSRF-Token`.
- On `csrf_failed`, the client refreshes the token once and retries once.
- CSRF is not authentication and must never be treated as a session substitute.

### First write APIs

| Action                             | Endpoint                                                 | Notes                                                                                                                                                                                                            |
| ---------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Save preferences                   | `PATCH /api/v1/account/preferences`                      | Fields: theme, density, landing_page, reduced_motion. UI shows Default vs Stored.                                                                                                                                |
| Update risk treatment              | `PATCH /api/v1/risks/{id}/treatment`                     | Requires server permission `risk.manage`. Uses `expected_updated_at` when present.                                                                                                                               |
| Update incident                    | `PATCH /api/v1/incidents/{id}`                           | Requires `incident.manage` (+ `incident.close` to resolve/close). Owner read-only in UI.                                                                                                                         |
| Update remediation                 | `PATCH /api/v1/vulnerabilities/{id}/remediation`         | Requires `vulnerability.manage`. CVSS/EPSS/KEV/action_decision immutable. `asset_id` is a selector only.                                                                                                         |
| Refresh vulnerability intelligence | `POST /api/v1/vulnerabilities/{id}/intelligence/refresh` | Requires `vulnerability.manage` + CSRF. No body. One CVE. NVD, CISA KEV, and FIRST EPSS stay separate. Does not change remediation or `action_decision`. Records without a CVE stay valid and are not refreshed. |
| Update access review               | `PATCH /api/v1/administration/access-reviews/{id}`       | Requires `administration.manage`. Name/status only. Findings deferred.                                                                                                                                           |
| Update user status                 | `PATCH /api/v1/administration/users/{id}`                | Requires `administration.manage`. `active`/`inactive` only; inactive confirmation in UI. Last-admin → 409.                                                                                                       |
| Replace user roles                 | `PUT /api/v1/administration/users/{id}/roles`            | Requires `user.role.manage`. Seven-role catalog only. Last-admin demotion → 409.                                                                                                                                 |
| Update control implementation      | `PATCH /api/v1/governance/controls/{id}/implementation`  | Requires `control.manage`. Status/notes/owner; `expected_updated_at` when present.                                                                                                                               |
| Record/update control test         | `POST .../tests`, `PATCH /control-tests/{id}`            | Requires `control.manage`. Manual development recordings only; not automated validation.                                                                                                                         |
| Create evidence metadata           | `POST /api/v1/evidence`                                  | Requires `evidence.manage`. Metadata first; no object URI / credentials in the body.                                                                                                                             |
| Upload evidence object             | `POST /api/v1/evidence/{id}/object` (multipart `file`)   | Requires `evidence.manage` + CSRF. `apiPostMultipart`; browser sets multipart boundary. One object/record.                                                                                                       |
| Download evidence object           | `GET /api/v1/evidence/{id}/object`                       | Requires `evidence.read`. Authenticated Blob download; no public/S3 URLs.                                                                                                                                        |
| Delete evidence object             | `DELETE /api/v1/evidence/{id}/object`                    | Requires `evidence.manage` + CSRF. Deletes stored bytes only; metadata + control links remain.                                                                                                                   |
| Link/unlink evidence               | `POST`/`DELETE .../controls/{id}/evidence/{evidence_id}` | Requires `control.manage` + `evidence.manage`. Unlink removes association only.                                                                                                                                  |
| Create policy                      | `POST /api/v1/policies`                                  | Requires `policy.manage` + CSRF. Server assigns `POL-NNNN` + initial draft. No client-generated ids.                                                                                                             |
| Create/edit draft version          | `POST`/`PATCH .../policies/{id}/versions`                | Requires `policy.manage` + CSRF. Published/superseded versions are immutable in the UI.                                                                                                                          |
| Policy lifecycle                   | `POST .../policies/{id}/transition`                      | Manage vs approve from permission codes (not role names). Publish/retire confirmations required.                                                                                                                 |
| Acknowledge policy                 | `POST .../policies/{id}/acknowledge`                     | Current authenticated user + current published version only. Idempotent; count only (no fake %).                                                                                                                 |
| Link/unlink policy↔control         | `POST`/`DELETE .../policies/{id}/controls/{control_id}`  | Requires `policy.manage` + CSRF. Human ids; no body. Unlink removes relationship only (not policy/control/tests/evidence).                                                                                       |
| Link/unlink risk↔control           | `POST`/`DELETE .../risks/{id}/controls/{control_id}`     | Requires `risk.manage` + CSRF. Human ids; no body. Mapping does not change score, treatment, or prove effectiveness. Unlink removes the relationship only.                                                       |
| List incident tasks                | `GET /api/v1/incidents/{id}/tasks`                       | Requires `incident.read`. `page` / `page_size` (25) and optional `status`. Public ids are `TASK-NNNN`.                                                                                                           |
| Create incident task               | `POST /api/v1/incidents/{id}/tasks`                      | Requires `incident.manage` + CSRF. Body is `title`, `status`, and `assignee` only when a directory user is selected. Server assigns `TASK-NNNN`. Does not change the incident.                                   |
| Update incident task               | `PATCH /api/v1/incidents/{id}/tasks/{task_id}`           | Requires `incident.manage` + CSRF. `title` / `status` / changed `assignee` plus `expected_updated_at`. `assignee: null` clears it. Complete, reopen, and cancel use this route. No delete.                       |
| Operational directory              | `GET /api/v1/directory/users`                            | Requires `directory.read`. Active same-organization users for the assignee picker. `page` / `page_size` (20) and optional `q`. No CSRF. Not the Administration users API.                                        |

Backend remains the authorization boundary. Evidence files are stored outside PostgreSQL (local SeaweedFS / future R2) via the API only. SHA-256 is calculated server-side at ingestion; `integrity_verified` remains false; malware scanning is not implemented. Policy UI preserves version history and Policy → Control → Test → Evidence traceability; licensed CIS safeguard prose is never surfaced. E-sign, email, and rich docs remain unsupported. Integration credential writes, reports, and Cyber Range control stay disabled in the UI.

### Incident → Response Tasks

The selected incident's Tasks section lists `TASK-NNNN` records from `GET /incidents/{id}/tasks` (page size 25, optional status filter). `incident.manage` can create a task and edit title or status, including Complete, Reopen, and Cancel. `incident.close` is not required to complete a task. Completing every task does not resolve or close the incident. Cancel keeps the task in history; the UI has no delete action. Priority, due date, and description are not stored. When the caller also has `directory.read`, the assignee control searches `GET /directory/users` (active users in the caller's organization, page size 20). The request sends a user human id such as `USR-0004`, or `null` on update to clear it. The picker does not call Administration, and it does not show email, roles, or permissions. Without `directory.read`, title and status stay editable and the assignee stays read-only. Automated containment and SOAR are not part of this screen.

### Catalog discovery (controls & policies)

- `GET /api/v1/governance/controls` and `GET /api/v1/policies` are queried with bounded `page` / `page_size` (default 25; selector uses 20), optional metadata `q`, closed filters, and allowlisted `sort`/`direction`.
- The UI does **not** preload the entire catalog or assume `page_size=50` is complete.
- Policy → Add Control and Risk → Add control use the same control list API with server-side search/pagination (`page_size` 20); already-mapped controls are disabled. Framework and implementation-status filters are available on the risk selector.
- Risk detail shows mapped controls and can open the Governance control (tests and evidence). Control detail shows mapped risks (likelihood, impact, stored score, treatment status). No residual or effectiveness score is invented. Licensed CIS text is excluded.
- Query keys include full query state; write invalidation uses query-key families (`["governance","controls"]`, `["policies"]`), not hard-coded page=1 keys.

### Route guards (UX only)

`RequireAuth` / `GuestOnly` protect product and account routes in the SPA. They are **not** the security boundary; FastAPI enforces session + RBAC + CSRF on mutating routes.

## Notes

- Dark theme tokens are the Phase 1 default. Stored preference theme/density are persisted but not yet applied as a global theme engine.
- Overview through Reports and Cyber Range read from the development API (`VITE_API_BASE_URL`, default Vite proxy `/api`).
- Development sign-in hint shows the seeded email only; the password comes from private local env (`AEGIS_DEV_ADMIN_PASSWORD`) and is never displayed.
- Spline scene remains on the sign-in visual panel; reduced motion / compact viewports use the static fallback.
