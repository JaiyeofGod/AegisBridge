# First production launch

This is the operator sequence for the first public portfolio deployment. It does not create accounts, buckets, databases, or users by itself. Importing `render.yaml` is the step that creates Render resources. Do that only when this runbook is being executed on purpose.

The blueprint is the source for service shape. This file is the source for order, secrets, and checks.

## Prerequisites

- Render account that can create a Blueprint, a web service, two workers, Key Value, and Postgres.
- Cloudflare account that can create a private R2 bucket and a scoped token.
- Repository commit that contains `.python-version` `3.14.8`, `render.yaml`, and this file.
- No custom domain yet. The first launch uses the `onrender.com` URLs Render assigns.

Runtime pins:

| Piece | Pin |
|---|---|
| Python | 3.14.8, in `.python-version` and `PYTHON_VERSION` |
| uv | 0.13.3, installed by the build command |
| Node | 24.22.0, `NODE_VERSION` on the static site |
| pnpm | 10.18.2, root `packageManager` |
| PostgreSQL | 18 |

## Topology

```text
Browser
  -> aegis-web static site (CDN)
  -> aegis-api web service
       -> aegis-postgres (private)
       -> aegis-broker Key Value (private)
       -> private Cloudflare R2
       -> NVD, CISA KEV, and FIRST EPSS when vulnerability sync runs

aegis-worker  listens to intelligence,integrations
aegis-beat    one scheduler
```

All private Render resources are in Oregon. The static site is global and is not on the private network. The browser calls the public API.

`FORWARDED_ALLOW_IPS=*` is intentional. Render does not publish a stable proxy CIDR, and public clients cannot open a socket to the instance. Private-network clients in this blueprint are the worker and Beat. The application does not redirect HTTP to HTTPS. HSTS is `max-age=15552000` with no `includeSubDomains` and no preload.

## Resource creation

1. Create a private R2 bucket. Leave it private. Do not attach a public domain.
2. Create an R2 API token limited to that bucket, with Object Read and Object Write. Do not grant account-wide admin.
3. In Render, create a Blueprint from `render.yaml`. That creates:
   - Postgres `aegis-postgres` on plan `0.1c-256mb`, major version 18, empty public IP allow list
   - Key Value `aegis-broker` on plan `256mb`, `noeviction`, empty public IP allow list
   - Web service `aegis-api`
   - Worker `aegis-worker`
   - Worker `aegis-beat`
   - Static site `aegis-web`

The internal Postgres URL uses `postgres://` and does not set `sslmode`. The application rewrites that scheme to `postgresql+psycopg` and does not add TLS parameters. Use this internal URL. Do not switch the services to the external URL, and do not append `sslmode` yourself. Traffic stays on Render's private network.

The Key Value URL is an internal `redis://` string. Both `CELERY_BROKER_URL` and `REDIS_URL` reference it, so the processes cannot fall back to a loopback default.

Postgres has no PgBouncer in front of it. Each of the API, worker, and Beat processes uses `DB_POOL_SIZE=2` and `DB_MAX_OVERFLOW=1`. That is nine connections at the ceiling. Alembic uses a separate short-lived connection during pre-deploy, before the new API process starts.

## Secrets and configuration

Enter the operator values on `aegis-api` when the Blueprint asks. Worker and Beat copy `SESSION_SECRET` and the R2 values. `PUBLIC_API_URL`, `TRUSTED_HOSTS`, and `CORS_ORIGINS` on the worker and Beat point at the original Render URLs, not at the API copies of those URLs. The static site does not receive database, broker, session, or R2 values.

| Variable | Class | Where it is set |
|---|---|---|
| `APP_ENV`, `PYTHON_VERSION`, `PYTHONPATH`, pool sizes, `WAZUH_ENABLED`, `THREAT_INTEL_SYNC_ENABLED`, `OBJECT_STORAGE_PROVIDER`, `S3_REGION`, `FORWARDED_ALLOW_IPS` | Literal config | Blueprint |
| `DATABASE_URL` | `fromDatabase` internal URL | Blueprint |
| `CELERY_BROKER_URL`, `REDIS_URL` | `fromService` Key Value URL | Blueprint |
| `SESSION_SECRET` | `generateValue: true` on the API, copied outward | Render keeps the generated value across deploys |
| `PUBLIC_API_URL` | API `RENDER_EXTERNAL_URL` | Full `https://` origin Render assigns |
| `TRUSTED_HOSTS` | API `RENDER_EXTERNAL_HOSTNAME` | Hostname only |
| `CORS_ORIGINS` | Static site `RENDER_EXTERNAL_URL` | Frontend origin |
| `VITE_API_BASE_URL` | API `RENDER_EXTERNAL_URL` | Build-time public value on the static site |
| `S3_ENDPOINT_URL`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Operator values, `sync: false` | Dashboard, then copied to worker and Beat |

`VITE_*` values are public and are baked in at frontend build time. Backend secrets are runtime values. Do not put a database URL, broker URL, session secret, or R2 token in a `VITE_` variable.

`SESSION_SECRET` is generated once. Deploys do not rotate it. Deleting and recreating the API service would. Worker and Beat must copy that one value. Do not give them their own `generateValue`.

Beat imports the same production settings as the API, so it needs the database, broker, session secret, public origin, and R2 configuration even though it only publishes schedules. That duplication is required by startup validation. Beat does not need the abuse.ch key or the NVD key.

NVD, abuse.ch, Hugging Face, and Wazuh credentials are absent on purpose. Add them later, on the worker, only when that integration is turned on.

R2 endpoint shape: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`. Region is `auto`. The bucket name must not be the development bucket.

## Working directory

Render builds and starts Python services with the repository root as the working directory.

| Service | Root | Build | Start |
|---|---|---|---|
| `aegis-api` | repository root | `pip install 'uv==0.13.3' && uv sync --project apps/api --frozen --no-dev` | uvicorn on `0.0.0.0` and `$PORT` |
| `aegis-worker` | repository root | same install | celery worker, `--pool=solo`, queues `intelligence,integrations` |
| `aegis-beat` | repository root | same install | celery beat, schedule file `/tmp/celerybeat-schedule` |
| `aegis-web` | repository root | `corepack enable && pnpm install --frozen-lockfile && AEGIS_REQUIRE_PUBLIC_API=1 pnpm --filter @aegisbridge/web build` | static files from `apps/web/dist` |

`PYTHONPATH=apps/api` is set because `uv run` from the repository root does not import the `app` package on its own. Alembic still runs at the root so it finds `alembic.ini` and `migrations/`.

The static publish path is relative to the repository root. Render serves a real file before the `/*` rewrite, so hashed `/assets/` files are not replaced with `index.html`.

## Preflight

On the API shell, after the operator values are saved and before relying on the release:

```text
python -m app.production_check --deployment
```

The shell already has the service environment, including `PYTHONPATH`. Exit 0 means the production settings and the repository blueprint are acceptable. The output names settings. It does not print secret values.

Then, only if those settings are valid:

```text
python -m app.production_check --connectivity
```

This runs `SELECT 1`, a broker `PING`, and a bucket head or a one-key list. It does not insert rows, upload objects, or call NVD, abuse.ch, or Wazuh. Configuration validity and network reachability are separate results.

## Migration

The API `preDeployCommand` is:

```text
uv run --project apps/api alembic upgrade head
```

It runs after the build and before the new API starts, on a separate deploy instance. If it fails, the new deploy does not go live. Worker and Beat do not have a pre-deploy command. Do not put seed or bootstrap there.

## Launch order

1. Save the R2 values on the API service.
2. Let the Blueprint create the private database, broker, and services.
3. Run `--deployment`, then `--connectivity`.
4. Deploy the API. Pre-deploy migrates. The platform health check is `GET /api/v1/health/live`.
5. Confirm `GET /api/v1/health/ready`. Readiness requires Postgres only. A down broker or bucket makes the API unready only for those components; it does not replace the API.
6. Deploy the worker, then one Beat process.
7. Deploy the static site. Its build receives `VITE_API_BASE_URL` from the API's public URL.
8. Bootstrap the administrator.
9. Copy the generated CSP response header.
10. Run the smoke tests.
11. Leave scheduled indicator sync and Wazuh off.

The API keeps serving if the worker is down. Scheduled feeds then go stale. Readiness does not require Celery.

## Admin bootstrap

Recommended first launch: an empty organization and one administrator. Do not run the demo seed for this launch.

On the API service only, set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` in the environment. The password is 12 to 1024 characters, is not the email, and is not a known weak value. Then, from the repository root on that service:

```text
uv run --project apps/api python -m app.bootstrap
```

The command prints whether it created the account or set a missing password. It does not print the password. Sign in through the static site. Then delete `BOOTSTRAP_ADMIN_PASSWORD` and `BOOTSTRAP_ADMIN_EMAIL` from the service environment and redeploy, or remove them before the next deploy, so the password is not kept.

`AEGIS_DEV_ADMIN_PASSWORD` must stay unset.

## Demo data

Do not load demo data on the first public launch. There is no safe shared demo password.

A later private walkthrough can run `uv run --project apps/api python -m app.db.seed --demo` only after accepting simulated records. That flag does not apply the development admin password. If the database is still empty, bootstrap remains the way to set the administrator password. Do not run bootstrap and `--demo` in an order that tries to replace an existing password.

Simulated, external-feed, manual, and derived research records already carry their own origin labels in the product UI. This launch does not change those labels.

## CSP header

The production frontend build writes `apps/web/dist/content-security-policy.txt` and the same policy as a meta tag. `connect-src` is `'self'`, the API origin, the two Google Fonts hosts already used by `index.html`, and `https://www.gstatic.com` for the self-hosted Spline scene's Draco decoder.

The meta tag does not enforce `frame-ancestors`. After the build, set the static site response header `Content-Security-Policy` to that exact line. The response header is authoritative when both are present. They are generated from the same string, so they do not conflict. `X-Frame-Options: DENY` remains.

Other static response headers already in the blueprint: nosniff, `no-referrer`, `DENY`, HSTS without preload, and the same Permissions-Policy as the API.

## Smoke tests

Set `API` and `WEB` in the shell to the assigned `https://` origins. Do not put secrets in these commands.

```text
curl -sI "$WEB"
curl -sI "$WEB/reports"
curl -sI "$API/api/v1/health/live"
curl -sI "$API/api/v1/health/ready"
```

Expect the static responses to include nosniff, `no-referrer`, `DENY`, HSTS `max-age=15552000`, and, after the CSP step, `frame-ancestors 'none'`. Expect `/reports` to return the application HTML rather than a 404. Expect liveness `200`. Expect readiness `200` when Postgres is up.

API responses should include the API CSP `default-src 'none'`, nosniff, `no-referrer`, `DENY`, and HSTS on HTTPS. A request with `Host: invalid.invalid` should be rejected. A browser origin other than `CORS_ORIGINS` should not receive an allow-origin header.

Then sign in as the bootstrapped administrator. The session cookie is `Secure` and `HttpOnly`. A state-changing request without `X-CSRF-Token` fails. Sign-out clears the session. Open Overview, Risks, Assets, Vulnerabilities, SOC, Incidents, Governance, Threat Intelligence, and Reports. The research view for RSCH-0005 renders when that stored experiment is present. Do not create records only to prove the pages load.

Vulnerability intelligence can refresh tracked CVEs without an NVD key. Indicator rows stay empty until indicator sync is enabled with a key. Wazuh stays empty. An authorized evidence or artifact download is optional and must use an existing object, not a new upload, unless you are deliberately testing storage.

## Scheduled jobs

| Job | Schedule | Launch behavior |
|---|---|---|
| Vulnerability intelligence | 06:00 UTC daily | Enabled. NVD key is optional and only raises the public rate limit. |
| ThreatFox and URLhaus | 00:15, 06:15, 12:15, 18:15 UTC | Blueprint sets `THREAT_INTEL_SYNC_ENABLED=false`. Turning it on without `ABUSECH_AUTH_KEY` skips the run and does not record a failure. |
| Wazuh | every five minutes | `WAZUH_ENABLED=false`. The task returns before any network call. |

Queues are `intelligence` and `integrations`. The default queue is `intelligence`. No task is routed to `celery`, `research`, or `datasets`.

Beat's schedule file under `/tmp` is lost on restart. A restart can run a due job once. The schedule itself lives in code. Do not run a second Beat process.

Hugging Face is not required for serving. Research reads stored artifacts.

## Custom domain later

Keep the `onrender.com` URLs until a domain is chosen. `RENDER_EXTERNAL_URL` is the `onrender.com` origin, not a custom domain. When a domain is added, replace these with the public `https://` origins and hostnames:

- `PUBLIC_API_URL`
- `TRUSTED_HOSTS`, including the API hostname browsers will send
- `CORS_ORIGINS`
- `VITE_API_BASE_URL`, then rebuild the static site
- the CSP response header, from the new `dist/content-security-policy.txt`

Do not add HSTS preload or `includeSubDomains` as part of that change unless the domain policy is decided separately.

## Rollback

- Take a Postgres backup before the first migration and before later schema releases.
- Roll the API, worker, or static site back to the previous Render deploy when the application is at fault and the database schema is still compatible.
- If a migration is not compatible with the previous code, restore the database backup or ship a forward fix. Do not run `alembic downgrade` as the rollback.
- Stop Beat first, then the worker, when stopping background work. Stopping them does not roll back the database.
- R2 objects are outside the app deploy. Rolling back the app does not delete them.
- The session secret survives a normal rollback. Recreating the API service generates a new one and signs everyone out.

## Post-launch secret cleanup

- Remove `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`.
- Confirm `AEGIS_DEV_ADMIN_PASSWORD` is absent.
- Confirm the R2 token cannot administer other buckets.
- Leave NVD, abuse.ch, Hugging Face, and Wazuh credentials unset until those features are intentionally enabled.
