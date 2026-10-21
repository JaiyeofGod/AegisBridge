# Frontend audit

Audit date: 20 Oct 2026 (updated after auth/session/account integration). Scope is the implemented web client. Domain GET authorization is still deferred to the backend.

## Auth / session integration (current)

| Concern | Status |
|---|---|
| `POST /api/v1/auth/login` | Wired from `/signin` (email + password). Cookie session only. |
| `GET /api/v1/auth/session` | Called on load via TanStack Query `["auth","session"]`. |
| `GET /api/v1/auth/me` | Available; session payload already embeds user for guards. |
| `POST /api/v1/auth/logout` | Wired from account/header Sign out. |
| `POST /api/v1/auth/logout-all` | Wired from Account Security when present. |
| Account profile/security/preferences/workspace | Real API reads; no fixture fallback in pages. |
| Credentials | `credentials: "include"` on all API client fetches. No localStorage/sessionStorage tokens. |
| Route guards | `RequireAuth` / `GuestOnly` — **UX only**. Not the security boundary. |
| Domain GET authz | **Not enforced yet.** Next security slice. |
| MFA / SSO / password reset / CSRF writes | Out of scope for this slice. |

Development sign-in hint shows seeded email `amara.okonkwo@aegisbridge.example` only. The development password is never rendered.

## Routes reviewed

| Route | Result |
|---|---|
| `/signin` | Guest-only. Real password login. Authenticated users redirect to `/overview`. |
| `/overview` | Protected (UX). Renders from development API. |
| `/governance` | Protected (UX). |
| `/risks` | Protected (UX). |
| `/assets` | Protected (UX). |
| `/assets/FIN-APP-01` | Protected (UX). |
| `/vulnerabilities` | Protected (UX). |
| `/soc` | Protected (UX). |
| `/incidents` | Protected (UX). |
| `/threat-intelligence` | Protected (UX). |
| `/cyber-range` | Protected (UX). |
| `/reports` | Protected (UX). |
| `/administration` | Protected (UX). Nav/action visibility uses server `administration.read` / `privileged`. |
| `/account/profile` | Protected (UX). API profile fields; save disabled. |
| `/account/security` | Protected (UX). Session metadata; MFA honestly not configured; logout-all wired. |
| `/account/preferences` | Protected (UX). `persistence=not_stored`; local UI preview labeled Not persisted. |
| `/account/workspace` | Protected (UX). Roles, permissions, privileged flag from API. |

Unknown paths redirect to `/signin`. Auth status unknown shows a session loading state before redirect or render.

## Issues intentionally deferred

- Backend enforcement on domain GET/write routes (frontend guards are presentation only).
- MFA enrollment, SSO/OIDC, password reset, CSRF-protected mutations.
- Preference persistence and profile/security writes.
- Do not delete unused `ComingSoonPage` or leftover `src/mocks/account.ts` in this pass (pages no longer import the mock).
- Tab widget a11y consolidation across modules.
- Spline runtime chunk size.

## Accessibility / responsive / consistency

Prior audit findings still apply for shell focus rings, disabled search/notifications, and module tab patterns. Account and sign-in now reflect authenticated session data rather than claiming simulated authentication once a server session exists. Surrounding domain modules may still show DEVELOPMENT / SEEDED banners.

## Bundle and build findings

Route-level lazy loading remains. Auth adds a small session query on protected and guest routes. Quality gates after this slice: lint, Prettier, TypeScript, Vitest, and production build.

## Readiness assessment

Frontend auth/session/account integration is in place for local development login. **Treat SPA route guards as UX only until backend domain authorization is enforced.**
