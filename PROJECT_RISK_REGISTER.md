# AegisBridge Project Risk Register

**Document version:** 1.0  
**Date:** October 20, 2026  
**Status:** Phase 0 baseline  
**Authority:** `MASTER_REQUIREMENTS.md` §152

Likelihood / Impact: Low | Medium | High | Critical  
Status: Open | Mitigating | Accepted | Closed

---

| ID | Risk | Owner | Likelihood | Impact | Mitigation | Status |
|---|---|---|---|---|---|---|
| R-01 | Scope creep across phases / full UI at once | Project owner | High | High | One approved phase at a time; stubs for non-active modules; Sign-in+Overview only after bootstrap | Open |
| R-02 | Insufficient Lenovo RAM (16 vs 32 GB) | Project owner | Medium | High | Verify hardware; staged VM profiles per master §25 | Open |
| R-03 | Disk exhaustion from Wazuh/PCAPs/VMs | Project owner | Medium | High | External SSD; gitignore large artifacts; retention policy | Open |
| R-04 | Apple Silicon / x86 compatibility | Project owner | Medium | Medium | Multi-arch images; verify Py/Node pins on Mac | Open |
| R-05 | Dataset download size / licensing mistakes | Project owner | Medium | High | Manifests; Phase 8 gate; Smishing first; no bulk commit | Open |
| R-06 | Leaking credentials to Git | Project owner | Medium | Critical | `.env` gitignore; Gitleaks; `.env.example` only | Mitigating |
| R-07 | Exposing home lab publicly | Project owner | Low | Critical | Outbound-only lab bridge; never publish Wazuh/RDP/SSH | Open |
| R-08 | Over-collecting logs / noisy detections | Project owner | Medium | Medium | Use-case-driven telemetry; tune in detection phases | Open |
| R-09 | Framework version drift (ATT&CK etc.) | Project owner | Medium | Medium | Pin versions in `VERSIONS.md`; manual ATT&CK updates | Open |
| R-10 | External API schema / rate-limit changes | Project owner | Medium | Medium | Clients with backoff; fixtures in CI; integration_health | Open |
| R-11 | Hosted free-tier / cost limitations | Project owner | Medium | Medium | Smallest practical Render/R2; cost review at Phase 10 | Open |
| R-12 | Evidence containing sensitive data | Project owner | Medium | High | Sanitization rules; demo mode; hash+metadata discipline | Open |
| R-13 | Dependency vulnerabilities | Project owner | High | Medium | Lockfiles; Trivy/OSV; SBOM; minimize deps | Open |
| R-14 | AI-generated code not understood by maintainer | Project owner | Medium | High | Review every change; tests; stop at phase gates | Open |
| R-15 | Python 3.14 / React 19.3 / Vite 8 ecosystem gaps | Project owner | Medium | High | Verify at Phase 1 install; ADR if fallback needed | Open |
| R-16 | Auth UX mismatch (Figma SSO/Explore vs local accounts) | Project owner | High | Medium | Record discrepancy; Phase 2 local auth; no production bypass | Open |
| R-17 | Phase 0 doc debt beyond minimal gate | Project owner | Low | Low | Optional docs before relevant phases (lab, datasets, frameworks) | Accepted |
| R-18 | Treating frontend fixtures as operational truth | Project owner | Medium | High | Label simulated data; no hardcoded “healthy” zeros | Open |

---

## Review Cadence

Update this register at each phase gate and when a new material risk appears.
