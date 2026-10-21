# Authentication and RBAC

**Status:** Backend authentication, domain read authorization, **CSRF-protected authenticated writes** (preferences + risk treatment), and session CSRF foundation are in place. Frontend route guards remain UX only. SSO/OIDC, MFA, email reset, rate limiting, and broader domain writes remain deferred.

## Authentication model

- Local email + password accounts only.
- Passwords hashed with **Argon2id** via `argon2-cffi` (`app/security/passwords.py`).
- Server-managed sessions with **opaque** URL-safe tokens.
- Only a **SHA-256 digest** of the session token is stored (`sessions.token_digest`).
- The raw token is delivered in an **HttpOnly** cookie (`aegis_session` by default).
- Cookie flags: `HttpOnly`; `SameSite=Lax` by default; `Secure` when `APP_ENV` is not local/dev/test (or when `SESSION_COOKIE_SECURE=true`).
- Sessions use **fixed-duration** expiry (`SESSION_TTL_SECONDS`, default 8 hours) from creation time and can be revoked (`revoked_at`).
- `last_seen_at` is observational only and **does not** extend `expires_at` (no sliding sessions).
- Do **not** use `localStorage` for authentication tokens.

Plaintext passwords, password hashes, raw session tokens, and token digests are never returned in API bodies.

## Login enumeration / timing

Unknown email, wrong password, missing credential, and inactive account all:

- return the same `401` / `authentication_failed` / “Invalid email or password.” body
- always perform Argon2 verification against either the stored hash or a **fixed dummy Argon2id hash** (not a real account credential)

Public responses and `LOGIN_FAILURE` audit rows do not state whether the account exists, is inactive, or lacks a credential.

## Session lifecycle

1. `POST /api/v1/auth/login` verifies an active user and password, creates a **fresh** `sessions` row, sets the cookie, audits `LOGIN_SUCCESS`.
2. Subsequent requests read the cookie, look up the digest, reject revoked/expired/inactive principals. Server-side expiry is authoritative even if the browser keeps the cookie.
3. `POST /api/v1/auth/logout` revokes the current session and clears the cookie (matching name/path/Secure/SameSite/HttpOnly).
4. `POST /api/v1/auth/logout-all` revokes every active session for the current user.
5. `GET /api/v1/auth/session` reports authenticated state without exposing secrets.
6. `GET /api/v1/auth/me` returns the current user (401 if unauthenticated).

Failed logins audit `LOGIN_FAILURE` with actor label `unknown` and a generic detail string (no credential/session secrets).

## Cookie strategy and local SPA notes

- `HttpOnly=true`, `SameSite=Lax` (default), `Secure=true` outside local/dev/test (or when `SESSION_COOKIE_SECURE=true`)
- `Path=/` by default; **no `Domain` attribute** (host-only)
- `Max-Age` matches `SESSION_TTL_SECONDS` (aligned with server-side `expires_at`)

Preferred local setup: Vite proxies `/api` to the API so the browser treats the app as **same-site**. `SameSite=Lax` then works without `SameSite=None`.

If the frontend calls the API cross-origin with credentials (`VITE_API_BASE_URL=http://localhost:8000`), CORS allowlists `http://localhost:5173` and `http://127.0.0.1:5173` with `allow_credentials=True`. Wildcard origins are rejected when credentials are enabled.

## CSRF strategy (synchronizer token)

Session cookies remain HttpOnly. CSRF uses a **synchronizer token** bound to the server session:

1. On login, the API generates a CSRF token distinct from the session cookie, stores only its SHA-256 digest on `sessions.csrf_token_digest`, and returns the raw token in the login JSON as `csrf_token`.
2. `GET /api/v1/auth/csrf` (authenticated) rotates the token and returns `{ csrf_token, header_name: "X-CSRF-Token" }`.
3. Authenticated state-changing requests must send header `X-CSRF-Token` matching the digest for the caller’s current session.
4. Failures return `403` / `csrf_failed` without leaking tokens or digests.
5. SameSite=Lax remains a defense-in-depth layer; it is **not** sufficient alone.

### Methods / routes that require CSRF

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/logout` | Required when a session cookie is present; anonymous logout is a no-op |
| POST | `/auth/logout-all` | Authenticated + CSRF |
| PATCH | `/account/preferences` | Authenticated + CSRF |
| PATCH | `/risks/{risk_id}/treatment` | Authenticated + `risk.manage` + CSRF |

### CSRF exemptions

| Method | Path | Reason |
|---|---|---|
| POST | `/auth/login` | Not session-authenticated beforehand; credentials in body |
| GET | `*` | Safe/read-only |
| GET | `/auth/csrf` | Issues the token; does not mutate domain state |

Do **not** put the session cookie value in JavaScript or localStorage. Do not treat the CSRF token as authentication.

## Client metadata

Optional truncated `user_agent` and `client_host` may be stored on sessions for operator diagnostics. `client_host` uses the ASGI connection peer (`request.client.host`) only — **not** `X-Forwarded-For` — unless a future deployment explicitly documents a trusted proxy model.

## Password hashing

- Algorithm: **Argon2id** explicitly (`argon2.low_level.Type.ID`; `algorithm` column constrained to `argon2id`).
- Development password for `USR-0001` is hashed only when `AEGIS_DEV_ADMIN_PASSWORD` is set and non-empty and `APP_ENV` is `local` / `development` / `dev` / `test`.
- Empty/unset development password does not create a credential.
- Production must never bootstrap a predictable default password.

## Seven roles

1. Administrator  
2. CISO  
3. GRC Analyst  
4. SOC Analyst  
5. Security Engineer  
6. Auditor  
7. Read Only  

No eighth role is defined.

## Privileged users

A user is **privileged** when they hold **Administrator** or **Security Engineer**. This matches the administration summary semantics and must be evaluated on the server.

## Permission catalog

Capability codes live in `app/security/permissions.py` (`PERMISSION_CATALOG`). They include the sensitive actions required by `SECURITY_REQUIREMENTS.md` / master §103:

`risk.accept`, `control.update`, `evidence.download`, `incident.close`, `integration.manage`, `user.role.manage`, `detection.manage`

plus domain `.read` / `.manage` capabilities enforced on current read routes.

Effective permissions for a principal are the **union** of permissions for their assigned roles from `ROLE_PERMISSIONS`. Stored `access_entitlements` remain labels aligned to the catalog; they are not a second policy engine.

### Role → permission mapping

| Role | Permissions |
|---|---|
| Administrator | All catalog permissions |
| CISO | Broad `*.read` across domains + `audit.read` (no sensitive accept/close/manage) |
| GRC Analyst | Risk/control/evidence/report/dataset + `risk.accept`, `control.update`, `evidence.download` |
| SOC Analyst | Alert/detection/incident/threat intel reads + `incident.manage`, `incident.close` |
| Security Engineer | Detection/vuln/integration/cyber-range/dataset technical set + `detection.manage`, `integration.manage` |
| Auditor | Read-heavy GRC/evidence/audit + `evidence.download` |
| Read Only | Limited reads (assets, risk, control, vuln, alert, detection, incident, threat intel, report, dataset, cyber range) |

See `ROLE_PERMISSIONS` in code for the authoritative set.

## Authorization helpers

Centralized in `app/api/deps.py`:

- `CurrentPrincipal` / `OptionalPrincipal`
- `require_roles(...)`
- `require_permissions(...)` (all required)
- `require_any_permission(...)`

Do not scatter role-name string checks in route modules.

## Account APIs

Authenticated reads (401 without a valid session):

| Method | Path |
|---|---|
| GET | `/api/v1/account/profile` |
| GET | `/api/v1/account/security` |
| GET | `/api/v1/account/preferences` |
| PATCH | `/api/v1/account/preferences` | CSRF; current user only |
| GET | `/api/v1/account/workspace` |

Preferences: `persistence` is `default` until the user saves, then `stored` in `user_preferences`. MFA remains `not_configured`.

## Current API enforcement

**Backend authorization is the security boundary.** Frontend route guards are UX only.

Public (no session):

- `/api/v1/health`, `/api/v1/health/live`, `/api/v1/health/ready`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/session` (reports anonymous or authenticated state)

Authenticated session required (401 without a valid cookie):

- `/api/v1/auth/me`, `/api/v1/auth/logout`, `/api/v1/auth/logout-all`
- `/api/v1/account/*`
- All domain read routes below

### Authorization matrix (enforced)

| Area | Required permission(s) | Enforced |
|---|---|---|
| Overview | Authenticated session (any role). Sections omit data the caller lacks `*.read` for. | Yes |
| Assets | `asset.read` | Yes |
| Risks | `risk.read`; treatment PATCH requires `risk.manage` + CSRF | Yes (read + treatment write) |
| Controls / governance | `control.read` (+ manage/update for writes later) | Yes (read) |
| Evidence | `evidence.read` (+ manage/download for writes later) | No dedicated list route yet |
| Vulnerabilities | `vulnerability.read` (+ manage for writes later) | Yes (read) |
| Alerts | `alert.read` | Yes |
| Detections | `detection.read` (+ manage for writes later) | No dedicated list route yet |
| Incidents | `incident.read` (+ manage/close for writes later) | Yes (read) |
| Threat intelligence | `threat_intel.read` | Yes |
| Reports | `report.read` (+ manage for writes later) | Yes (read) |
| Datasets / experiments | `dataset.read` (+ manage for writes later) | Yes (read) |
| Cyber range | `cyber_range.read` | Yes (read-only; no execution) |
| Administration summary/users/roles/access-reviews | `administration.read` | Yes |
| Administration integrations | `administration.read` **and** `integration.read` | Yes |
| Administration audit events | `administration.read` **and** `audit.read` | Yes |
| Administration writes / role assignment | `administration.manage`, `user.role.manage`, `integration.manage` | No (writes deferred; need CSRF) |
| Auth session/me | authenticated (`/me`); `/session` public | Yes |
| Account | authenticated; preferences PATCH + CSRF | Yes |
| Risk treatment PATCH | `risk.manage` + CSRF | Yes |

**401** = no valid session (missing, revoked, expired, or inactive user).  
**403** = missing permission (`forbidden`) or CSRF failure (`csrf_failed`). Error bodies do not list capability codes or tokens.

**Broader authenticated domain writes** (incidents, vulns, admin, integrations, reports, cyber-range control) remain deferred. No Cyber Range remote control.

## Audit behavior

Security-relevant actions write `audit_events` rows:

- `LOGIN_SUCCESS`
- `LOGIN_FAILURE`
- `LOGOUT`
- `LOGOUT_ALL`
- `PREFERENCES_UPDATE`
- `RISK_TREATMENT_UPDATE`

Metadata may include actor human id, action, object human id, and changed field names. Metadata must not include passwords, hashes, session/CSRF tokens, or digests.

## Development login setup

1. Copy `.env.example` to `.env`.
2. Set a strong local-only value: `AEGIS_DEV_ADMIN_PASSWORD=...`
3. Run migrations and seed: `alembic upgrade head` then `python -m app.db.seed`
4. Sign in as `amara.okonkwo@aegisbridge.example` (`USR-0001`, Administrator) with that password.

Never commit the real password. Production must not rely on this variable.

## Production hardening still required

- Login rate limiting / lockout (structure is ready; not implemented)
- Broader CSRF-protected domain writes beyond preferences + risk treatment
- MFA/TOTP
- Password reset email flows
- SSO/OIDC
- Hosted HTTPS + Secure cookies + HSTS
- Session fixation / concurrent session policy review
- Secrets rotation for `SESSION_SECRET`
