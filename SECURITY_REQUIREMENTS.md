# AegisBridge Security Requirements

**Document version:** 1.1  
**Date:** October 20, 2026  
**Status:** Phase 2 authentication foundation in progress  
**Baselines:** OWASP ASVS 5.0.0 (meaningful Level 2 subset), OWASP Top 10:2025, NIST SSDF SP 800-218 v1.1  
**Implementation detail:** `docs/security/AUTHENTICATION_AND_RBAC.md`

---

## 1. Goals

Protect the AegisBridge application, its data, secrets, evidence objects, and integrations. Security of the platform itself is part of the portfolio demonstration.

Visual mockups never weaken authentication, authorization, or data-handling requirements.

---

## 2. Authentication

**Initial (Phase 2) — backend foundation implemented**

- Local accounts only (no public self-registration in primary portfolio deployment)
- Argon2id password hashing (`argon2-cffi`)
- Server-side sessions: opaque cookie token, SHA-256 digest stored only
- HTTP-only cookies; Secure flag outside local/dev/test; SameSite=Lax default
- Session expiration and revocation
- Login success/failure (and logout) audit events
- Auth + Account APIs; reusable RBAC dependencies

**Still required before production**

- CSRF defense for authenticated write APIs (SameSite+proxy mitigates some cases; write CSRF not complete)
- Login rate limiting / lockout
- Broader CSRF-protected domain writes beyond preferences + risk treatment; MFA; SSO; login rate limiting (CSRF foundation + first write slice implemented)

**Later**

- TOTP MFA
- Optional OIDC/OAuth
- Password-reset email flows

**UI note:** Figma Organization SSO and Explore demo are design concepts. Implement auth per this document. Do not create a production authentication bypass to reproduce prototype navigation. Demo Mode (§33 master) uses seeded synthetic data with clear labeling. Frontend sign-in wiring is a separate slice.

---

## 3. Authorization

- Backend-enforced RBAC; permissions evaluated on the server
- Frontend route/nav hiding is convenience only
- Sensitive actions require dedicated permissions (e.g. `risk.accept`, `control.update`, `evidence.download`, `incident.close`, `integration.manage`, `user.role.manage`)
- Display IDs are not access-control boundaries
- Lab bridge uses dedicated machine credentials — never human admin passwords

---

## 4. Roles

Administrator, CISO, GRC Analyst, SOC Analyst, Security Engineer, Auditor, Read Only — as defined in master §6.

---

## 5. Session and Transport Security

- HTTPS only in hosted environments; HSTS after stable HTTPS
- Restrictive CORS (explicit origin allowlist)
- No mixed content
- Secure cookie attributes in staging/production

---

## 6. Input Validation and API Security

- Validate and sanitize inputs at API boundary (Pydantic)
- Treat threat-feed fields as untrusted text. Do not render them as HTML. Reject indicators that are not a valid IP, domain, hostname, URL, or exact-length hash
- Parameterized queries via SQLAlchemy
- Consistent error handling without leaking secrets
- Rate limiting on auth and sensitive endpoints
- OpenAPI as contract documentation

---

## 7. File / Evidence Handling

- Authz before upload/download
- Filename normalization, size limits, MIME/extension checks
- SHA-256 content hash stored with metadata
- Objects in SeaweedFS (local S3) / R2 (hosted); not arbitrary local static paths
- Optional malware/static scan later
- Audit upload and download events

---

## 8. Cryptography

- TLS in transit for hosted app and APIs
- Managed encryption at rest for Postgres and object storage where provided
- No custom cryptography
- Argon2id for passwords

---

## 9. Secrets Management

**Never commit:** database passwords, NVD API keys, abuse.ch Auth-Keys, Wazuh credentials, session secrets, R2 keys, GitHub tokens, lab-bridge credentials, SSH private keys.

`NVD_API_KEY` is optional. When it is unset, NVD calls stay unauthenticated. The key is sent only as the NVD `apiKey` header. It is not written to audit events, API responses, logs, Celery task arguments, or broker messages. The scheduled task takes no arguments. Callers cannot supply NVD, CISA KEV, FIRST EPSS, or ATT&CK source URLs; those endpoints come from server settings. The ATT&CK bundle is public STIX. Its SHA-256 is calculated at ingestion and is not an upstream signature check. Celery accepts JSON only. Pickle is disabled. Synchronization status is a PostgreSQL run row, not a Celery result and not a human audit actor.

`ABUSECH_AUTH_KEY` is optional and is the community key from auth.abuse.ch. It is sent only as the `Auth-Key` header to the two allowlisted HTTPS endpoints. It is not placed in a URL, a task argument, a log line, or an API response. If it is unset, both IOC sources fail closed and no unofficial mirror is used. ThreatFox and URLhaus bodies are untrusted: values are length-bounded, types are a closed set, tags are capped, and one malformed item does not fail the rest of that source. Callers cannot choose the feed URL.

`WAZUH_PASSWORD` is optional and is sent only as HTTP Basic authentication to the server-configured indexer URL. It is not stored in PostgreSQL, task arguments, logs, or API responses. Callers cannot choose the indexer URL. TLS verification defaults to on. Setting `WAZUH_VERIFY_TLS=false` disables verification only when `APP_ENV` is not production; that opt-in accepts a machine-in-the-middle risk on a local indexer and must not be used for a reachable network. Wazuh alert text is untrusted: strings are length-bounded, control characters are stripped, and the text is stored as text. Event paths are not opened and event strings are not executed. A failed poll leaves previously stored alerts in place.

Local: `.env` (gitignored) + committed `.env.example`  
Hosted: Render env groups / secrets; separate per environment

CI: Gitleaks secret scanning

---

## 10. Audit Logging

Append-oriented audit events for security-sensitive actions, including at minimum:

`LOGIN_SUCCESS`, `LOGIN_FAILURE`, `ROLE_CHANGED`, `RISK_ACCEPTED`, `CONTROL_STATUS_CHANGED`, `EVIDENCE_UPLOADED`, `EVIDENCE_DOWNLOADED`, `VULNERABILITY_EXCEPTION_CREATED`, `INCIDENT_CLOSED`, `POLICY_UPDATED`, `INTEGRATION_CREDENTIAL_ROTATED`

Fields: timestamp, actor, source_ip, action, object_type, object_id, result, metadata, correlation_id

---

## 11. Privacy and Demo Sanitization

Public/portfolio deployment:

- Fictional or clearly synthetic identities
- No personal medical/financial/student records
- No real company confidential data
- No raw credentials or private email exports
- No personally identifying security logs in public demo
- Obvious synthetic-organization labeling

---

## 12. Secure Development and Supply Chain

- Lockfiles (pnpm, uv)
- CI: lint, tests, typecheck, Gitleaks, Semgrep, Trivy, CycloneDX SBOM
- Dependency upgrades: tests; ADR if architectural; security review for breaking changes
- Do not install packages “just in case”
- Cursor rules in master §120 apply (no fabricated evidence/alerts/scans; label synthetic data)

---

## 13. Lab and Offensive Boundaries

- No offensive activity against systems not owned/authorized
- No automatic malware download/execution
- No exposing lab management ports to the public internet
- Authorized validation only inside the cyber range / Kali role

---

## 14. Application Security Assessment

Phase 20 targets a meaningful ASVS Level 2 subset assessment of AegisBridge itself, plus OWASP Top 10:2025 review. Optional controlled ZAP DAST later.
