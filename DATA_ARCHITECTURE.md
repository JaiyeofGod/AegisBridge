# AegisBridge Data Architecture

**Document version:** 1.1  
**Date:** October 20, 2026  
**Status:** Phase 2 schema foundation applied  
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
`users`, `roles`, `permissions`, `user_roles`, `user_credentials`, `sessions`, `user_preferences`, `access_entitlements`, `access_reviews`, `access_review_findings`

Local password hashes live in `user_credentials` (Argon2id). Server sessions store only `token_digest` and optional `csrf_token_digest`. `user_preferences` stores theme/density/landing/reduced_motion per user. Deferred name `api_credentials` for machine/API keys is not implemented.

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
`policies`, `policy_versions`, `policy_approvals`, `policy_acknowledgements`, `policy_control_mappings`

### Vendors
`vendors`, `vendor_services`, `vendor_assessments`, `vendor_findings`

### Research
`datasets`, `dataset_versions`, `dataset_files`, `dataset_experiments`

### Reports
`report_definitions`

Report definitions are catalog rows. Generated report objects and execution history are not part of this foundation.

### Cyber range
`lab_zones`, `lab_systems`, `lab_scenarios`, `lab_scenario_systems`, `lab_scenario_detections`, `lab_scenario_attack_mappings`

These tables store the private-range plan and scenario catalog. They are not a live Lenovo connection and do not expose remote-control actions.

### Integrations
`integrations`, `sync_jobs`, `sync_states`, `integration_health`

### Threat intelligence
`threat_intel_sources`, `threat_indicators`, `threat_advisories`

These three tables are the stored catalog for simulated and reference-only records. They are not a connected CISA KEV, NVD, EPSS, ThreatFox, or URLhaus feed. `incident_indicators` stays an incident-scoped table.

### Audit
`audit_events` (append-oriented)

---

## 4. Display ID Conventions

```text
AST-0001  RISK-0001  CTRL-0001  EVID-0001
VULN-0001 DET-0001   INC-0001   POL-0001
VEN-0001  DS-0001    USR-0001   AUD-0001
INT-0001  SRC-0001   IOC-0001   ADV-0001
RPT-0001  RSCH-0001 SCN-0001
LAB-GW-01 MGMT
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
- Phase 1: empty baseline `20261020_0001` remains history
- Phase 2: `20261020_0002` creates the domain tables from the SQLAlchemy models
- `20261020_0003` adds threat-intelligence tables and nullable `integrations.human_id`
- `20261020_0004` adds `report_definitions` and dataset/experiment registry metadata columns
- Development seed is `python -m app.db.seed` and is not part of a migration
- Entity relationships: `docs/schema/DOMAIN_MODEL.md`

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

---

## 11. Phase 2 schema notes

The implemented tables are the domain list in section 3 except these deferred tables: `api_credentials`, `control_findings`, `evidence_incident_links`, `investigation_notes`, `policy_approvals`, and `integration_health`. `20261020_0003` adds threat-intelligence tables and nullable `integrations.human_id`. `20261020_0004` adds `report_definitions` and dataset registry metadata. `20261020_0005` adds cyber-range catalog tables. `20261020_0006` adds `user_credentials` and `sessions` for local Argon2id authentication. `20261020_0007` adds `sessions.csrf_token_digest` and `user_preferences`. `20261020_0008` adds unique public `human_id` (`CTEST-NNNN`) on `control_tests`. `20261020_0009` adds `evidence_objects` for private S3-compatible object metadata (one row per evidence; bytes remain in SeaweedFS/R2). `20261020_0010` adds `policy_versions.status` / `change_summary` and closed-set checks on policy/version lifecycle values. `20261020_0011` adds `policy_control_mappings` (unique policy↔control pairs; relationship only, no duplicated control or licensed CIS text). Application code uses `app/storage` (S3 protocol) so local SeaweedFS and hosted R2 share one interface. Object storage outage does not fail platform readiness (optional health check).

Human IDs are a unique `human_id` string, not the primary key. Operational prefixes use four digits (`RISK-0021`, `CTRL-0002`, `VULN-0041`, `EVID-0041`, `USR-0001`, `AL-0107`). Frontend mocks still show shorter labels such as `R-021` until a later integration.

Closed values use string columns and check constraints. PostgreSQL enum types are not used. Risk `score` and `residual_score` are generated columns (`likelihood * impact`). Evidence and dataset files store SHA-256 metadata and an object URI. File bytes are not a PostgreSQL column. `alert_references` stores selected metadata only. `audit_events` has no `updated_at`. Foreign-key columns are indexed. `ON DELETE` is the default restrict behavior.
