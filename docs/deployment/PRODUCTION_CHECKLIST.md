# Production checklist

This prepares a first public portfolio deployment. It does not create hosting accounts, buckets, DNS, or an administrator.

Local, test, and production are different:

| | Local | Test | Production |
|---|---|---|---|
| `APP_ENV` | `local` | `test` | `production` |
| Database | `DATABASE_URL` | `TEST_DATABASE_URL` only | `DATABASE_URL` on managed PostgreSQL |
| Cookies | Secure off unless set | Secure off unless set | Secure, HttpOnly, SameSite=Lax |
| HSTS | not sent | not sent | `max-age=15552000` on https responses |
| Host check | open when `TRUSTED_HOSTS` is empty | open | explicit hostnames |
| Forwarded headers | ignored when `FORWARDED_ALLOW_IPS` is empty | ignored | trusted proxy only |
| Seed | `python -m app.db.seed` | tests call the seed function | refused unless `--demo` |
| Dev admin password | required for seed | optional | startup fails if set |

## Topology

```text
Browser
  -> HTTPS static frontend
  -> HTTPS API
       -> managed PostgreSQL
       -> managed Redis/Valkey broker
       -> private Cloudflare R2
       -> NVD, CISA KEV, FIRST EPSS, ThreatFox, URLhaus

Separate processes:
  web
  Celery worker on intelligence,integrations
  one Celery Beat scheduler

Private Lenovo / Wazuh
  not a public inbound dependency
  WAZUH_ENABLED=false until an outbound path exists
```

The platform proxy terminates TLS. The API process trusts `X-Forwarded-Proto` and `X-Forwarded-For` only from `FORWARDED_ALLOW_IPS`. Use `*` only when that proxy is the only path to the process. The app does not redirect HTTP to HTTPS itself, so an internal health check on HTTP does not loop. Public HTTP is redirected by the host.

## Required settings

- `APP_ENV=production`
- `DATABASE_URL` for managed PostgreSQL, not localhost
- `SESSION_SECRET` at least 32 characters and not the sample value
- `PUBLIC_API_URL` https
- `TRUSTED_HOSTS` explicit API hostnames, including the public API host
- `FORWARDED_ALLOW_IPS`
- `CORS_ORIGINS` explicit https frontend origins, never `*`
- `CELERY_BROKER_URL` private `redis://` or `rediss://`, not localhost
- R2: `OBJECT_STORAGE_PROVIDER=r2`, https `S3_ENDPOINT_URL` on `r2.cloudflarestorage.com`, private `S3_BUCKET`, and the R2 S3 token in `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`

Missing R2 configuration fails process startup. An unreachable bucket does not fail API readiness. Readiness requires PostgreSQL only.

## Optional settings

- `NVD_API_KEY`
- `ABUSECH_AUTH_KEY` (ThreatFox and URLhaus skip, without a failed run, until this is set and indicator sync is enabled)
- `HF_TOKEN`
- Wazuh indexer URL, username, and password, only when `WAZUH_ENABLED=true`

## Secret inventory

Set these in the host secret store. Do not commit them.

- `DATABASE_URL`
- `SESSION_SECRET`
- `CELERY_BROKER_URL` and `REDIS_URL` when they embed a password
- `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` (R2)
- `ABUSECH_AUTH_KEY` when indicator sync is used
- `NVD_API_KEY` when used
- `WAZUH_USERNAME` and `WAZUH_PASSWORD` when Wazuh is later enabled
- `HF_TOKEN` when a gated dataset download needs it
- `BOOTSTRAP_ADMIN_PASSWORD` for the one-time bootstrap command, then remove it

`VITE_API_BASE_URL` is public. It must be the https API origin at frontend build time. It must not contain a credential.

## Processes

The launch sequence is `docs/deployment/FIRST_PRODUCTION_LAUNCH.md`. Every command below assumes the repository root as the working directory and `PYTHONPATH=apps/api`. `uv run` from the root does not import `app` without that path.

```text
uv run --project apps/api alembic upgrade head
uv run --project apps/api uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips "$FORWARDED_ALLOW_IPS"
uv run --project apps/api celery -A app.workers.celery_app:celery_app worker --loglevel=info --pool=solo -Q intelligence,integrations
uv run --project apps/api celery -A app.workers.celery_app:celery_app beat --loglevel=info --schedule /tmp/celerybeat-schedule
```

The API pre-deploy command is the only migration. A failed migration stops that deploy. Workers do not migrate. Do not run `alembic downgrade` against production. The worker listens to `intelligence` and `integrations` and uses the solo pool. Run one Beat process. Its schedule file is ephemeral. Vulnerability intelligence is 06:00 UTC daily. Indicator sync is 00:15, 06:15, 12:15, and 18:15 UTC, and the blueprint leaves it disabled until an abuse.ch key is added. Wazuh remains every five minutes and returns before any network call while disabled.

Celery accepts JSON only. Results are not stored in the broker.

Frontend, from the repository root, with `VITE_API_BASE_URL` set to the same public https origin as `PUBLIC_API_URL`:

```text
pnpm install --frozen-lockfile
AEGIS_REQUIRE_PUBLIC_API=1 pnpm --filter @aegisbridge/web build
```

That build rejects a localhost API URL. It writes `dist/content-security-policy.txt` and adds the same policy to `index.html`. `connect-src` is `'self'`, that API origin, the Google Fonts hosts already referenced by `index.html`, and `https://www.gstatic.com` for the self-hosted Spline scene's Draco decoder. The sign-in scene stays self-hosted. The policy allows `'wasm-unsafe-eval'` and inline styles. It does not allow a source wildcard or `'unsafe-eval'`.

The blueprint copies `VITE_API_BASE_URL` and `PUBLIC_API_URL` from the API service's `RENDER_EXTERNAL_URL` for the first `onrender.com` launch. That value already includes `https://`. A custom domain later replaces those references; the blueprint cannot strip or join a hostname itself. `render.yaml` does not contain a Content-Security-Policy. After the production build, copy `apps/web/dist/content-security-policy.txt` to the static site response header. The response header is authoritative. The meta tag cannot enforce `frame-ancestors`. `X-Frame-Options: DENY` stays in the blueprint.

Serve `apps/web/dist` with a rewrite of unknown paths to `index.html`. Cache hashed files under `/assets/` for a long time. Do not cache `index.html` indefinitely.

## Data

Do not run the development seed from a production start command.

- Empty organization: `uv run --project apps/api python -m app.bootstrap` from the repository root, with `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` set in the environment. It refuses to replace an existing password. It is not an HTTP endpoint. Remove both variables after the first sign-in.
- Portfolio demo: `python -m app.db.seed --demo` after the migration. That flag does not apply `AEGIS_DEV_ADMIN_PASSWORD`. Set the first password with bootstrap only when that email has no credential yet.

## Review command

```text
PYTHONPATH=apps/api uv run --project apps/api python -m app.production_check --deployment
```

Exit 0 only when `APP_ENV=production` and the required settings pass. `--deployment` also checks this repository's pins and blueprint. `--connectivity` then runs read-only probes and is separate from the configuration result. The output does not include secret values.

## Checklist

Repository items below are done. Everything that needs a live account stays open.

### Pre-resource

- [x] Python 3.14.8 pinned in `.python-version` and `PYTHON_VERSION`
- [x] Node 24.22.0 and pnpm 10.18.2 pinned for the frontend build
- [x] Blueprint commands, one Beat process, both queues, and one migration command reviewed
- [x] Frontend CSP generated from the public API origin, not stored in `render.yaml`
- [x] No automatic seed or bootstrap
- [ ] Operator has a Render account and a Cloudflare account

### Resource created

- [ ] Blueprint imported
- [ ] Private Postgres and private Key Value exist
- [ ] Private R2 bucket exists

### Configured

- [ ] R2 endpoint, bucket, and scoped token entered on the API service
- [ ] `SESSION_SECRET` generated once and shared with worker and Beat
- [ ] `PUBLIC_API_URL`, `TRUSTED_HOSTS`, `CORS_ORIGINS`, and `VITE_API_BASE_URL` come from the assigned HTTPS origins

### Pre-launch

- [ ] `python -m app.production_check --deployment` reports ready
- [ ] Optional `--connectivity` reports the database, broker, and bucket reachable
- [ ] No `AEGIS_DEV_ADMIN_PASSWORD`

### Post-launch

- [ ] API liveness and readiness succeed
- [ ] Migration applied once by the API pre-deploy command
- [ ] Worker and one Beat process are running
- [ ] Empty organization bootstrapped, then `BOOTSTRAP_ADMIN_PASSWORD` removed
- [ ] Frontend CSP response header copied from `dist/content-security-policy.txt`
- [ ] Security headers and the smoke tests in the launch runbook pass
- [ ] Wazuh remains disabled
- [ ] Indicator sync stays disabled until its key is added
- [ ] Database backup and rollback path are known

## Still later

MFA, SSO, password reset, a shared rate limiter, the Lenovo lab bridge, SIEM notifications, APM, backup restore drills, multi-region hosting, and blue/green releases.
