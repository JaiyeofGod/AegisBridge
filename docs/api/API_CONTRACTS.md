# API contracts

Base path: `/api/v1`. Domain GET routes require an authenticated session cookie and capability-based permissions. Authenticated writes use synchronizer CSRF (`X-CSRF-Token`; see `docs/security/AUTHENTICATION_AND_RBAC.md`). Health and `POST /auth/login` / `GET /auth/session` remain public. No SSO, MFA, email delivery, integration credential writes, report writes, cyber-range control, or remote lab control.

Human-readable IDs are the public identifiers (`AST-0007`, `RISK-0021`, `VULN-0041`, `AL-0107`, `INC-0001`, `USR-0001`). Internal UUIDs are not returned. Timestamps are ISO 8601. Absent values are JSON `null`. Details: `docs/security/AUTHENTICATION_AND_RBAC.md`.

## Auth endpoints

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | Email + password. Sets HttpOnly `aegis_session`. Returns user fields + `csrf_token` (not the session cookie). |
| POST | `/auth/logout` | CSRF when session present. Revokes session; clears cookie. |
| POST | `/auth/logout-all` | Authenticated + CSRF. Revokes all sessions for the current user. |
| GET | `/auth/csrf` | Authenticated. Rotates/returns synchronizer CSRF token + `header_name`. |
| GET | `/auth/session` | `{authenticated, user?, session_id?, expires_at?, last_seen_at?}` |
| GET | `/auth/me` | Current user. `401` when unauthenticated. |

Login body: `{ "email", "password" }`. Responses never include password hashes, session digests, or CSRF digests.

## Account endpoints (authenticated)

| Method | Path | Notes |
|---|---|---|
| GET | `/account/profile` | Safe profile fields for the current user |
| GET | `/account/security` | Password configured flag, session counts/metadata, MFA `not_configured` |
| GET | `/account/preferences` | `persistence: default` or `stored`; optional `updated_at` |
| PATCH | `/account/preferences` | CSRF. Partial update of `theme`, `density`, `landing_page`, `reduced_motion`. Current user only. |
| GET | `/account/workspace` | Organization, roles, permissions, privileged flag |

## Domain write endpoints

| Method | Path | Permission | Notes |
|---|---|---|---|
| PATCH | `/risks/{risk_id}/treatment` | `risk.manage` + CSRF | Partial update of `strategy`, `status`, `notes`. Optional `expected_updated_at` → `409` on stale. |
| PATCH | `/incidents/{incident_id}` | `incident.manage` + CSRF | Partial update of `title`, `severity`, `status`, `summary`, `owner` (user human id). Setting `status` to `resolved`/`closed` also requires `incident.close`. Optional `expected_updated_at` → `409`. `containment_state` is not stored and cannot be written. Incident task PATCH is deferred (tasks lack public ids). |
| PATCH | `/vulnerabilities/{vulnerability_id}/remediation` | `vulnerability.manage` + CSRF | Partial update of remediation `status`, `title`, `due_on`, `owner`. Optional `asset_id` (required when multiple asset findings). Optional `expected_updated_at` → `409`. CVSS, EPSS, KEV, SSVC/`action_decision`, and source enrichment are immutable. |
| PATCH | `/administration/access-reviews/{review_id}` | `administration.manage` + CSRF | Partial update of `name`, `status` (`in_progress` / `closed` / `completed` / `cancelled`). Optional `expected_updated_at` → `409`. Owner/due/notes are not stored. Finding updates deferred (findings lack public ids). |
| PATCH | `/administration/users/{user_id}` | `administration.manage` + CSRF | Partial update of `status` only (`active` / `inactive`). Optional `expected_updated_at` → `409`. Email, credentials, human id, and permissions are not writable. Disabling the last active Administrator → `409`. |
| PUT | `/administration/users/{user_id}/roles` | `administration.manage` **and** `user.role.manage` + CSRF | Replace role set with seven-role catalog names only. Duplicates normalized. Unknown role → `422`. Returns resulting roles + effective permissions. Removing Administrator from the last active Administrator → `409`. |

## Domain read endpoints

All domain rows require a valid session (`401` otherwise) and the permission listed in `AUTHENTICATION_AND_RBAC.md` (`403` when missing). Overview is authenticated-only; response sections are filtered by the caller's effective permissions.

| Method | Path | Notes |
|---|---|---|
| GET | `/overview` | Separate counts. No security score. Permission-filtered sections. |
| GET | `/assets` | Filters: `search`, `asset_type`, `criticality`, `environment`, `telemetry_status` |
| GET | `/assets/{asset_id}` | Vulnerabilities, alerts, risks, controls, and evidence summaries |
| GET | `/risks` | Filters: `search`, `risk_level`, `treatment_status`, `owner` |
| GET | `/risks/{risk_id}` | Likelihood, impact, and score stay separate |
| GET | `/vulnerabilities` | Filters: `search`, `severity`, `kev`, `action_decision`, `remediation_status`, `asset_criticality` |
| GET | `/vulnerabilities/{vulnerability_id}` | CVSS, EPSS, KEV, exposure, criticality, and SSVC stay separate; asset contexts may include `remediation_updated_at` |
| GET | `/alerts` | Filters: `search`, `severity`, `status`, `asset`, `attack_technique` |
| GET | `/alerts/{alert_id}` | Selected Wazuh reference metadata |
| GET | `/incidents` | Filters: `search`, `severity`, `status`, `owner`, `containment_state` |
| GET | `/incidents/{incident_id}` | Timeline, tasks, indicators, evidence, related alerts, affected assets; includes `updated_at` for concurrency |
| GET | `/governance/summary` | Framework identifiers, counts, evidence freshness, policies, access reviews |
| GET | `/governance/controls` | Paginated control catalog. Query: `page`, `page_size` (max 100), optional metadata `q`, `framework` (e.g. `NIST-800-53`), `implementation_status` (`planned`/`partial`/`implemented`/`not_implemented`/`not_applicable`), allowlisted `sort` (`id`/`control_code`/`title`/`created_at`/`updated_at`) + `direction` (`asc`/`desc`). No licensed CIS text. |
| GET | `/governance/controls/{control_id}` | Control detail with implementation, manual tests, linked evidence metadata, mapped policy refs |
| PATCH | `/governance/controls/{control_id}/implementation` | Update implementation status/notes/owner; `control.manage` + CSRF; `expected_updated_at` → 409 |
| POST | `/governance/controls/{control_id}/tests` | Record a manual control test (`CTEST-NNNN`); `control.manage` + CSRF |
| PATCH | `/governance/control-tests/{test_id}` | Update a manual control test; `control.manage` + CSRF |
| POST | `/governance/controls/{control_id}/evidence/{evidence_id}` | Link evidence metadata to a control; `control.manage` + `evidence.manage` + CSRF |
| DELETE | `/governance/controls/{control_id}/evidence/{evidence_id}` | Unlink evidence from a control; same permissions + CSRF |
| GET | `/evidence/{evidence_id}` | Evidence metadata (`evidence.read`); no object URI/key or credentials |
| POST | `/evidence` | Create evidence metadata (`evidence.manage` + CSRF) |
| POST | `/evidence/{evidence_id}/object` | Multipart upload (`file`) to private object storage (`evidence.manage` + CSRF); one object per evidence |
| GET | `/evidence/{evidence_id}/object` | Authenticated private download stream (`evidence.read`); no CSRF |
| DELETE | `/evidence/{evidence_id}/object` | Delete stored object bytes; keep evidence metadata (`evidence.manage` + CSRF) |
| GET | `/policies` | Paginated policy catalog (`policy.read`). Query: `page`, `page_size` (max 100), optional metadata `q` (human id/title/owner), `status` (`draft`/`in_review`/`approved`/`published`/`retired`), allowlisted `sort` (`id`/`title`/`created_at`/`updated_at`) + `direction`. List items omit version body content. |
| GET | `/policies/{policy_id}` | Policy detail, versions, acknowledgement summary, mapped controls (`policy.read`) |
| GET | `/policies/{policy_id}/versions` | Version summaries for a policy |
| GET | `/policies/{policy_id}/versions/{version_label}` | Version content detail (`version_label` is the public version id) |
| POST | `/policies` | Create policy + initial draft version (`policy.manage` + CSRF); server `POL-NNNN` |
| PATCH | `/policies/{policy_id}` | Update title/owner (`policy.manage` + CSRF); `expected_updated_at` → 409 |
| POST | `/policies/{policy_id}/versions` | Create a new draft version (`policy.manage` + CSRF); does not rewrite published history |
| PATCH | `/policies/{policy_id}/versions/{version_label}` | Edit draft content only (`policy.manage` + CSRF); published/superseded → 409 |
| POST | `/policies/{policy_id}/transition` | Lifecycle transition (`policy.manage` or `policy.approve` per transition + CSRF). Publish requires `version_label` of a draft. |
| POST | `/policies/{policy_id}/acknowledge` | Self-acknowledge current published version (`policy.read` + CSRF); idempotent |
| POST | `/policies/{policy_id}/controls/{control_id}` | Link control to policy (`policy.manage` + CSRF); human ids; idempotent duplicate |
| DELETE | `/policies/{policy_id}/controls/{control_id}` | Unlink relationship only (`policy.manage` + CSRF); missing link → 404 |
| GET | `/threat-intelligence/summary` | Stored indicator, match, advisory, and source-status counts |
| GET | `/threat-intelligence/indicators` | Filters: `search`, `indicator_type`, `source`, `status`, `internal_match` |
| GET | `/threat-intelligence/indicators/{indicator_id}` | Simulated indicator, source, and stored ATT&CK link |
| GET | `/threat-intelligence/advisories` | Stored advisory metadata |
| GET | `/threat-intelligence/sources` | Feed catalog and connection status |
| GET | `/administration/summary` | Integration, user, audit, and access-review counts |
| GET | `/administration/integrations` | Catalog rows without credentials |
| GET | `/administration/users` | Users, roles, derived privileged flag, and `updated_at` |
| GET | `/administration/roles` | Stored role catalog and derived permission labels |
| GET | `/administration/audit-events` | Append-only audit rows |
| GET | `/administration/access-reviews` | Review status, finding counts, and `updated_at` |
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

`page` starts at 1. `page_size` defaults to 25 and cannot exceed 100. Invalid `page`/`page_size` values return `422`. Out-of-range pages return `200` with `items: []` and the filtered `total`.

### Catalog discovery examples

```http
GET /api/v1/governance/controls?page=1&page_size=25&q=access
GET /api/v1/governance/controls?page=1&page_size=25&framework=NIST-800-53
GET /api/v1/governance/controls?page=1&page_size=25&implementation_status=implemented&sort=title&direction=asc
GET /api/v1/policies?page=1&page_size=25&q=incident
GET /api/v1/policies?page=1&page_size=25&status=draft&sort=updated_at&direction=desc
```

Control/policy `q` is case-insensitive substring search over safe metadata only (not licensed framework prose, evidence bytes, audit rows, or policy version bodies). `total` is the count after search/filters and before offset/limit. Sort keys are server allowlists; arbitrary column names are rejected.

## Errors

```json
{"code": "not_found", "message": "Asset AST-9999 was not found.", "details": null, "request_id": null}
```

Validation uses the same shape with `code` `validation_error` and `details` entries of `loc` and `message`. `request_id` is reserved and is null until request correlation exists. Error bodies do not include stack traces, SQL, or connection strings.

## Security semantics

- Auth uses Argon2id password hashes and opaque session cookies. Domain GET and the documented write routes enforce capability permissions plus CSRF on mutations.
- Role permissions are resolved from the deterministic catalog in `app/security/permissions.py`. Administration role list responses include that catalog (union stored `role_catalog` entitlements).
- A user is privileged when a role is Administrator or Security Engineer.
- Risk `score` is likelihood × impact. `methodology` is `aegisbridge_likelihood_x_impact`. Bands are low 1–4, medium 5–9, high 10–15, and critical 16–25.
- `cvss_severity` is a label for the CVSS base score only. There is no combined vulnerability score.
- KEV exposure counts internet-exposed assets that have a KEV row. It does not add CVSS or EPSS.
- Alert rows set `stored_scope` to `selected_metadata` and `source_of_record` to `wazuh`. Raw events are not stored or returned.
- Evidence responses include SHA-256 metadata and omit object-storage URIs, object keys, and credentials. After a successful object upload, `object_stored` is true and `hash_source` is `server_calculated_at_ingestion`. `integrity_verified` remains false (ingestion hash ≠ independent re-verification). Malware scanning is not implemented.
- Evidence metadata create accepts optional caller-supplied SHA-256 (exactly 64 hex). Object upload calculates SHA-256 from stored bytes. Public object URLs are never issued.
- Governance sets `licensed_text_included` to false. Control codes and stored titles are returned. CIS licensed text is not.
- Control tests are manually recorded development data (`recording_mode: manual`). Notes include `[manual development recording]`. They are not automated assessments.
- Governance summary counts (implementation by status, `tests_recorded`, evidence freshness) are derived from stored rows after writes.
- Policies use closed lifecycle statuses `draft` → `in_review` → `approved` → `published` → `retired` (plus `published` → `published` to replace the current version). Version statuses are `draft`, `published`, and `superseded`. Published/superseded content is immutable. Acknowledgements bind to a specific published version and remain after supersession. Acknowledgement responses expose counts only (no invented completion percentage). Policy↔control mappings are relationship-only (`policy_control_mappings`); responses never duplicate licensed CIS text (`licensed_text_included=false`). Unlink removes the relationship only. External e-signature and email workflows are unsupported.
- Policy permissions: `policy.read` (read + self-acknowledge + view mappings), `policy.manage` (create/edit drafts and metadata; draft↔in_review; link/unlink controls), `policy.approve` (approve/publish/retire; sensitive).
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
