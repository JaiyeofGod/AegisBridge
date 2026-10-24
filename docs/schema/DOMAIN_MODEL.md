# Domain model

Phase 2 relational foundation. SQLAlchemy models live in `apps/api/app/models/`. Domain tables are `migrations/versions/20261020_0002_add_domain_schema.py`. Threat-intelligence tables and `integrations.human_id` are `migrations/versions/20261020_0003_add_threat_intel.py`. Report definitions and dataset registry metadata are `migrations/versions/20261020_0004_add_reports_and_dataset_metadata.py`. Cyber-range catalog tables and detection metadata columns are `migrations/versions/20261020_0005_add_cyber_range_catalog.py`. Local credentials and sessions are `migrations/versions/20261020_0006_add_auth_sessions.py`. CSRF digests and `user_preferences` are `migrations/versions/20261020_0007_add_csrf_and_user_preferences.py`. Public `control_tests.human_id` (`CTEST-NNNN`) is `migrations/versions/20261020_0008_add_control_test_human_id.py`. Private evidence object metadata is `migrations/versions/20261020_0009_add_evidence_objects.py`. Policy version lifecycle columns (`policy_versions.status`, `change_summary`) and policy status checks are `migrations/versions/20261020_0010_policy_version_lifecycle.py`. Development rows are loaded by `python -m app.db.seed` and are not part of the migration.

Internal primary keys are UUIDs. Operational records also have a unique `human_id`. Closed value sets are strings with check constraints. There is no combined vulnerability score.

## Ownership

| Boundary | Owns | Does not own |
|---|---|---|
| Organization | Tenant, departments, business processes | Workspace display name from the UI |
| Identity | Users, role catalog, permission labels, entitlements, access reviews. `GET /directory/users` is a read of active users in the caller's organization, not a new table. | Machine/API credentials (`api_credentials` deferred) |
| Auth | `user_credentials` (Argon2id hashes), `sessions` (token + CSRF digests only) | Raw session/CSRF tokens, plaintext passwords, MFA secrets |
| Preferences | `user_preferences` (theme, density, landing_page, reduced_motion) | Server-side theme application |
| Assets | Inventory, software, data-asset relationships, criticality, exposure | Vulnerability findings |
| Risk | Likelihood, impact, generated score, treatment, reviews | CVSS, EPSS, KEV, SSVC |
| GRC | Framework versions, controls, mappings, implementations, tests | Control findings |
| Evidence | Metadata, SHA-256, object URI, links to controls and risks | File bytes |
| Vulnerability | CVE technical severity, EPSS snapshots, KEV facts, asset exposure, SSVC decision, remediation, exceptions | A summed priority score |
| Detection | Detection versions, ATT&CK techniques, validation runs, catalog metadata | Raw telemetry, successful validation unless stored |
| Cyber range | Lab zones, systems, scenarios, scenario links | Remote control, inbound Lenovo access, live Suricata/Wazuh feeds |
| SOC | Selected alert metadata and investigations | A copy of the Wazuh database |
| Incident | Events, tasks, indicators, evidence links | Confirmed compromise as a stored fact |
| Vendor / policy / dataset / integration | Their own records and versions | Secrets and live connector state |
| Threat intelligence | Source catalog, simulated indicators, advisory metadata | A live external feed |
| Reports | Report definition catalog | Generated PDF/CSV files and a running scheduler |
| Audit | Actor, action, object, result, source, environment, timestamp | Updates, secrets |

## Relationships

- Organization is the parent of departments, users, assets, risks, controls, evidence, findings, detections, alerts, incidents, vendors, policies, datasets, integrations, threat-intelligence sources, indicators, and advisories.
- A user may belong to one department and many roles. A role may grant many permission labels through `access_entitlements`. Access reviews record findings about users.
- An asset has one type, many owners, software installs, and data-asset links. Criticality and exposure are columns on the asset, separate from vulnerability facts.
- A risk may name one affected asset. Assessments store likelihood and impact from 1 to 5. `score` is `likelihood * impact`. Residual score is generated only when both residual inputs exist. Treatment strategy is accept, avoid, mitigate, or transfer.
- `risk_control_mappings` is a relationship-only many-to-many between a risk and a control (unique pair). It means the control is associated with managing the risk. It does not lower likelihood, impact, or score, does not mark treatment complete, and does not claim the control is effective. Effectiveness stays with implementation, tests, and evidence. GRC traceability is Risk → Control → Test → Evidence, plus Policy → Control.
- A control belongs to one framework version. Mappings connect two controls. Implementations and tests hang off a control.
- Evidence links to controls and risks. Incident evidence is a separate link table. SHA-256, when present, is 64 lowercase hex characters. File bytes live in private object storage; `evidence_objects` holds provider/bucket/object_key/filename/size/sha256. API responses never return credentials or object keys.
- `control_tests` rows have public `human_id` values (`CTEST-NNNN`) for authenticated create/update. Tests are manually recorded; they are not automated assessment results.
- A vulnerability may point at one CVE record. CVSS stays on `cve_records`. EPSS stays on `epss_snapshots`. KEV is one row per CVE. Asset findings add exposure and asset criticality. SSVC stores a decision string: track, track_star, attend, act, or pending_review. `20261024_0014` records when NVD, KEV, and EPSS were fetched. That refresh does not change SSVC or remediation.
- A detection has versions and maps to ATT&CK techniques. Optional catalog fields include description, data source, Sigma reference, Wazuh mapping status, and validation state. Validation runs belong to a detection version and are not invented by the seed.
- Lab zones and systems are private-range catalog rows, separate from the enterprise asset inventory. Scenarios link to expected systems, detections, and ATT&CK techniques. Lab Bridge is an integration catalog row (`INT-0003`) with outbound-only semantics and no credentials.
- An alert reference may point at an asset and a detection. An investigation may point at one alert. Wazuh remains the source system; the row is a reference.
- An incident has events, tasks, indicators, and evidence links. `incident_tasks.human_id` is `TASK-NNNN` (`20261020_0013`). Status is `open`, `in_progress`, `blocked`, `completed`, or `cancelled`. `completed_at` is set only for `completed`. Ownership is `assignee_user_id` (a user in the same organization). Priority and due date are not stored. Cancelling keeps the row. Completing a task does not close the incident. Automated containment and SOAR are not part of this table.
- Vendors have services, assessments, and findings. Policies have versions and acknowledgements. Policy lifecycle status is closed-set on `policies.status`. Version content is plain text in `body_summary`; `status` is `draft` / `published` / `superseded`; `is_current` marks the sole published current version. Acknowledgements reference a policy version and a user. `policy_control_mappings` stores relationship-only links to controls (`policy_id`, `control_id`, unique pair); no control or licensed framework text is copied. Datasets have registry metadata, versions, optional file metadata, and experiments. Dataset `status` is a download/registry label such as `not_downloaded`. `verification_status` is a separate review label.
- Report definitions belong to an organization and may name an owner. `schedule_defined` stores a cadence label. Generated files and execution rows are not part of this table.
- An integration has an optional human ID, sync jobs, and one current `sync_states` row. No credential column is stored. `auth_state` is a label such as `No credentials stored`.
- A threat-intelligence source has `connection_status` of `configured`, `reference_only`, `not_connected`, `delayed`, or `healthy`. Indicators belong to one source and may point at one asset and one ATT&CK technique. Advisories store metadata only. Incident indicators remain a separate table.
- Audit events reference an optional user and have no `updated_at`.

## Deferred tables

`api_credentials`, `control_findings`, `evidence_incident_links`, `investigation_notes`, `policy_approvals`, and `integration_health` are named in `DATA_ARCHITECTURE.md` and are not in this migration. `sessions` and local password storage (`user_credentials`) are implemented in `20261020_0006`. `evidence_objects` is implemented in `20261020_0009`. Policy version lifecycle fields are in `20261020_0010`. Policy↔control mappings are in `20261020_0011`. Risk↔control mappings are in `20261020_0012`. Incident task public ids and `completed_at` are in `20261020_0013`.

## Development seed identifiers

The seed is deterministic. When organization slug `aegisbridge-technologies` already exists, it still ensures the threat-intelligence and administration contract rows. `python -m app.db.seed --reset` deletes domain rows only when `APP_ENV` is local, development, dev, or test.

Representative IDs include `AST-0007` FIN-APP-01, `AST-0018` WIN-WS-07, `AST-0003` WAZUH-01, `AST-0061` LINUX-APP-01, `AST-0031` EDGE-FW-01, `RISK-0021`, `CTRL-0002`, `EVID-0041`, `VULN-0041`, `DET-0001` through `DET-0012`, `AL-0107`, `INC-0001`, `TASK-0001` through `TASK-0003`, `USR-0002`, `INT-0001`, `INT-0002`, `INT-0003`, `AUD-0002`, `SRC-0006`, `IOC-0002`, `ADV-0001`, `RPT-0001`, `DS-0001`, `RSCH-0001`, `LAB-GW-01`, and `SCN-0001`.

The role catalog is Administrator, CISO, GRC Analyst, SOC Analyst, Security Engineer, Auditor, and Read Only. Security Engineer was added because master requirements §6 and `SECURITY_REQUIREMENTS.md` list it as a distinct platform role. The original six roles are unchanged.
