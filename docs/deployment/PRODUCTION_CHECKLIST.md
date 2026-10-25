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
- `ABUSECH_AUTH_KEY` (ThreatFox and URLhaus fail closed without it)
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

From the repository root, after `uv sync --project apps/api --frozen --no-dev`:

```text
uv run --project apps/api alembic upgrade head
uv run --project apps/api uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips "$FORWARDED_ALLOW_IPS"
uv run --project apps/api celery -A app.workers.celery_app:celery_app worker --loglevel=info -Q intelligence,integrations
uv run --project apps/api celery -A app.workers.celery_app:celery_app beat --loglevel=info
```

Run the migration once per release, before new processes start. A failed migration stops the release. Do not start a second copy of the web process that also migrates, and do not run `alembic downgrade` against production. The worker must listen to both `intelligence` and `integrations`. The Celery app pins the solo pool for Python 3.14. Run exactly one Beat process. Beat keeps the current cadence: vulnerability intelligence daily at 06:00 UTC, ThreatFox and URLhaus at 00:15, 06:15, 12:15, and 18:15 UTC, and the Wazuh poll every five minutes. The Wazuh task returns before any network call while it is disabled.

Celery accepts JSON only. Results are not stored in the broker.

Frontend, from `apps/web`, with `VITE_API_BASE_URL` set to the same public https origin as `PUBLIC_API_URL`:

```text
pnpm install --frozen-lockfile
AEGIS_REQUIRE_PUBLIC_API=1 pnpm build
```

That build rejects a localhost API URL. It writes `dist/content-security-policy.txt` and adds the same policy to `index.html`. `connect-src` is `'self'`, that API origin, and the Google Fonts hosts already referenced by `index.html`. The sign-in scene stays self-hosted. The policy allows `'wasm-unsafe-eval'` and inline styles. It does not allow a source wildcard or `'unsafe-eval'`.

Render blueprint headers are literal strings, so `render.yaml` does not contain a Content-Security-Policy or an API hostname. After this build, set the static site response header `Content-Security-Policy` to the single line in `dist/content-security-policy.txt`. A meta tag cannot enforce `frame-ancestors`. `X-Frame-Options: DENY` remains in the blueprint until that response header is in place, and the generated policy includes `frame-ancestors 'none'`.

Serve `apps/web/dist` with a rewrite of unknown paths to `index.html`. Cache hashed files under `/assets/` for a long time. Do not cache `index.html` indefinitely.

## Data

Do not run the development seed from a production start command.

- Empty organization: `python -m app.bootstrap` with `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` set in the environment. It refuses to replace an existing password. It is not an HTTP endpoint.
- Portfolio demo: `python -m app.db.seed --demo` after the migration. That flag does not apply `AEGIS_DEV_ADMIN_PASSWORD`. Set the first password with bootstrap only when that email has no credential yet.

## Review command

```text
cd apps/api && uv run python -m app.production_check
```

Exit 0 only when `APP_ENV=production` and the required settings pass. The output does not include secret values.

## Checklist

- [ ] Public URLs are HTTPS
- [ ] Secure, HttpOnly session cookies
- [ ] HSTS without preload
- [ ] API CSP from the application, and the frontend response header copied from `dist/content-security-policy.txt` after the production build
- [ ] Explicit CORS origins
- [ ] Trusted hosts
- [ ] Forwarded headers limited to the platform proxy
- [ ] Managed PostgreSQL
- [ ] Managed private broker
- [ ] Private R2 bucket
- [ ] Secrets in the host store, not in git
- [ ] `python -m app.production_check` reports ready
- [ ] `alembic upgrade head` applied once
- [ ] Bootstrap or an intentional `--demo` seed, not both by accident
- [ ] No `AEGIS_DEV_ADMIN_PASSWORD`
- [ ] Web, worker, and one Beat process
- [ ] Wazuh left disabled unless its indexer is private
- [ ] Database backup, R2 retention, and secret rotation are known
- [ ] Rollback is a restored backup or a forward fix, not an automatic downgrade

## Still later

MFA, SSO, password reset, a shared rate limiter, the Lenovo lab bridge, SIEM notifications, APM, backup restore drills, multi-region hosting, and blue/green releases.
