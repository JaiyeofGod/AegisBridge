# Authentication and RBAC

**Status:** Backend authentication, domain read authorization, **CSRF-protected authenticated writes** (preferences, risk treatment, risk↔control link/unlink, incident update, incident response tasks, vulnerability remediation, administration access reviews/users/roles, governance control implementation/tests, evidence metadata + control linking, policy lifecycle + policy↔control mapping), and session CSRF foundation are in place. Frontend route guards remain UX only. SSO/OIDC, MFA, email reset, rate limiting, and remaining domain writes (integrations, reports, cyber-range control) remain deferred.

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
| POST/DELETE | `/risks/{risk_id}/controls/{control_id}` | Authenticated + `risk.manage` + CSRF |
| PATCH | `/incidents/{incident_id}` | Authenticated + `incident.manage` + CSRF (`incident.close` when closing) |
| GET | `/incidents/{incident_id}/tasks` | Authenticated + `incident.read` |
| POST | `/incidents/{incident_id}/tasks` | Authenticated + `incident.manage` + CSRF |
| GET | `/incidents/{incident_id}/tasks/{task_id}` | Authenticated + `incident.read` |
| PATCH | `/incidents/{incident_id}/tasks/{task_id}` | Authenticated + `incident.manage` + CSRF |
| PATCH | `/vulnerabilities/{vulnerability_id}/remediation` | Authenticated + `vulnerability.manage` + CSRF |
| PATCH | `/governance/controls/{control_id}/implementation` | Authenticated + `control.manage` + CSRF |
| POST | `/governance/controls/{control_id}/tests` | Authenticated + `control.manage` + CSRF |
| PATCH | `/governance/control-tests/{test_id}` | Authenticated + `control.manage` + CSRF |
| POST | `/evidence` | Authenticated + `evidence.manage` + CSRF (metadata only) |
| POST | `/evidence/{evidence_id}/object` | Authenticated + `evidence.manage` + CSRF (multipart file upload) |
| DELETE | `/evidence/{evidence_id}/object` | Authenticated + `evidence.manage` + CSRF |
| GET | `/evidence/{evidence_id}/object` | Authenticated + `evidence.read` (no CSRF; private stream) |
| POST | `/governance/controls/{control_id}/evidence/{evidence_id}` | Authenticated + `control.manage` + `evidence.manage` + CSRF |
| DELETE | `/governance/controls/{control_id}/evidence/{evidence_id}` | Authenticated + `control.manage` + `evidence.manage` + CSRF |

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
- Development password for `USR-0001` is an Argon2id hash of `AEGIS_DEV_ADMIN_PASSWORD`. There is no built-in default.
- `APP_ENV` `local` / `development` / `dev`: seed requires that variable and rewrites the existing credential so it matches. Blank or missing fails the seed and does not invent a password.
- `APP_ENV=test`: seed updates the hash only when the variable is set, and only on `TEST_DATABASE_URL`. Pytest does not open the development database.
- `APP_ENV=production`: seed does not read or write the development Administrator password.
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

`risk.accept`, `control.update`, `evidence.download`, `incident.close`, `integration.manage`, `user.role.manage`, `detection.manage`, `policy.approve`

plus domain `.read` / `.manage` capabilities enforced on current routes (including `policy.read` / `policy.manage` and `directory.read`). There is no `directory.manage`.

Effective permissions for a principal are the **union** of permissions for their assigned roles from `ROLE_PERMISSIONS`. Stored `access_entitlements` remain labels aligned to the catalog; they are not a second policy engine.

### Role → permission mapping

| Role | Permissions |
|---|---|
| Administrator | All catalog permissions |
| CISO | Broad `*.read` across domains + `audit.read` + `policy.approve` (no draft `policy.manage`) |
| GRC Analyst | Risk/control/policy/evidence/report/dataset + `risk.accept`, `control.update`, `evidence.download`, `policy.manage`, `directory.read` |
| SOC Analyst | Alert/detection/incident/threat intel/policy reads + `incident.manage`, `incident.close`, `directory.read` |
| Security Engineer | Detection/vuln/integration/cyber-range/dataset/policy reads + `detection.manage`, `integration.manage`, `directory.read` |
| Auditor | Read-heavy GRC/policy/evidence/audit + `evidence.download` |
| Read Only | Limited reads (assets, risk, control, policy, vuln, alert, detection, incident, threat intel, report, dataset, cyber range) |

See `ROLE_PERMISSIONS` in code for the authoritative set.

`directory.read` is the operational identity-selection permission. It is granted to Administrator, GRC Analyst, SOC Analyst, and Security Engineer because those roles already assign an owner or assignee (`incident.manage`, `risk.manage` / `control.manage` / `policy.manage`, `vulnerability.manage` / `detection.manage`). CISO, Auditor, and Read Only do not assign operational owners, so they do not receive `directory.read`. Auditor still uses `administration.read` for account review. `directory.read` is not inferred from a role name on the route.

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
| Risks | `risk.read`; treatment PATCH and risk↔control link/unlink require `risk.manage` + CSRF. Mapped controls are visible with `risk.read`. Mapped risks on a control require `control.read`. | Yes (read + treatment write + mapping) |
| Controls / governance | `control.read`; implementation/tests require `control.manage` + CSRF; evidence link requires `control.manage` + `evidence.manage` + CSRF | Yes (read + control/evidence writes) |
| Evidence | `evidence.read`; metadata/object POST/DELETE require `evidence.manage` + CSRF; object GET requires `evidence.read` | Yes (metadata + private object upload/download/delete) |
| Vulnerabilities | `vulnerability.read`; remediation PATCH requires `vulnerability.manage` + CSRF | Yes (read + remediation write) |
| Alerts | `alert.read` | Yes |
| Detections | `detection.read` (+ manage for writes later) | No dedicated list route yet |
| Incidents | `incident.read`; incident PATCH and task create/update require `incident.manage` + CSRF; closing an incident also needs `incident.close`. Completing a task does not. | Yes (read + incident write + response tasks) |
| Operational directory | `directory.read`. Active same-organization users for assignee/owner selection. Not `administration.read`. | Yes (GET only) |
| Threat intelligence | `threat_intel.read` | Yes |
| Reports | `report.read` (+ manage for writes later) | Yes (read) |
| Datasets / experiments | `dataset.read` (+ manage for writes later) | Yes (read) |
| Cyber range | `cyber_range.read` | Yes (read-only; no execution) |
| Administration summary/users/roles/access-reviews | `administration.read` | Yes |
| Administration integrations | `administration.read` **and** `integration.read` | Yes |
| Administration audit events | `administration.read` **and** `audit.read` | Yes |
| Access-review / user-status writes | `administration.manage` + CSRF | Yes |
| User role assignment | `administration.manage` **and** `user.role.manage` + CSRF | Yes (Administrator only in matrix) |
| Integration credential / connection writes | `integration.manage` | No (deferred) |
| Auth session/me | authenticated (`/me`); `/session` public | Yes |
| Account | authenticated; preferences PATCH + CSRF | Yes |
| Risk treatment PATCH | `risk.manage` + CSRF | Yes |
| Risk↔control link/unlink | `risk.manage` + CSRF | Yes |
| Incident PATCH | `incident.manage` + CSRF (+ `incident.close` to resolve/close) | Yes |
| Incident task create/update | `incident.manage` + CSRF. `incident.close` is not required to complete a task. | Yes |
| Vulnerability remediation PATCH | `vulnerability.manage` + CSRF | Yes |
| Control implementation / tests | `control.manage` + CSRF | Yes |
| Evidence metadata create | `evidence.manage` + CSRF | Yes |
| Evidence object upload/delete | `evidence.manage` + CSRF | Yes (private S3-compatible storage) |
| Evidence object download | `evidence.read` | Yes (backend stream; no public URL) |
| Control ↔ evidence link/unlink | `control.manage` + `evidence.manage` + CSRF | Yes |
| Policy ↔ control link/unlink | `policy.manage` + CSRF | Yes (relationship-only; no control text) |

**401** = no valid session (missing, revoked, expired, or inactive user).  
**403** = missing permission (`forbidden`) or CSRF failure (`csrf_failed`). Error bodies do not list capability codes or tokens.  
**409** = stale `expected_updated_at` concurrency conflict.

**Policy lifecycle** (`policy.read` / `policy.manage` / `policy.approve` + CSRF on mutations): create/edit drafts, transition/publish, self-acknowledge published versions, link/unlink controls. Published versions are immutable; replacements create new drafts. External e-signature and email notification are not implemented.

**Remaining authenticated domain writes** (integration credentials, reports, cyber-range control, access-review findings) remain deferred. No Cyber Range remote control. Automated containment, host isolation, and SOAR are not implemented.

### Incident mutation scope (`incident.manage`)

Writable: `title`, `severity`, `status`, `summary`, `owner` (user human id).  
Not writable: `containment_state` (no column), related alerts/assets.  
Closing (`resolved` / `closed`) additionally requires `incident.close`.

### Incident response tasks (`incident.manage`)

Public id: `TASK-NNNN`, server-assigned. Writable: `title`, `status` (`open`, `in_progress`, `blocked`, `completed`, `cancelled`), `assignee` (user human id in the same organization, active).  
`completed_at` is written only by the server when status becomes `completed`, and cleared if the task leaves `completed`. `cancelled` does not set `completed_at`.  
Not writable: task human id, internal UUID, `completed_at`, incident severity/status, priority, due date.  
Hard deletion is deferred so investigation history stays. Task completion does not resolve, close, or otherwise change the incident. Automated containment and SOAR are unsupported.

### Vulnerability remediation scope (`vulnerability.manage`)

Writable on the latest `RemediationTask` for a selected asset finding: `status`, `title`, `due_on`, `owner`.  
Immutable: CVSS, EPSS, KEV, CVE metadata, asset criticality/exposure, SSVC `action_decision` / rationale.

### Administration mutation scope

**Access reviews** (`administration.manage` + CSRF): writable `name`, `status`. Not stored / not writable: owner, due date, notes. Finding PATCH deferred — `access_review_findings` have no public human id.

**User status** (`administration.manage` + CSRF): writable `status` ∈ `{active, inactive}` only (matches auth: non-`active` cannot authenticate). Not writable: email, password/credentials, human id, internal UUID, permissions.

**User roles** (`administration.manage` **and** `user.role.manage` + CSRF): replace with names from the seven-role catalog only. No client-created roles, no direct permission assignment. Only **Administrator** holds both permissions in the matrix; Security Engineer cannot assign roles (including Administrator).

**Self-admin / lockout safeguards:** refusing to set the last active Administrator to `inactive`, and refusing to remove the Administrator role from that account (`409`). Organization-wide quorum is not implemented. Multi-admin disable of a non-last Administrator is allowed (including self-disable when another active Administrator exists).

**Still disabled:** integration credential/connection writes, role definition create/delete, permission catalog mutation, audit-event mutation, user deletion, password reset/change, MFA/SSO.

### Governance / evidence mutation scope

**Control implementation** (`control.manage` + CSRF): writable `status` ∈ `{planned, partial, implemented, not_implemented, not_applicable}`, `notes`, `owner` (user human id). Optimistic concurrency via `expected_updated_at` → `409`. Licensed CIS safeguard text is never accepted or returned.

**Control tests** (`control.manage` + CSRF): create/update manual records only (`result` ∈ `{pass, fail, partial, inconclusive}`, optional `tested_at`, `tester`, `notes`). Public ids are `CTEST-NNNN`. Notes are tagged `[manual development recording]`. Not automated assessment or continuous monitoring.

**Evidence metadata** (`evidence.manage` + CSRF): create title/description/version/optional caller-supplied SHA-256 (exactly 64 hex, normalized lowercase)/size/mime/classification/collected_at/collected_by. `object_uri` is never returned. Caller-supplied SHA-256 before upload is not verification.

**Evidence object upload** (`evidence.manage` + CSRF): `POST /evidence/{id}/object` multipart field `file`. One object per evidence record (second upload → `409`). Server generates object keys (`evidence/{EVID-NNNN}/{random}`), streams through a temp spool, enforces `EVIDENCE_MAX_UPLOAD_BYTES` (default 25 MiB), calculates SHA-256 from bytes, and stores privately via the S3-compatible abstraction (SeaweedFS locally / R2 hosted). Malware scanning is **not** implemented. `object_stored=true` after success; `integrity_verified` stays false (hash is calculated at ingestion, not independently re-verified).

**Evidence object download** (`evidence.read`): `GET /evidence/{id}/object` streams bytes through the API with `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`. No public URLs, no client redirects to S3, no credential leakage.

**Evidence object delete** (`evidence.manage` + CSRF): removes storage bytes and the `evidence_objects` row; preserves the evidence metadata record. PostgreSQL and S3 are not a distributed transaction (storage deleted first).

**Control ↔ evidence linking** (`control.manage` + `evidence.manage` + CSRF): link or unlink existing records by human ids. Duplicate links are idempotent (`linked: true`).

**Policy ↔ control linking** (`policy.manage` + CSRF): `POST`/`DELETE /policies/{policy_id}/controls/{control_id}` by human ids. Stores relationship only in `policy_control_mappings` (no control title/text duplication, no licensed CIS prose). Duplicate links are idempotent (`linked: true`). Missing unlink → `404` (same convention as evidence unlink). Unlink does not delete policy, control, evidence, or tests.

## Audit behavior

Security-relevant actions write `audit_events` rows:

- `LOGIN_SUCCESS`
- `LOGIN_FAILURE`
- `LOGOUT`
- `LOGOUT_ALL`
- `PREFERENCES_UPDATE`
- `RISK_TREATMENT_UPDATE`
- `INCIDENT_UPDATE`
- `VULNERABILITY_REMEDIATION_UPDATE`
- `ACCESS_REVIEW_UPDATE`
- `USER_STATUS_UPDATE`
- `USER_ROLE_UPDATE`
- `CONTROL_IMPLEMENTATION_UPDATE`
- `CONTROL_TEST_CREATE`
- `CONTROL_TEST_UPDATE`
- `EVIDENCE_CREATE`
- `EVIDENCE_OBJECT_UPLOAD`
- `EVIDENCE_OBJECT_DOWNLOAD`
- `EVIDENCE_OBJECT_DELETE`
- `CONTROL_EVIDENCE_LINK`
- `CONTROL_EVIDENCE_UNLINK`
- `POLICY_CONTROL_LINK`
- `POLICY_CONTROL_UNLINK`

Metadata may include actor human id, target human id, action, object human id, changed field names, and safe old/new status or role names. Privileged role changes note whether Administrator remains assigned. Metadata must not include passwords, hashes, session/CSRF tokens, or digests.

## Development login setup

The API loads `AegisBridge/.env` from the repository root. `python -m app.db.seed` uses that same settings object.

1. Copy `.env.example` to `.env` at the repository root.
2. Set `AEGIS_DEV_ADMIN_PASSWORD` to a local-only value. Do not commit it. There is no default.
3. Start PostgreSQL.
4. From `apps/api`, with the API virtualenv active, run migrations if needed (`alembic upgrade head` from the repo root) and then `python -m app.db.seed`.
5. Start FastAPI.
6. Sign in as `amara.okonkwo@aegisbridge.example` (`USR-0001`, Administrator) using the password from the environment.

Changing `AEGIS_DEV_ADMIN_PASSWORD` does nothing to the database until the seed command is run again. `python -m app.db.seed --check` reports match/mismatch without printing the password or hash.

Never commit the real password. Production must not rely on this variable.

## Production hardening still required

- Login rate limiting / lockout (structure is ready; not implemented)
- Remaining CSRF-protected domain writes (integrations, reports, cyber-range)
- MFA/TOTP
- Password reset email flows
- SSO/OIDC
- Hosted HTTPS + Secure cookies + HSTS
- Session fixation / concurrent session policy review
- Secrets rotation for `SESSION_SECRET`
