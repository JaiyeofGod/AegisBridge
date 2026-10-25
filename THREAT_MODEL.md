# AegisBridge Threat Model

**Document version:** 1.0  
**Date:** October 20, 2026  
**Status:** Phase 0 baseline (living document)  
**Method aid:** STRIDE where helpful  
**Authority:** `MASTER_REQUIREMENTS.md` §108

---

## 1. Scope

In scope: AegisBridge web UI, API, workers, PostgreSQL, object storage, CI/CD, hosted Render deployment, outbound lab bridge, and integrations with public intelligence APIs.

Out of scope for this document’s deep detail: full cyber-range host hardening (tracked in lab docs later), but lab exposure to the internet is explicitly in scope as a critical risk.

---

## 2. Assets

| Asset | Sensitivity |
|---|---|
| User credentials and sessions | High |
| RBAC configuration | High |
| Evidence objects and hashes | High |
| Integration credentials (R2, NVD, lab bridge) | Critical |
| Vulnerability / risk / incident records | Medium–High |
| Synthetic demo data | Low (still integrity-sensitive) |
| Audit log integrity | High |
| Build pipeline and lockfiles | High |

---

## 3. Trust Boundaries

```text
Public browser  <->  Frontend (static)
Frontend        <->  API (REST/JSON)
API             <->  PostgreSQL
API / worker    <->  Object storage (SeaweedFS S3 local / R2 hosted)
Worker          <->  External intelligence APIs
API (on demand) <->  NVD CVE 2.0, CISA KEV JSON, FIRST EPSS
Worker (daily)  <->  Valkey broker. JSON task name only; no credentials or source URLs
Worker (daily)  <->  NVD per tracked CVE, one CISA KEV catalog, batched FIRST EPSS
API (manual)    <->  Pinned MITRE ATT&CK Enterprise STIX 2.1 release 20.0. No caller-supplied URL.
Lab bridge      <->  Hosted API (/api/v1/lab-sync)
Lab bridge      <->  Local Wazuh API
```

---

## 4. Actors

| Actor | Intent |
|---|---|
| Anonymous internet user | Probe demo / attack hosted surface |
| Authenticated user (any role) | Legitimate use; possible privilege abuse |
| Malicious insider / stolen session | Escalate, exfiltrate evidence |
| Compromised dependency / CI | Supply-chain implant |
| Lab attacker (ATTACK zone) | Should not reach MGMT/Wazuh admin by default |
| External intel source | Availability/integrity issues; poisoned data |

---

## 5. STRIDE Summary

| Boundary | Spoofing | Tampering | Repudiation | Info disclosure | DoS | Elevation |
|---|---|---|---|---|---|---|
| Browser ↔ Frontend | XSS / fake UI | Client-only checks | Weak client logs | Sensitive data in JS bundles | Resource abuse | N/A (client) |
| Frontend ↔ API | Session theft, CSRF | Request tampering | Missing audit | Verbose errors, IDOR | Auth flooding | Broken RBAC |
| API ↔ DB | Stolen DB creds | SQL injection / mass assignment | Missing audit | Over-fetch | Query bombs | Role table abuse |
| API/worker ↔ R2 | Stolen keys | Object overwrite | Weak object audit | Public bucket misconfig | Large uploads | Presign misuse |
| Worker ↔ intel | Fake sources | Poisoned CVE/IOC data | — | Key leakage in logs | Rate-limit exhaustion | — |
| Worker ↔ Wazuh indexer | Stolen basic auth | Poisoned alert text | — | Credential in logs or rows | Oversized search responses | Indexer URL redirected by a caller |
| API ↔ Hugging Face datasets | Stolen `HF_TOKEN` | Poisoned Parquet or labels | — | Token or raw rows in the API | Oversized dataset download or HTML column pull | Caller-supplied download URL or derivation recipe |
| Lab bridge ↔ API | Replay / stolen token | Mutated sync payloads | Weak sync audit | Raw log leakage | Sync floods | Over-privileged sync |
| Lab bridge ↔ Wazuh | Stolen Wazuh JWT | Rule/config abuse | — | Full event exfil | API abuse | Admin API exposure |

---

## 6. Priority Threats and Mitigations

| ID | Threat | Mitigation |
|---|---|---|
| T-01 | Credential theft / session hijack | Argon2id, HTTP-only Secure cookies, short sessions, HTTPS, rate limits |
| T-02 | Broken access control / IDOR | Server RBAC on every sensitive route; authz tests |
| T-03 | Injection | Pydantic validation, ORM parameterization |
| T-04 | Malicious uploads | Type/size checks, hashing, object-store isolation, later scanning |
| T-05 | SSRF via integrations | Allowlisted endpoints, no user-controlled raw URLs to internal nets |
| T-06 | Secret leakage | `.env` gitignore, Gitleaks, no secrets in images/logs |
| T-07 | CSRF | SameSite + CSRF tokens for cookie sessions |
| T-08 | XSS | React defaults, CSP later, sanitize rich text if introduced |
| T-09 | Dependency compromise | Lockfiles, Trivy/OSV, SBOM, minimize deps |
| T-10 | Poisoned intelligence | Schema validation, provenance, human review for critical decisions |
| T-11 | Replayed lab-sync | Timestamp + replay resistance + dedicated credential + TLS |
| T-12 | Audit tampering | Append-oriented events; restrict DB roles later |
| T-13 | Object-storage ACL mistakes | Private buckets, presigned URLs, least-privilege keys |
| T-14 | Exposing home lab publicly | Outbound-only bridge; no public Wazuh/RDP/SSH |
| T-15 | Demo auth bypass | No production bypass; Demo Mode rules for synthetic data |

---

## 7. Assumptions

- Mac developer machine is trusted relative to production
- Lenovo lab network is private. The specified Wazuh stack binds to loopback and is not installed yet. No inbound path from the hosted app into the lab exists
- Render and Cloudflare provide baseline platform controls
- Public demo uses only synthetic data

---

## 8. External vulnerability feeds

NVD, CISA KEV, and FIRST EPSS are untrusted inputs. The API calls only the configured URLs. A failed catalog fetch must not clear KEV membership. A high EPSS value does not change `action_decision`. Audit metadata for `VULNERABILITY_INTELLIGENCE_REFRESH` records the CVE and source status only: no API key, no response body, and no request headers.

ThreatFox and URLhaus are also untrusted inputs. The worker calls only `https://threatfox-api.abuse.ch/api/v1/` and `https://urlhaus-api.abuse.ch/v1/urls/recent/`. A feed record can contain script-like text, odd URL queries, or malformed values. Invalid indicators are skipped. Stored text is not executable content. Presence in either feed does not mean an asset is compromised, a vulnerability was exploited, or a control fired. There is no automatic block, firewall change, incident, or IOC score. A source failure leaves the previous rows in place. The Auth-Key is not logged. The IOC lock is separate from the vulnerability-intelligence lock.

Future work, not this slice: indicator provenance in the UI, a source-health dashboard, an expiry policy, correlation with assets or alerts, Wazuh enrichment, Sigma relationships, VirusTotal, MISP/TAXII, analyst allowlists and blocklists, notification rules, and automated containment.

## 9. Open Threat-Model Work

- Deep-dive data-flow diagrams for evidence download and lab-sync (Phase 2 / Phase 15)
- Formal abuse cases per role after RBAC lands
- Update after first Render staging deploy
