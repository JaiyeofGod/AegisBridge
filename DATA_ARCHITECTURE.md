# AegisBridge Data Architecture

**Document version:** 1.0  
**Date:** October 20, 2026  
**Status:** Phase 0 baseline  
**Authority:** `MASTER_REQUIREMENTS.md` Part VII

---

## 1. Principles

1. **PostgreSQL 18** is the authoritative relational store for security-program data.
2. **Wazuh** is authoritative for raw security telemetry; AegisBridge stores summaries, findings, state, references, and selected normalized snapshots.
3. **Object storage** (SeaweedFS S3 locally / R2 hosted) holds unstructured evidence and reports; metadata and hashes live in PostgreSQL.
4. **Research datasets** are separate from operational application data; large raw files are not committed to Git.
5. UUID primary keys internally; human-readable display IDs (`AST-0001`, `RISK-0001`, …) are never authorization boundaries.
6. Metrics are derived from stored records — never hardcoded dashboard values.

---

## 2. Data Categories

| Category | Examples | Store |
|---|---|---|
| A. Operational application data | Assets, risks, controls, incidents, users | PostgreSQL |
| B. Live intelligence | NVD, KEV, EPSS, ATT&CK, OSV snapshots | PostgreSQL (+ provenance) |
| C. Cyber-range telemetry | Sysmon, Windows Security, Suricata, Wazuh events | Wazuh / lab; summaries in Aegis |
| D. Research datasets | Smishing IMC25, CIC subsets | Local/registry; manifests in Git |

---

## 3. Core Relational Domains

### Organization
`organizations`, `departments`, `business_processes`

### Identity and authorization
`users`, `roles`, `permissions`, `user_roles`, `sessions`, `api_credentials`, `access_entitlements`, `access_reviews`, `access_review_findings`

### Assets
`assets`, `asset_types`, `asset_owners`, `software_products`, `asset_software`, `data_assets`, `asset_data_relationships`

### Risks
`risks`, `risk_assessments`, `risk_treatments`, `risk_reviews`

### Frameworks and controls
`frameworks`, `framework_versions`, `controls`, `control_mappings`, `control_implementations`, `control_tests`, `control_findings`

### Evidence
`evidence`, `evidence_objects`, `evidence_control_links`, `evidence_risk_links`, `evidence_incident_links`

### Vulnerabilities
`vulnerabilities`, `cve_records`, `asset_vulnerabilities`, `epss_snapshots`, `kev_records`, `ssvc_assessments`, `remediation_tasks`, `vulnerability_exceptions`

### Detection and ATT&CK
`detections`, `detection_versions`, `attack_techniques`, `detection_attack_mappings`, `validation_runs`

### SOC
`alert_references`, `investigations`, `investigation_notes`

### Incident response
`incidents`, `incident_events`, `incident_tasks`, `incident_indicators`, `incident_evidence`

### Policy
`policies`, `policy_versions`, `policy_approvals`, `policy_acknowledgements`

### Vendors
`vendors`, `vendor_services`, `vendor_assessments`, `vendor_findings`

### Research
`datasets`, `dataset_versions`, `dataset_files`, `dataset_experiments`

### Integrations
`integrations`, `sync_jobs`, `sync_states`, `integration_health`

### Audit
`audit_events` (append-oriented)

---

## 4. Display ID Conventions

```text
AST-0001  RISK-0001  CTRL-0001  EVID-0001
VULN-0001 DET-0001   INC-0001   POL-0001
VEN-0001  DS-0001
```

---

## 5. Asset and Risk Minimums

Assets require inventory fields defined in master §51 (hostname, type, criticality, classification, exposure, lifecycle, control statuses, last_seen, etc.).

Risks use internal Likelihood × Impact methodology (not a NIST-mandated formula), with treatment: Accept / Avoid / Mitigate / Transfer. Seed ~20 clearly labeled synthetic risks in later phases.

---

## 6. Vulnerability Prioritization Data

Preserve distinct dimensions — do not invent a single composite score by summing CVSS + EPSS + business points:

- CVSS, EPSS, CISA KEV, asset criticality, external exposure, mitigating controls, SSVC decision
- KEV is a separate fact
- SSVC is the primary remediation decision framework, plus internal SLA policy

---

## 7. Evidence and Objects

Upload pipeline: authz → filename normalize → size → MIME/extension → SHA-256 → object store → metadata transaction → audit.

Do not serve uploads from arbitrary local web paths. Prefer presigned object URLs with authorization checks.

---

## 8. Schema Evolution

- Alembic for all schema changes (`migrations/` at repo root — ADR-019)
- Phase 1: empty/baseline migration + connectivity only
- Domain tables introduced in feature phases with tests

---

## 9. Local vs Hosted Storage Mapping

| Concern | Local | Hosted |
|---|---|---|
| Relational | Compose PostgreSQL 18 | Render Postgres 18 |
| Queue/cache | Compose Redis/Valkey | Render Key Value |
| Objects | SeaweedFS S3 bucket `aegis-dev-evidence` (`localhost:8333`) | R2 `aegis-stage-evidence` / `aegis-prod-evidence` |
| Raw telemetry | Lenovo / Wazuh | Not mirrored wholesale to cloud |

Application code uses an S3-compatible storage abstraction so SeaweedFS (local) and R2 (hosted) share one interface pattern.

---

## 10. Demo and Sanitization

Portfolio/demo data: fictional identities, no real PII, no live credentials, no private lab raw logs. Synthetic seed and fixture data must be labeled. Missing/stale integration data must not appear as healthy zeros.
