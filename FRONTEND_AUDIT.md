# Frontend audit

Audit date: 22 Oct 2026 (updated after Governance/Policy catalog server-side search & pagination). Scope is the implemented web client.

## Auth / session / CSRF (current)

| Concern | Status |
|---|---|
| `POST /api/v1/auth/login` | Wired from `/signin`. Cookie session only. Stores returned `csrf_token` in memory. |
| `GET /api/v1/auth/session` | Called on load via TanStack Query `["auth","session"]`. |
| `GET /api/v1/auth/me` | Available; session payload already embeds user for guards. |
| `GET /api/v1/auth/csrf` | Used to acquire/refresh in-memory synchronizer token. |
| `POST /api/v1/auth/logout` | Sign out sends `X-CSRF-Token` + `credentials: "include"`. Clears in-memory CSRF on completion. |
| `POST /api/v1/auth/logout-all` | Same CSRF rules from Account Security. |
| Account preferences | `GET` + `PATCH /api/v1/account/preferences` (CSRF). Persistence `default` \| `stored`. |
| Risk treatment | `PATCH /api/v1/risks/{id}/treatment` when `risk.manage` (CSRF). Read-only without it. |
| Incident update | `PATCH /api/v1/incidents/{id}` when `incident.manage` (CSRF). Close/resolve also needs `incident.close`. Owner stays read-only (no user catalog on page). |
| Incident response tasks | `GET/POST /api/v1/incidents/{id}/tasks` and `GET/PATCH .../tasks/{task_id}` when `incident.read` / `incident.manage` (CSRF on writes). Public ids `TASK-NNNN`. `incident.close` is not required to complete a task. Completion does not close the incident. Cancel keeps history; no delete. Assignee editing uses `GET /api/v1/directory/users` when both `incident.manage` and `directory.read` are present. Human ids only. No Administration user API, email, roles, or permissions. |
| Vulnerability remediation | `PATCH /api/v1/vulnerabilities/{id}/remediation` when `vulnerability.manage` (CSRF). CVSS/EPSS/KEV/action_decision immutable. `asset_id` selector only. |
| Vulnerability intelligence | Detail GET `intelligence` shows persisted NVD published/modified/fetched times, CISA KEV vendor, product, required action, CISA due date, and last-checked time, and the selected EPSS fetch time. Those timestamps survive reload. CISA due date is not the remediation due date. No source-health score. `POST .../intelligence/refresh` when `vulnerability.manage` (CSRF, no body). Hidden without that permission and for records with no CVE. No bulk or scheduled refresh. |
| Access review update | `PATCH /api/v1/administration/access-reviews/{id}` when `administration.manage` (CSRF). Name/status only. Findings deferred. |
| User status update | `PATCH /api/v1/administration/users/{id}` when `administration.manage` (CSRF). `active`/`inactive` only; inactive requires confirmation. |
| User role assignment | `PUT /api/v1/administration/users/{id}/roles` when `user.role.manage` (CSRF). Seven-role catalog only. |
| Control implementation | `PATCH /api/v1/governance/controls/{id}/implementation` when `control.manage` (CSRF). Status/notes/owner only. |
| Manual control tests | `POST .../tests` + `PATCH /control-tests/{id}` when `control.manage` (CSRF). Manual development recordings only. |
| Evidence metadata | `POST /api/v1/evidence` when `evidence.manage` (CSRF). Metadata first; private file upload is a separate step. |
| Evidence object upload | `POST /api/v1/evidence/{id}/object` multipart `file` when `evidence.manage` (CSRF). Via `apiPostMultipart` (no manual Content-Type). |
| Evidence object download | `GET /api/v1/evidence/{id}/object` when `evidence.read`. Blob through API; temporary object URL revoked after download. No public/S3 URLs. |
| Evidence object delete | `DELETE /api/v1/evidence/{id}/object` when `evidence.manage` (CSRF). Confirmation required; metadata + control links remain. |
| Control ↔ evidence link | `POST`/`DELETE .../controls/{id}/evidence/{evidence_id}` when `control.manage` + `evidence.manage` (CSRF). Unlink is association-only. |
| Policy create / versions | `POST /api/v1/policies`, `POST`/`PATCH .../versions` when `policy.manage` (CSRF). Server assigns `POL-NNNN`; drafts editable; published/superseded read-only. |
| Policy lifecycle | `POST .../transition` — `policy.manage` for draft/review moves; `policy.approve` for approve/publish/retire. Publish/retire require confirmation. No role-name inference. |
| Policy acknowledgement | `POST .../acknowledge` for current user + current published version only (CSRF). Count shown; no fake completion %. |
| Policy ↔ control mapping | `POST`/`DELETE .../policies/{id}/controls/{control_id}` when `policy.manage` (CSRF). Human ids; no body; unlink confirms relationship-only removal. |
| Credentials | `credentials: "include"` on all API client fetches. CSRF token never in localStorage/sessionStorage. |
| Route guards | `RequireAuth` / `GuestOnly` — **UX only**. Not the security boundary. |
| Domain GET authz | Enforced on the backend. Frontend still uses server permission labels for UX. |
| Remaining writes / MFA / SSO | Integration credentials, reports, and cyber-range writes still deferred. |

Development sign-in hint shows seeded email `amara.okonkwo@aegisbridge.example` only. The development password is never rendered.

### CSRF client rules

- Token lives in application memory only (`services/csrf.ts`).
- Mutations use `apiMutate` / `apiPatch` / `apiPut` / `apiPostCsrf` / `apiDelete` / `apiPostMultipart`, which attach `X-CSRF-Token`.
- Multipart uploads must not set `Content-Type` manually so the browser can supply the boundary.
- On `403` + `csrf_failed`, the client refreshes once via `GET /auth/csrf` and retries once (no loops).
- CSRF is not authentication; the HttpOnly session cookie remains the auth credential.

## Routes reviewed

| Route | Result |
|---|---|
| `/signin` | Guest-only. Real password login. Authenticated users redirect to `/overview`. |
| `/overview` | Protected (UX). Renders from development API. |
| `/governance` | Protected (UX). Control implementation/tests + evidence metadata/objects + Policies tab (lifecycle, versions, acknowledgement, control mappings). Controls and policies lists use server-side `page`/`page_size`/`q`/filters/sort (bounded; no full-catalog preload). Policy→control Add Control selector queries the control catalog with server-side search/pagination. |
| `/risks` | Protected (UX). Treatment editable with `risk.manage`; read-only with `risk.read`. |
| `/assets` | Protected (UX). |
| `/assets/FIN-APP-01` | Protected (UX). |
| `/vulnerabilities` | Protected (UX). Remediation editable with `vulnerability.manage`; enrichment fields read-only. |
| `/soc` | Protected (UX). |
| `/incidents` | Protected (UX). Incident fields editable with `incident.manage`. Response Tasks use `TASK-NNNN`, server pagination/status filter, and `incident.manage` for create/edit/complete/reopen/cancel. Assignee selection uses the operational directory when `directory.read` is also present. |
| `/threat-intelligence` | Protected (UX). Indicators, advisories, enrichment, and sources stay on the page. The indicator list is server-paged (25) and shows value, type, source, last seen, and status. The selected row loads detail for subtype, data origin (external feed or simulated), threat type, malware family, tags, source status, source confidence, fetch time, and a source reference link. Indicator URL values stay plain text. `threat_intel.read` adds a MITRE ATT&CK tab: pinned Enterprise 20.0 tactics and techniques, server-side search, tactic filter, sub-techniques, pagination, and read-only detail. Revoked and deprecated rows stay out of the default list. |
| `/cyber-range` | Protected (UX). Controls still disabled. |
| `/reports` | Protected (UX). |
| `/administration` | Protected (UX). Access-review / user status / role assignment wired; integration credential writes still disabled. |
| `/account/profile` | Protected (UX). API profile fields; save still disabled. |
| `/account/security` | Protected (UX). MFA honestly not configured; logout-all CSRF-protected. |
| `/account/preferences` | Protected (UX). Persisted via PATCH; shows Default vs Stored. |
| `/account/workspace` | Protected (UX). Roles, permissions, privileged flag from API. |

Unknown paths redirect to `/signin`. Auth status unknown shows a session loading state before redirect or render.

## Issues intentionally deferred

- Integration credential writes, Cyber Range control, reports.
- Incident task priority, due date, description, and hard deletion. Automated containment and SOAR remain unsupported. Incident owner selection is still deferred.
- Policy rich-text editors, PDF/document generation, e-signature, email notifications, AI generation, attachments, policy↔risk mappings, evidence↔risk direct mappings, bulk/drag-drop mapping, graph views, URL-persisted catalog query state, infinite scroll.
- Evidence malware scanning, independent integrity re-verification, public evidence URLs, browser-to-S3 uploads, R2 production cutover UI.
- MFA enrollment, SSO/OIDC, password reset.
- Profile/security field writes beyond preferences.
- Incident/vulnerability owner selectors (no user catalog on those pages yet).
- Tab widget a11y consolidation across modules.
- Spline runtime chunk size.

## Accessibility / responsive / consistency

Prior audit findings still apply for shell focus rings, disabled search/notifications, and module tab patterns. Account preferences and risk treatment now use live mutations; surrounding domain modules may still show DEVELOPMENT / SEEDED banners for reads.

## Bundle and build findings

Route-level lazy loading remains. Auth adds a small session query on protected and guest routes. Quality gates after this slice: lint, Prettier, TypeScript, Vitest, and production build.

## Readiness assessment

Frontend CSRF handling, preferences, risk treatment, risk↔control mapping, incident updates, vulnerability remediation, administration (access reviews, user status, role assignment), and governance (control implementation, manual tests, evidence metadata + private object storage + linking, mapped risks on control detail) are wired. Risk detail can link an existing control through the server-paginated catalog (`page_size` 20). Mapping is relationship-only: it does not change likelihood, impact, score, treatment, or implementation status, and it does not claim the control is effective. Open control navigates to Governance control detail (tests and evidence). Licensed CIS safeguard prose is not shown. **Backend remains the authorization boundary.** Files flow only through authenticated FastAPI; SHA-256 is server-calculated at ingestion; `integrity_verified` stays false; malware scanning is not claimed. Integration/credential and remaining write APIs stay disabled in the UI.
