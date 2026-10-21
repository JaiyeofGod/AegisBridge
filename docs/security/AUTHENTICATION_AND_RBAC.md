# Authentication and RBAC

**Status:** Backend foundation (Phase 2). Frontend wiring, SSO/OIDC, MFA, email reset, and global route enforcement are deferred.

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

## CSRF strategy (current limitation)

- GET endpoints remain safe/read-only.
- `POST /auth/login` is not cookie-authenticated beforehand (credentials in body).
- `POST /auth/logout` and `POST /auth/logout-all` are cookie-authenticated state changes. With same-site Vite proxy + `SameSite=Lax`, classic cross-site POSTs do not include the session cookie, which limits CSRF risk in the preferred local/same-site deployment.
- Cross-origin credentialed SPAs (different site than the API) and future authenticated **domain write** endpoints are **not** covered by a CSRF token scheme yet.
- **Do not introduce additional authenticated state-changing application endpoints until the selected CSRF defense is implemented.** Do not claim write CSRF coverage is complete.

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

plus domain `.read` / `.manage` capabilities used for upcoming enforcement.

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
| GET | `/api/v1/account/workspace` |

Preferences return explicit **defaults** with `persistence: not_stored` (no preference table in this phase). MFA is `not_configured`.

## Current API enforcement

**Existing domain read APIs remain unauthenticated** so the current frontend continues to work until sign-in wiring lands.

Protected now:

- `/api/v1/auth/me`, `/api/v1/auth/logout-all`
- `/api/v1/account/*`

### Authorization matrix (next enforcement phase)

| Area | Intended permission(s) | Enforced now |
|---|---|---|
| Overview | authenticated (any role) | No |
| Assets | `asset.read` | No |
| Risks | `risk.read` (+ `risk.accept` / `risk.manage` for writes later) | No |
| Controls / governance | `control.read` (+ manage/update for writes) | No |
| Evidence | `evidence.read` (+ manage/download for writes) | No |
| Vulnerabilities | `vulnerability.read` (+ manage for writes) | No |
| Alerts | `alert.read` | No |
| Detections | `detection.read` (+ manage for writes) | No |
| Incidents | `incident.read` (+ manage/close for writes) | No |
| Threat intelligence | `threat_intel.read` | No |
| Reports | `report.read` (+ manage for writes) | No |
| Datasets / experiments | `dataset.read` (+ manage for writes) | No |
| Cyber range | `cyber_range.read` | No |
| Administration reads | `administration.read` / `audit.read` / `integration.read` | No |
| Administration writes / role assignment | `administration.manage`, `user.role.manage`, `integration.manage` | No |
| Auth session/me | authenticated | Yes (`/me`) |
| Account | authenticated | Yes |

## Audit behavior

Security-relevant auth actions write `audit_events` rows:

- `LOGIN_SUCCESS`
- `LOGIN_FAILURE`
- `LOGOUT`
- `LOGOUT_ALL`

Metadata must not include passwords, hashes, tokens, or digests.

## Development login setup

1. Copy `.env.example` to `.env`.
2. Set a strong local-only value: `AEGIS_DEV_ADMIN_PASSWORD=...`
3. Run migrations and seed: `alembic upgrade head` then `python -m app.db.seed`
4. Sign in as `amara.okonkwo@aegisbridge.example` (`USR-0001`, Administrator) with that password.

Never commit the real password. Production must not rely on this variable.

## Production hardening still required

- Login rate limiting / lockout (structure is ready; not implemented)
- CSRF tokens for authenticated writes
- MFA/TOTP
- Password reset email flows
- SSO/OIDC
- Enforce the authorization matrix on domain routes
- Hosted HTTPS + Secure cookies + HSTS
- Session fixation / concurrent session policy review
- Secrets rotation for `SESSION_SECRET`
