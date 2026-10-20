# AegisBridge Roadmap

**Document version:** 1.0  
**Date:** October 20, 2026  
**Status:** Phase 0 baseline  
**Authority:** `MASTER_REQUIREMENTS.md` Part XV

---

## Phase Overview

| Phase | Name | Exit gate (summary) |
|---:|---|---|
| 0 | Requirements freeze | Contradictions documented; architecture approved |
| 1 | Repository bootstrap | Local services start cleanly on Mac |
| 2 | Authentication and RBAC | Authz tests prove role separation |
| 3 | Organization and assets | Synthetic inventory end-to-end |
| 4 | Risk management | ≥20 synthetic risks tracked |
| 5 | Framework and control engine | Risk → control → test → evidence traceability |
| 6 | Policy and IAM | Formal access-review report |
| 7 | Vulnerability intelligence | One CVE enriched end-to-end with provenance |
| 8 | Dataset registry | Provenance/licensing visible; Smishing IMC25 first |
| 9 | Local hosting parity | Local matches hosted boundaries closely enough |
| 10 | Public hosting foundation | Staging health, migrations, basic auth tests |
| 11 | Cyber range foundation | Segmentation; agents reach Wazuh |
| 12 | Endpoint telemetry | Use-case telemetry collected |
| 13 | Network detection | Suricata useful detections |
| 14 | Detection engineering | ATT&CK-mapped detections validated |
| 15 | Lab bridge | Outbound sync to hosted API |
| 16 | Vulnerability management | SSVC + remediation cases |
| 17 | Incident response | Complete investigations |
| 18 | Research analytics | Experiments with registry datasets |
| 19 | DevSecOps | Pipeline + findings in platform |
| 20 | Application security assessment | ASVS subset assessment |
| 21 | Recovery and resilience | Tested recovery procedure |
| 22 | Production portfolio deployment | Public demo ready |
| 23 | Advanced DFIR | Optional Velociraptor |
| 24 | Advanced identity / directory | Optional AD/Samba |

---

## Near-Term Sequence (Approved)

1. **Phase 0 (current)** — Minimal gate documents + ADRs + risk register  
2. **Phase 1** — Monorepo bootstrap, Compose infra, host-run API/web skeletons, Celery foundation, CI, health  
3. **Post-bootstrap frontend sprint** — Actual Figma **Sign-in** (`/signin`) and **Overview** (`/overview`)  
4. **Phase 2** — Real authentication and RBAC  

Work one approved phase at a time. Do not build all modules at once.

---

## Frontend Notes

- Design source: https://www.figma.com/design/iDkPVAlMAdCokcvecFF8vC/AegisBridge-%E2%80%94-Product-Design  
- After bootstrap, Sign-in and Overview are real screens, not permanent placeholders  
- Remaining modules follow phase order with stubs until authorized  
- Spline 3D after static Sign-in artwork; respect reduced motion and fallbacks  

---

## Explicit Non-Goals (ongoing)

No second SIEM, no malware execution platform, no full scanner from scratch, no enterprise IAM provider replacement, no unlicensed framework republishing, no offensive activity outside authorized lab.
