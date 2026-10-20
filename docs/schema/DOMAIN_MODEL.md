# Domain model

Phase 2 relational foundation. SQLAlchemy models live in `apps/api/app/models/`. The schema migration is `migrations/versions/20261020_0002_add_domain_schema.py`. Development rows are loaded by `python -m app.db.seed` and are not part of the migration.

Internal primary keys are UUIDs. Operational records also have a unique `human_id`. Closed value sets are strings with check constraints. There is no combined vulnerability score.

## Ownership

| Boundary | Owns | Does not own |
|---|---|---|
| Organization | Tenant, departments, business processes | Workspace display name from the UI |
| Identity | Users, role catalog, permission labels, entitlements, access reviews | Passwords, sessions, API credentials |
| Assets | Inventory, software, data-asset relationships, criticality, exposure | Vulnerability findings |
| Risk | Likelihood, impact, generated score, treatment, reviews | CVSS, EPSS, KEV, SSVC |
| GRC | Framework versions, controls, mappings, implementations, tests | Control findings |
| Evidence | Metadata, SHA-256, object URI, links to controls and risks | File bytes |
| Vulnerability | CVE technical severity, EPSS snapshots, KEV facts, asset exposure, SSVC decision, remediation, exceptions | A summed priority score |
| Detection | Detection versions, ATT&CK techniques, validation runs | Raw telemetry |
| SOC | Selected alert metadata and investigations | A copy of the Wazuh database |
| Incident | Events, tasks, indicators, evidence links | Confirmed compromise as a stored fact |
| Vendor / policy / dataset / integration | Their own records and versions | Secrets and live connector state |
| Audit | Actor, action, object, result, source, environment, timestamp | Updates, secrets |

## Relationships

- Organization is the parent of departments, users, assets, risks, controls, evidence, findings, detections, alerts, incidents, vendors, policies, datasets, and integrations.
- A user may belong to one department and many roles. A role may grant many permission labels through `access_entitlements`. Access reviews record findings about users.
- An asset has one type, many owners, software installs, and data-asset links. Criticality and exposure are columns on the asset, separate from vulnerability facts.
- A risk may name one affected asset. Assessments store likelihood and impact from 1 to 5. `score` is `likelihood * impact`. Residual score is generated only when both residual inputs exist. Treatment strategy is accept, avoid, mitigate, or transfer.
- A control belongs to one framework version. Mappings connect two controls. Implementations and tests hang off a control.
- Evidence links to controls and risks. Incident evidence is a separate link table. SHA-256, when present, is 64 lowercase hex characters.
- A vulnerability may point at one CVE record. CVSS stays on `cve_records`. EPSS stays on `epss_snapshots`. KEV is one row per CVE. Asset findings add exposure and asset criticality. SSVC stores a decision string: track, track_star, attend, act, or pending_review.
- A detection has versions and maps to ATT&CK techniques. Validation runs belong to a detection version.
- An alert reference may point at an asset and a detection. An investigation may point at one alert. Wazuh remains the source system; the row is a reference.
- An incident has events, tasks, indicators, and evidence links.
- Vendors have services, assessments, and findings. Policies have versions and acknowledgements. Datasets have versions, file metadata, and experiments.
- An integration has sync jobs. `sync_states` is one current row per integration. No credential column is stored.
- Audit events reference an optional user and have no `updated_at`.

## Deferred tables

`sessions`, `api_credentials`, `control_findings`, `evidence_objects`, `evidence_incident_links`, `investigation_notes`, `policy_approvals`, and `integration_health` are named in `DATA_ARCHITECTURE.md` and are not in this migration.

## Development seed identifiers

The seed is deterministic and skips work when organization slug `aegisbridge-technologies` already exists. `python -m app.db.seed --reset` deletes domain rows only when `APP_ENV` is local, development, dev, or test.

Representative IDs include `AST-0007` FIN-APP-01, `AST-0018` WIN-WS-07, `AST-0003` WAZUH-01, `AST-0061` LINUX-APP-01, `AST-0031` EDGE-FW-01, `RISK-0021`, `CTRL-0002`, `EVID-0041`, `VULN-0041`, `DET-0005`, `AL-0107`, and `INC-0001`.
