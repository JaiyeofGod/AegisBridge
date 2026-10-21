# API contracts

Base path: `/api/v1`. Domain GET routes read the Phase 2 tables and remain **unauthenticated** until the frontend auth wiring slice. Authentication and Account routes require a server session cookie. No SSO, MFA enrollment, email delivery, or remote lab control.

Human-readable IDs are the public identifiers (`AST-0007`, `RISK-0021`, `VULN-0041`, `AL-0107`, `INC-0001`, `USR-0001`). Internal UUIDs are not returned. Timestamps are ISO 8601. Absent values are JSON `null`. Details: `docs/security/AUTHENTICATION_AND_RBAC.md`.

## Auth endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | Email + password. Sets HttpOnly `aegis_session` cookie. Generic credential errors. |
| POST | `/auth/logout` | Revokes current session; clears cookie. Safe if already logged out. |
| POST | `/auth/logout-all` | Authenticated. Revokes all sessions for the current user. |
| GET | `/auth/session` | `{authenticated, user?, session_id?, expires_at?, last_seen_at?}` |
| GET | `/auth/me` | Current user. `401` when unauthenticated. |

Login body: `{ "email", "password" }`. Responses never include password hashes, raw tokens, or digests.

## Account endpoints (authenticated)

| Method | Path | Notes |
|---|---|---|
| GET | `/account/profile` | Safe profile fields for the current user |
| GET | `/account/security` | Password configured flag, session counts/metadata, MFA `not_configured` |
| GET | `/account/preferences` | Explicit defaults; `persistence: not_stored` |
| GET | `/account/workspace` | Organization, roles, permissions, privileged flag |

## Domain read endpoints

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
| GET | `/cyber-range/summary` | Zone, system, telemetry, scenario, detection, and Lab Bridge counts |
| GET | `/cyber-range/zones` | Logical lab segments |
| GET | `/cyber-range/systems` | Filters: `search`, `zone`, `role`, `telemetry_status`, `observed_state` |
| GET | `/cyber-range/systems/{system_id}` | Lab system detail and telemetry expectation |
| GET | `/cyber-range/scenarios` | Filters: `search`, `status`, `category`, `attack_technique` |
| GET | `/cyber-range/scenarios/{scenario_id}` | Scenario detail without execute actions |
| GET | `/cyber-range/telemetry` | Per-system telemetry expectation rows |
| GET | `/cyber-range/detections` | Filters: `search`, `validation_state`, `attack_technique`, `data_source` |

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

- Auth uses Argon2id password hashes and opaque session cookies. Domain GET routes are not yet permission-gated.
- Role permissions are resolved from the deterministic catalog in `app/security/permissions.py`. Administration role list responses include that catalog (union stored `role_catalog` entitlements).
- A user is privileged when a role is Administrator or Security Engineer.
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
- CISO, GRC Analyst, SOC Analyst, Auditor, and Read Only are not privileged.
- Role `id` is the stored role name. `permissions` are the deterministic role catalog codes (and any additional stored `role_catalog` entitlements). There is no separate role-permission table.
- `recent_audit_event_count` counts stored audit events from the last 30 days. Audit `detail` is the stored text. Audit responses do not include secrets.
- Access-review `owner` and `due_at` are null because those facts are not stored. Pending reviews are any status other than `closed`, `completed`, or `cancelled`.
- `configured_integration_count` counts integrations whose stored status is `configured`. Seed status `not_configured` and freshness `not_connected` stay absent. `last_sync_at` is the latest sync-job finish time and is null when no job exists.
- Threat-intelligence `source_health` counts stored `connection_status` values: `configured`, `reference_only`, `not_connected`, `delayed`, and `healthy`. The development seed uses only `reference_only` and `not_connected`. Named external catalogs are not connected feeds.
- Indicator `internal_match` is a stored simulated label. It is not a live correlation and not a confirmed compromise. ATT&CK appears only when `attack_technique_id` is stored.
- Reserved documentation addresses, `.example` domains, and hashes of labeled synthetic strings are simulated indicators.
- Report definitions are catalog rows. `schedule_defined` stores a cadence label only. No report scheduler or worker is running. `completed_report_count`, `failed_report_count`, and `recent_execution_count` are zero because no execution or export rows are stored. Detail responses set `generated_files` to an empty list.
- Dataset rows are registry metadata. `status` values in the seed are `not_downloaded`. `verification_status` may be `not_reviewed`, `verification_required`, or `reviewed`. File counts stay at zero unless `dataset_files` rows exist. `storage_uri` is never returned.
- Experiment metrics are the stored `metrics_summary` text only. No model runtime or performance claim is inferred.
- Cyber-range responses are DEVELOPMENT / SEEDED catalog rows. MacBook is the development machine. Lenovo is the private cyber-range host. There is no public inbound access to Lenovo and no remote-control endpoint. A future Lab Bridge is outbound-only from the lab to the hosted API. `lab_bridge_status` and `freshness_state` are `not_connected` in the seed. `last_successful_lab_sync_at` is null. `scenarios_running_count` is always zero because no runner exists. System `observed_state` values are `not_observed` unless a stored row says otherwise. Wazuh and Suricata stay `not_connected` or `not_reporting`. Detection `validation_state` is `not_validated` and `last_validated_at` is null unless a validation row is intentionally stored.

## Development data

The current seed is representative, not a copy of the frontend mocks. `AST-0007` / FIN-APP-01 is the primary asset example and links `VULN-0041`, `RISK-0021`, `CTRL-0002`, and `EVID-0041`. `AL-0107` is on WIN-WS-07. `INC-0001` has a timeline event and evidence link, and no tasks, incident indicators, or asset link.

Threat intelligence adds `SRC-0001` through `SRC-0006`, `IOC-0001` through `IOC-0003`, and `ADV-0001`. Only `SRC-0006` stores indicators. `IOC-0001` is TEST-NET-3 `203.0.113.50`. `IOC-0002` is `dev-watch.example` with a stored match to `AST-0007` and technique `T1059.001`.

Administration adds `USR-0002` Nia Okeke as Security Engineer, `INT-0001` Wazuh, `INT-0002` example identity provider, and `AUD-0002`. The role catalog is the original six roles plus Security Engineer. That seventh role is required by master requirements §6 and `SECURITY_REQUIREMENTS.md`. Permission labels are not authorization checks.

Reports add `RPT-0001` through `RPT-0005` as definitions only. Datasets `DS-0001` through `DS-0009` are registry metadata with a `registry` version and no files. Experiments `RSCH-0001` through `RSCH-0004` store notes and optional metrics text.

Cyber range adds zones `MGMT` through `ATTACK`, systems `LAB-GW-01`, `SEC-WAZUH-01`, `WIN-USER-01`, `LINUX-APP-01`, and `KALI-RED-01`, scenarios `SCN-0001` through `SCN-0006`, detections `DET-0001` through `DET-0012`, and Lab Bridge integration `INT-0003` as `not_connected`.
