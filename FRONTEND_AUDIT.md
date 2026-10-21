# Frontend audit

Audit date: 21 Oct 2026 (updated after CSRF + preferences + risk treatment write integration). Scope is the implemented web client.

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
| Credentials | `credentials: "include"` on all API client fetches. CSRF token never in localStorage/sessionStorage. |
| Route guards | `RequireAuth` / `GuestOnly` — **UX only**. Not the security boundary. |
| Domain GET authz | Enforced on the backend. Frontend still uses server permission labels for UX. |
| Broader writes / MFA / SSO | Still deferred. |

Development sign-in hint shows seeded email `amara.okonkwo@aegisbridge.example` only. The development password is never rendered.

### CSRF client rules

- Token lives in application memory only (`services/csrf.ts`).
- Mutations use `apiMutate` / `apiPatch` / `apiPostCsrf`, which attach `X-CSRF-Token`.
- On `403` + `csrf_failed`, the client refreshes once via `GET /auth/csrf` and retries once (no loops).
- CSRF is not authentication; the HttpOnly session cookie remains the auth credential.

## Routes reviewed

| Route | Result |
|---|---|
| `/signin` | Guest-only. Real password login. Authenticated users redirect to `/overview`. |
| `/overview` | Protected (UX). Renders from development API. |
| `/governance` | Protected (UX). |
| `/risks` | Protected (UX). Treatment editable with `risk.manage`; read-only with `risk.read`. |
| `/assets` | Protected (UX). |
| `/assets/FIN-APP-01` | Protected (UX). |
| `/vulnerabilities` | Protected (UX). |
| `/soc` | Protected (UX). |
| `/incidents` | Protected (UX). Writes still disabled. |
| `/threat-intelligence` | Protected (UX). |
| `/cyber-range` | Protected (UX). Controls still disabled. |
| `/reports` | Protected (UX). |
| `/administration` | Protected (UX). User/role writes still disabled. |
| `/account/profile` | Protected (UX). API profile fields; save still disabled. |
| `/account/security` | Protected (UX). MFA honestly not configured; logout-all CSRF-protected. |
| `/account/preferences` | Protected (UX). Persisted via PATCH; shows Default vs Stored. |
| `/account/workspace` | Protected (UX). Roles, permissions, privileged flag from API. |

Unknown paths redirect to `/signin`. Auth status unknown shows a session loading state before redirect or render.

## Issues intentionally deferred

- Broader domain mutations (incidents, vulnerability remediation, administration writes, Cyber Range control).
- MFA enrollment, SSO/OIDC, password reset.
- Profile/security field writes beyond preferences.
- Tab widget a11y consolidation across modules.
- Spline runtime chunk size.

## Accessibility / responsive / consistency

Prior audit findings still apply for shell focus rings, disabled search/notifications, and module tab patterns. Account preferences and risk treatment now use live mutations; surrounding domain modules may still show DEVELOPMENT / SEEDED banners for reads.

## Bundle and build findings

Route-level lazy loading remains. Auth adds a small session query on protected and guest routes. Quality gates after this slice: lint, Prettier, TypeScript, Vitest, and production build.

## Readiness assessment

Frontend CSRF handling, preference persistence, and risk treatment update are wired. **Backend remains the authorization boundary.** Remaining write APIs stay disabled in the UI.
