# Read-only API contracts

Base path: `/api/v1`. These routes read the Phase 2 domain tables. They do not authenticate, write, call external systems, or connect the frontend.

Human-readable IDs are the public identifiers (`AST-0007`, `RISK-0021`, `VULN-0041`, `AL-0107`, `INC-0001`). Internal UUIDs are not returned. Timestamps are ISO 8601. Absent values are JSON `null`.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/overview` | Separate counts. No security score. |
| GET | `/assets` | Filters: `search`, `asset_type`, `criticality`, `environment`, `telemetry_status` |
| GET | `/assets/{asset_id}` | Vulnerabilities, alerts, risks, controls, and evidence summaries |
| GET | `/risks` | Filters: `search`, `risk_level`, `treatment_status`, `owner` |
| GET | `/risks/{risk_id}` | Likelihood, impact, and score stay separate |
| GET | `/vulnerabilities` | Filters: `search`, `severity`, `kev`, `action_decision`, `remediation_status`, `asset_criticality` |
| GET | `/vulnerabilities/{vulnerability_id}` | CVSS, EPSS, KEV, exposure, criticality, and SSVC stay separate |
| GET | `/alerts` | Filters: `search`, `severity`, `status`, `asset`, `attack_technique` |
| GET | `/alerts/{alert_id}` | Selected Wazuh reference metadata |
| GET | `/incidents` | Filters: `search`, `severity`, `status`, `owner`, `containment_state` |
| GET | `/incidents/{incident_id}` | Timeline, tasks, indicators, evidence, related alerts, affected assets |
| GET | `/governance/summary` | Framework identifiers, counts, evidence freshness, policies, access reviews |
| GET | `/threat-intelligence/summary` | Stored indicator, match, advisory, and source-status counts |
| GET | `/threat-intelligence/indicators` | Filters: `search`, `indicator_type`, `source`, `status`, `internal_match` |
| GET | `/threat-intelligence/indicators/{indicator_id}` | Simulated indicator, source, and stored ATT&CK link |
| GET | `/threat-intelligence/advisories` | Stored advisory metadata |
| GET | `/threat-intelligence/sources` | Feed catalog and connection status |
| GET | `/administration/summary` | Integration, user, audit, and access-review counts |
| GET | `/administration/integrations` | Catalog rows without credentials |
| GET | `/administration/users` | Users, roles, and derived privileged flag |
| GET | `/administration/roles` | Stored role catalog and derived permission labels |
| GET | `/administration/audit-events` | Append-only audit rows |
| GET | `/administration/access-reviews` | Review status and finding counts |
| GET | `/reports/summary` | Report definition, dataset, and experiment counts |
| GET | `/reports/definitions` | Filters: `search`, `status`, `report_type` |
| GET | `/reports/definitions/{report_id}` | Definition detail with empty `generated_files` |
| GET | `/datasets` | Filters: `search`, `status`, `domain`, `verification_status`, `publication_year` |
| GET | `/datasets/{dataset_id}` | Registry detail with versions, files, and experiments |
| GET | `/dataset-experiments` | Filters: `search`, `status`, `dataset_id`, `experiment_type` |
| GET | `/dataset-experiments/{experiment_id}` | Stored experiment metadata |

`{asset_id}` and the other path IDs are human IDs, not UUIDs.

## Pagination

List routes return:

```json
{"page": 1, "page_size": 25, "total": 0, "items": []}
```

`page` starts at 1. `page_size` defaults to 25 and cannot exceed 100.

## Errors

```json
{"code": "not_found", "message": "Asset AST-9999 was not found.", "details": null, "request_id": null}
```

Validation uses the same shape with `code` `validation_error` and `details` entries of `loc` and `message`. `request_id` is reserved and is null until request correlation exists. Error bodies do not include stack traces, SQL, or connection strings.

## Security semantics

- Risk `score` is likelihood × impact. `methodology` is `aegisbridge_likelihood_x_impact`. Bands are low 1–4, medium 5–9, high 10–15, and critical 16–25.
- `cvss_severity` is a label for the CVSS base score only. There is no combined vulnerability score.
- KEV exposure counts internet-exposed assets that have a KEV row. It does not add CVSS or EPSS.
- Alert rows set `stored_scope` to `selected_metadata` and `source_of_record` to `wazuh`. Raw events are not stored or returned.
- Evidence responses include SHA-256 metadata and omit object-storage URIs and file bytes.
- Governance sets `licensed_text_included` to false. Control codes and stored titles are returned. CIS licensed text is not.
- Telemetry `active` counts only `active` or `reporting`. Seed values `reference_only` and `not_connected` stay at zero because the feed is absent.
- Incident `containment_state` is null. Filtering it returns an empty page because the column is not stored. Related alerts and affected assets are empty for the same reason.
- An incident summary is not a confirmed-compromise verdict.
- Owner objects are `{id, display_name}`. Passwords, tokens, and integration secrets are not returned.
- User list items include the stored email. Integration `credential_state` repeats the stored label `No credentials stored`. The database column `auth_state` is not a response field.
- A user is privileged when a role is Administrator or Security Engineer. CISO, GRC Analyst, SOC Analyst, Auditor, and Read Only are not privileged.
- Role `id` is the stored role name. `permissions` are the distinct `role_catalog` entitlements of users who hold that role. A role with no user has an empty permission list. There is no role-permission table.
- `recent_audit_event_count` counts stored audit events from the last 30 days. Audit `detail` is the stored text. Audit responses do not include secrets.
- Access-review `owner` and `due_at` are null because those facts are not stored. Pending reviews are any status other than `closed`, `completed`, or `cancelled`.
- `configured_integration_count` counts integrations whose stored status is `configured`. Seed status `not_configured` and freshness `not_connected` stay absent. `last_sync_at` is the latest sync-job finish time and is null when no job exists.
- Threat-intelligence `source_health` counts stored `connection_status` values: `configured`, `reference_only`, `not_connected`, `delayed`, and `healthy`. The development seed uses only `reference_only` and `not_connected`. Named external catalogs are not connected feeds.
- Indicator `internal_match` is a stored simulated label. It is not a live correlation and not a confirmed compromise. ATT&CK appears only when `attack_technique_id` is stored.
- Reserved documentation addresses, `.example` domains, and hashes of labeled synthetic strings are simulated indicators.
- Report definitions are catalog rows. `schedule_defined` stores a cadence label only. No report scheduler or worker is running. `completed_report_count`, `failed_report_count`, and `recent_execution_count` are zero because no execution or export rows are stored. Detail responses set `generated_files` to an empty list.
- Dataset rows are registry metadata. `status` values in the seed are `not_downloaded`. `verification_status` may be `not_reviewed`, `verification_required`, or `reviewed`. File counts stay at zero unless `dataset_files` rows exist. `storage_uri` is never returned.
- Experiment metrics are the stored `metrics_summary` text only. No model runtime or performance claim is inferred.

## Development data

The current seed is representative, not a copy of the frontend mocks. `AST-0007` / FIN-APP-01 is the primary asset example and links `VULN-0041`, `RISK-0021`, `CTRL-0002`, and `EVID-0041`. `AL-0107` is on WIN-WS-07. `INC-0001` has a timeline event and evidence link, and no tasks, incident indicators, or asset link.

Threat intelligence adds `SRC-0001` through `SRC-0006`, `IOC-0001` through `IOC-0003`, and `ADV-0001`. Only `SRC-0006` stores indicators. `IOC-0001` is TEST-NET-3 `203.0.113.50`. `IOC-0002` is `dev-watch.example` with a stored match to `AST-0007` and technique `T1059.001`.

Administration adds `USR-0002` Nia Okeke as Security Engineer, `INT-0001` Wazuh, `INT-0002` example identity provider, and `AUD-0002`. The role catalog is the original six roles plus Security Engineer. That seventh role is required by master requirements §6 and `SECURITY_REQUIREMENTS.md`. Permission labels are not authorization checks.

Reports add `RPT-0001` through `RPT-0005` as definitions only. Datasets `DS-0001` through `DS-0009` are registry metadata with a `registry` version and no files. Experiments `RSCH-0001` through `RSCH-0004` store notes and optional metrics text.
