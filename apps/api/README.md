# AegisBridge API (`apps/api`)

FastAPI service with Phase 2 domain models, session authentication, enforced RBAC on domain reads, synchronizer CSRF, and authenticated writes for account preferences, risk treatment, incidents, vulnerability remediation, administration, governance, evidence (including private objects), **policy lifecycle / versioning / acknowledgement**, **policy↔control mapping**, and **incident response tasks**. `GET /api/v1/directory/users` is a read-only operational picker (`directory.read`) of active users in the caller's organization. Administration remains the only place for account, role, and status changes. Object storage uses an S3-compatible abstraction (SeaweedFS locally / Cloudflare R2 hosted). Frontend guards are UX only. Integration/report/cyber-range writes, SSO/MFA, and rate limiting remain deferred. Task completion does not close an incident. Automated containment and SOAR are not implemented. The incident task assignee picker reads this directory.

## Commands

From this directory:

```bash
uv sync
uv run ruff check app tests
uv run ruff format --check app tests
uv run pyright
uv run python -m app.db.test_db ensure
uv run pytest

# Run API against Compose Postgres (repo-root `.env`)
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Host-run worker and scheduler. Valkey must be listening on REDIS_URL.
# Upgrade the development database before the first worker start (`alembic upgrade head`).
uv run celery -A app.workers.celery_app:celery_app worker --loglevel=info -Q intelligence,integrations --pool=solo
uv run celery -A app.workers.celery_app:celery_app beat --loglevel=info
```

Alembic (from repository root, with `apps/api` venv active or `uv run` from `apps/api`):

```bash
cd ../..
uv run --project apps/api alembic upgrade head
uv run --project apps/api alembic downgrade 20261020_0005
uv run --project apps/api alembic upgrade head
uv run --project apps/api alembic current
uv run --project apps/api python -m app.db.seed
uv run --project apps/api python -m app.db.seed --reset
```

The empty baseline remains `20261020_0001`. Domain tables are `20261020_0002`. Threat-intelligence tables and `integrations.human_id` are `20261020_0003`. Report definitions and dataset registry metadata are `20261020_0004`. Cyber-range catalog tables and detection metadata columns are `20261020_0005`. Local credentials and sessions are `20261020_0006`. CSRF digests and `user_preferences` are `20261020_0007`. Control-test public ids (`control_tests.human_id`) are `20261020_0008`. Evidence object metadata (`evidence_objects`) is `20261020_0009`. Policy version lifecycle (`policy_versions.status`, `change_summary`, policy status check) is `20261020_0010`. Policy↔control relationship table (`policy_control_mappings`) is `20261020_0011`. Risk↔control relationship table (`risk_control_mappings`) is `20261020_0012`. Incident task public ids and completion time (`incident_tasks.human_id`, `completed_at`) are `20261020_0013`. Vulnerability intelligence provenance is `20261024_0014`. Synchronization run records (`intelligence_sync_runs`) are `20261024_0015`. The pinned ATT&CK Enterprise catalog is `20261024_0016`. ThreatFox and URLhaus indicator columns are `20261024_0017`. Wazuh alert provenance and `integration_sync_runs` are `20261024_0018`. Research-dataset provenance on `dataset_versions` is `20261024_0019`. Seed data is not in the migration. Re-running the seed ensures contract rows when the organization already exists.

### Vulnerability intelligence sync

Daily at 06:00 UTC, Celery Beat enqueues `intelligence.sync_vulnerability_intelligence` on the `intelligence` queue. The worker loads tracked CVE identifiers, then calls NVD once per CVE, downloads the CISA KEV catalog once, and requests FIRST EPSS in batches of at most 100. Successful source updates are stored. A failed source keeps the previous values. One missing EPSS row is not a source failure. The run is recorded in `intelligence_sync_runs` with status `completed`, `partial`, or `failed`. A second overlapping run exits as skipped while the Valkey lock is held. The lock expires if a worker stops. This path does not write an audit event for a person and does not change remediation, asset context, or `action_decision`. There is no combined score. The manual refresh endpoint remains.

Worker health is separate from API readiness. `GET /api/v1/health/ready` still requires only PostgreSQL. Redis/Valkey is optional.

Not in this phase: scheduler UI, source-health dashboard, refresh-history UI, notification rules, worker autoscaling, scheduled ATT&CK refresh, dataset download workers, and a production managed queue.

### Wazuh alert metadata

Beat enqueues `soc.sync_wazuh_alerts` every five minutes on the `integrations` queue. The task has no arguments. `WAZUH_ENABLED` defaults to false, and a disabled run returns before Valkey or the indexer is contacted. A configured run searches the Wazuh indexer index `wazuh-alerts*` for the last 15 minutes, at most 500 hits (hard maximum 1000). Selected fields are written to `alert_references`. Repeated polls deduplicate on the Wazuh alert id. Rule level is stored as `source_rule_level` and is not converted into severity; ingested rows use severity `not_assigned` and status `new`. No incident is created. ATT&CK ids present on `rule.mitre.id` are stored as text. Unknown ids do not fail the batch. `full_log` and Windows event XML are not stored. The lock key is `aegis:lock:wazuh_alert_sync`. Poll counts go to `integration_sync_runs`. A successful read sets the Wazuh catalog row to `configured` and freshness `healthy`. Authentication failure or a timeout leaves existing alerts unchanged.

The indexer URL is `WAZUH_INDEXER_URL`. This is not the manager API on port 55000. TLS verification defaults to on. `WAZUH_VERIFY_TLS=false` applies only outside production. The password stays in the environment.

Future only: Lenovo Wazuh deployment, Windows Sysmon and Linux agents, Suricata, file integrity monitoring, agent inventory, acknowledgement sync, rule management, detection correlation, IOC enrichment, Wazuh vulnerability data, SOC frontend provenance, an outbound lab bridge, and a push or webhook path.

### Research datasets

`python -m app.datasets ingest DS-0006` ingests the approved PhreshPhish source. The catalog id selects `phreshphish/phreshphish`. The command records the Hugging Face commit before any file transfer and stops when the declared Parquet size exceeds `DATASET_MAX_DOWNLOAD_BYTES` (default 512 MiB). A transfer that stays under the cap is written to a temporary directory, hashed in chunks, checked as Parquet with the PhreshPhish columns, profiled up to `DATASET_MAX_PROFILE_ROWS`, and uploaded with `app/storage`. The object key is `datasets/{dataset_id}/{revision}/{sha256-prefix}/{filename}`. Temporary files are removed after success and failure. The same ready revision is not downloaded again. A failed revision leaves an older ready revision in place. PostgreSQL stores provenance and the profile, not rows. `GET /datasets/{id}` adds that metadata. The list route does not. There is no ingest HTTP route and no Beat job. `HF_TOKEN` is optional and is sent only as a Bearer header to Hugging Face hosts.

Integrity wording: SHA-256 calculated by AegisBridge at ingestion.

Future only: an experiment runner, training jobs, feature extraction, a fixed PhreshPhish feature-indexing rerun, comparison across datasets, revision checking, background downloads, a dataset profile screen, downloadable experiment reports, a model registry, and an experiment reproducibility bundle. The earlier adapted 79% CPU baseline is not rewritten into this pipeline.

### ThreatFox and URLhaus

Beat enqueues `intelligence.sync_threat_intelligence_iocs` at 00:15, 06:15, 12:15, and 18:15 UTC on the `intelligence` queue. The task has no arguments. It reads recent ThreatFox indicators (`days` defaults to 1, maximum 7) and the URLhaus recent URL list. Each source persists at most 500 rows per run. Set `ABUSECH_AUTH_KEY` to the community key from auth.abuse.ch. The key is an `Auth-Key` header, never a URL path. Without the key the run is `failed` and existing indicators stay. If one source fails, the other source is still stored and the run is `partial`. The lock key is `aegis:lock:threat_intelligence_iocs`. Feed content is untrusted text. A stored URL or indicator is not a compromise, an infection, or a block. There is no IOC score and no automatic deletion of older rows. The daily vulnerability sync is unchanged.

Future work: indicator provenance in the UI, source-health dashboard, expiry policy, asset and alert correlation, Wazuh enrichment, Sigma relationships, VirusTotal, MISP/TAXII, analyst allowlists and blocklists, notification rules, and automated containment.

### MITRE ATT&CK Enterprise

Pinned release 20.0, STIX 2.1. From `apps/api`:

```bash
uv run python -m app.integrations.attack
```

The command downloads the server-configured bundle, checks the release version, and upserts tactics, techniques, sub-techniques, and tactic links. Bundle SHA-256 is calculated at ingestion. A failed fetch or version mismatch leaves the active release in place. There is no Beat schedule.

`GET /api/v1/attack/tactics`, `GET /api/v1/attack/techniques`, and `GET /api/v1/attack/techniques/{technique_id}` require `threat_intel.read`. Lists omit revoked and deprecated objects unless `include_deprecated=true`. Detail by ATT&CK id still returns those flags. Responses use ATT&CK ids, not database UUIDs. Detection, lab, and indicator rows continue to store technique ids on `attack_techniques`.

Future only: explorer UI, detection foreign keys, incident mapping UI, Sigma, Navigator export, coverage views, version diff, and weekly sync. Wazuh may supply technique ids on an ingested alert; those ids are not inferred and are not foreign keys.

### Policy ↔ control mappings

- Relationship-only rows in `policy_control_mappings` (unique `(policy_id, control_id)`). No control title/text duplication and no licensed CIS safeguard prose.
- `POST /api/v1/policies/{policy_id}/controls/{control_id}` (`policy.manage` + CSRF): link by human ids; duplicate links are idempotent (`linked: true`).
- `DELETE` same path: removes the relationship only (policy, control, evidence, and tests remain). Missing link → `404` (same convention as evidence unlink).
- `GET /policies/{id}` returns mapped controls with `licensed_text_included=false`. `GET /governance/controls/{id}` returns minimal mapped policy refs.
- Frontend mapping UI is not wired yet.

### Evidence object storage

- Bytes live outside PostgreSQL (SeaweedFS S3 locally; R2 in hosted envs).
- `POST /api/v1/evidence/{id}/object` (multipart `file`, `evidence.manage` + CSRF): one object per evidence; server-side SHA-256; max size `EVIDENCE_MAX_UPLOAD_BYTES` (default 25 MiB).
- `GET /api/v1/evidence/{id}/object` (`evidence.read`): authenticated private stream; no public URLs.
- `DELETE /api/v1/evidence/{id}/object` (`evidence.manage` + CSRF): removes object bytes; keeps evidence metadata.
- Malware scanning is not implemented. `integrity_verified` stays false (ingestion hash ≠ independent verification).
- Object storage is an optional health check; platform readiness does not require SeaweedFS.

## Authentication (local)

Settings load the repository-root `.env` (`AegisBridge/.env`) through `app.core.config.Settings`. There is no second dotenv reader in the seed command.

1. Set `AEGIS_DEV_ADMIN_PASSWORD` in that `.env`. There is no default password.
2. Ensure PostgreSQL is running and migrations are at head.
3. From `apps/api`, with the API virtualenv active: `python -m app.db.seed` (or `uv run python -m app.db.seed`).
4. Start FastAPI and sign in as `amara.okonkwo@aegisbridge.example` with the password from the environment.
5. Cookie `aegis_session` is HttpOnly. Use it for `/api/v1/auth/me`, `/api/v1/account/*`, and all domain GET routes.
6. Login returns `csrf_token` (or call `GET /api/v1/auth/csrf`). Send `X-CSRF-Token` on logout and all authenticated PATCH/POST mutations.

Re-running the seed is idempotent. In `local` / `development` / `dev` it rewrites the `USR-0001` Argon2id hash to the current `AEGIS_DEV_ADMIN_PASSWORD` and keeps that user active with the Administrator role. A missing or blank password in those environments stops the seed with `AEGIS_DEV_ADMIN_PASSWORD must be set before seeding development credentials.` Changing the local password requires running the seed again.

`APP_ENV=test` updates the hash only when the variable is set, so tests can use a synthetic password. `APP_ENV=production` never synchronizes this credential. `python -m app.db.seed --check` reports whether the user, credential row, and configured password match, without printing the password or hash.

Pytest sets `APP_ENV=test` and opens `TEST_DATABASE_URL` only. That URL must name a different database from `DATABASE_URL`; the suite refuses to migrate or seed when the two resolve to the same database. The schema comes from Alembic `upgrade head` on the test database. The development database, including the local Administrator hash, is not modified. `APP_ENV=production` ignores `TEST_DATABASE_URL`.

On an existing Compose volume, create the test database once:

```bash
python -m app.db.test_db ensure
python -m app.db.test_db check
```

`ensure` creates the missing test database and never drops the development database. It does not print credentials. PostgreSQL init scripts do not re-run against a volume that already has data.

See `docs/security/AUTHENTICATION_AND_RBAC.md`. Never commit a real password. Production must not bootstrap a default password from this variable.

## Health

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready` (PostgreSQL required; Redis optional)
- `GET /api/v1/health`

## Auth and account

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`
- `GET /api/v1/auth/session`
- `GET /api/v1/auth/csrf`
- `GET /api/v1/auth/me`
- `GET /api/v1/account/profile`
- `GET /api/v1/account/security`
- `GET` / `PATCH /api/v1/account/preferences`
- `GET /api/v1/account/workspace`
- `PATCH /api/v1/risks/{risk_id}/treatment` (`risk.manage` + CSRF)
- `PATCH /api/v1/incidents/{incident_id}` (`incident.manage` + CSRF; `incident.close` to resolve/close)
- `GET|POST /api/v1/incidents/{incident_id}/tasks` and `GET|PATCH /api/v1/incidents/{incident_id}/tasks/{task_id}` (`incident.read` to view, `incident.manage` + CSRF to create/update). Public ids are `TASK-NNNN`. Completing a task does not close the incident. Cancel keeps the row; hard delete is not implemented.
- `PATCH /api/v1/vulnerabilities/{vulnerability_id}/remediation` (`vulnerability.manage` + CSRF)
- `POST /api/v1/vulnerabilities/{vulnerability_id}/intelligence/refresh` (`vulnerability.manage` + CSRF). Looks up one CVE at NVD, matches it against one CISA KEV catalog fetch, and reads FIRST EPSS. CVSS, EPSS, and KEV stay separate fields. Remediation state and `action_decision` are not updated. The daily worker calls the same adapters directly. It does not call this endpoint. Local worker pool is `solo`. Beat may write a local `celerybeat-schedule` clock file; that file is not a user-editable schedule.
- `PATCH /api/v1/administration/access-reviews/{review_id}` (`administration.manage` + CSRF)
- `PATCH /api/v1/administration/users/{user_id}` (`administration.manage` + CSRF; status only)
- `PUT /api/v1/administration/users/{user_id}/roles` (`administration.manage` + `user.role.manage` + CSRF)

## Domain read API

Requires the domain migration, development seed, and a valid session cookie. Contracts: `docs/api/API_CONTRACTS.md`. Permission matrix: `docs/security/AUTHENTICATION_AND_RBAC.md`.

- `GET /api/v1/overview` — authenticated; sections filtered by effective permissions
- `GET /api/v1/assets*` — `asset.read`
- `GET /api/v1/risks*` — `risk.read`
- `GET /api/v1/vulnerabilities*` — `vulnerability.read`. Detail adds `intelligence` for stored NVD, CISA KEV, and FIRST EPSS provenance. The list shape is unchanged. Null fields stay null. This does not refresh external sources.
- `GET /api/v1/alerts*` — `alert.read`
- `GET /api/v1/incidents*` — `incident.read`
- `GET /api/v1/governance/*` — `control.read`
- `GET /api/v1/governance/controls` — paginated catalog; optional `q` (metadata), `framework`, `implementation_status`, allowlisted `sort`/`direction`; `page_size` max 100; no licensed CIS text
- `PATCH /api/v1/governance/controls/{id}/implementation`, `POST .../tests`, `PATCH .../control-tests/{id}` — `control.manage` + CSRF
- `POST|DELETE /api/v1/governance/controls/{id}/evidence/{evidence_id}` — `control.manage` + `evidence.manage` + CSRF
- `GET /api/v1/policies*` — `policy.read`; list supports metadata `q`, `status`, allowlisted `sort`/`direction` (`page_size` max 100; no version bodies in list items)
- `POST /api/v1/policies`, `PATCH /api/v1/policies/{id}`, version create/update — `policy.manage` + CSRF
- `POST /api/v1/policies/{id}/transition` — `policy.manage` or `policy.approve` (transition-specific) + CSRF
- `POST /api/v1/policies/{id}/acknowledge` — self-ack current published version (`policy.read` + CSRF)
- `POST|DELETE /api/v1/policies/{id}/controls/{control_id}` — link/unlink control (`policy.manage` + CSRF); relationship only
- `POST|DELETE /api/v1/risks/{id}/controls/{control_id}` — link/unlink control (`risk.manage` + CSRF, no body). Mapping does not change scores, treatment, or implementation status and does not prove effectiveness. Risk detail `control_mappings` and control detail `risks` use human ids only.
- `GET /api/v1/evidence/{id}` — `evidence.read`; `POST /api/v1/evidence` — `evidence.manage` + CSRF (metadata)
- `POST|GET|DELETE /api/v1/evidence/{id}/object` — upload/download/delete private object (`evidence.manage` for mutations + CSRF; `evidence.read` for download)
- `GET /api/v1/threat-intelligence/*` — `threat_intel.read`
- `GET /api/v1/administration/*` — `administration.read` (+ `audit.read` / `integration.read` where documented)
- `GET /api/v1/reports/*` — `report.read`
- `GET /api/v1/datasets*` / `dataset-experiments*` — `dataset.read`
- `GET /api/v1/cyber-range/*` — `cyber_range.read`

Unauthenticated callers receive `401`. Authenticated callers missing a permission receive `403`. OpenAPI documents a `SessionCookie` security scheme. Path IDs are human-readable (`AST-0007`, `LAB-GW-01`, `SCN-0001`). Cyber-range remains read-only catalog metadata with no execution.
