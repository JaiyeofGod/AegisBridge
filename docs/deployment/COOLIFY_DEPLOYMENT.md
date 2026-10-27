# Coolify production deployment

AegisBridge production runs on one self-hosted Coolify server. The Google Cloud virtual machine is Ubuntu 24.04 with 2 vCPU, 8 GB RAM, and a 50 GB disk. Coolify is already installed. The private GitHub repository is connected through the Coolify GitHub App. Object storage is an existing private Cloudflare R2 bucket.

This is repository preparation only. It does not deploy, create DNS records, change the Google Cloud firewall, or create an administrator.

## Deployment model

Coolify deploys `compose.coolify.yaml` from the repository root. Do not point Coolify at `compose.yaml`. The local Compose file remains the development data plane and includes SeaweedFS. Production does not.

The production stack is:

| Service | Role | Public |
| --- | --- | --- |
| `web` | Nginx serving the built React application | Yes, through Coolify's proxy |
| `api` | Uvicorn on port 8000 | Yes, through Coolify's proxy |
| `worker` | One Celery worker, solo pool, queues `intelligence` and `integrations` | No |
| `beat` | Exactly one Celery Beat scheduler | No |
| `migrate` | One-shot `alembic upgrade head` | No |
| `postgres` | PostgreSQL 18 | No |
| `valkey` | Valkey 8 broker | No |

Coolify's Traefik proxy terminates HTTPS. The Compose file does not publish host ports and does not hard-code a hostname or the Google Cloud IP. Declaring `SERVICE_URL_API_8000` and `SERVICE_URL_WEB_80` tells Coolify to assign domains and route to ports 8000 and 80.

After Coolify parses the file, open the `api` and `web` domain fields and confirm both URLs use `https://`. The frontend build reads `SERVICE_URL_API_8000` as `VITE_API_BASE_URL`. A later hostname change requires a web image rebuild so the Content Security Policy matches the new API origin.

## Required secrets

Set these in Coolify's environment variables for the Compose resource. Do not commit them.

| Name | Source |
| --- | --- |
| `POSTGRES_DB` | Operator. Use `aegisbridge` unless you have a reason to choose another name. |
| `S3_ENDPOINT_URL` | Cloudflare R2 S3 endpoint, `https://<account-id>.r2.cloudflarestorage.com`. |
| `S3_BUCKET` | Private R2 bucket name. |
| `AWS_ACCESS_KEY_ID` | R2 token with object read, write, and delete on that bucket only. |
| `AWS_SECRET_ACCESS_KEY` | Matching R2 secret. |

Coolify generates and stores these because their names appear in the Compose file:

| Name | Use |
| --- | --- |
| `SERVICE_USER_POSTGRES` | Database user |
| `SERVICE_PASSWORD_64_POSTGRES` | Database password |
| `SERVICE_PASSWORD_64_SESSION` | `SESSION_SECRET` |
| `SERVICE_URL_API_8000` | Public API origin |
| `SERVICE_FQDN_API_8000` | API hostname for `TRUSTED_HOSTS` |
| `SERVICE_URL_WEB_80` | Browser origin for `CORS_ORIGINS` |

`OBJECT_STORAGE_PROVIDER=r2` and `S3_REGION=auto` are fixed in the Compose file. `THREAT_INTEL_SYNC_ENABLED=false` and `WAZUH_ENABLED=false` are also fixed. Vulnerability intelligence stays enabled and does not need an NVD key to start. Do not set `ABUSECH_AUTH_KEY`, `NVD_API_KEY`, or `HF_TOKEN` until that feature is intentionally turned on.

The frontend image build receives only `VITE_API_BASE_URL`. It does not receive the database URL, session secret, or R2 credentials.

## Migration

`migrate` uses the API image and runs:

```bash
uv run --project apps/api alembic upgrade head
```

The working directory in the image is `/app`, where `alembic.ini` lives. The command uses the production `DATABASE_URL`. It does not seed data and does not create an administrator.

`api`, `worker`, and `beat` depend on `migrate` completing successfully, and `migrate` depends on PostgreSQL being healthy. Docker Compose v2 waits for that success before starting those three services. The migration is not also encoded as an API startup command, so a later API restart does not run it again.

Coolify should show `migrate` as exited with status 0 after a successful deploy. That is the expected state. `exclude_from_hc: true` keeps that finished container out of Coolify's aggregate health. Do not add a restart policy to keep it running.

`alembic upgrade head` is safe to run again once the database is already at the current head. It is not safe to run two copies at the same time. Keep the service at one replica.

If a Coolify deploy ignores `service_completed_successfully`, do not start `api`, `worker`, or `beat`. Run the same command once in a one-off container from the `aegisbridge-api:production` image, with the production environment and working directory `/app`:

```bash
uv run --project apps/api alembic upgrade head
```

Then start the long-running services. There is no automatic seed and no automatic administrator bootstrap in either path.

## Domain and HTTPS

Use the domains Coolify assigns, or replace them in Coolify with the real DNS names when those names exist. Point DNS at the virtual machine only when you are ready to serve traffic. Coolify requests the certificate through its proxy.

The API trusts forwarded headers from any connecting address (`FORWARDED_ALLOW_IPS=*`) because Traefik is the only public path and it does not have a stable source address. The database and broker ports are not published, but other containers on the Compose network can reach the API directly. Do not publish port 8000 on the host.

The Nginx image sends HSTS with `max-age=15552000` and without `includeSubDomains` or `preload`. Leave preload off so a later hostname move is possible. The API also sends its own response headers. The static Content Security Policy is generated from the API origin at build time and installed as a response header. The meta tag does not enforce `frame-ancestors`; the header does.

## Cloudflare R2

Production object storage is R2. The Compose file does not start SeaweedFS. Evidence and research artifacts are written to the private bucket. The token needs read, write, and delete on that bucket. Do not enable a public `r2.dev` URL.

API liveness does not call R2. A bad R2 key still fails application startup configuration only when the values are missing or still use the local SeaweedFS defaults. A reachable bucket is not required for `/api/v1/health/live`.

## Administrator and demo data

Create the first administrator only after the stack is healthy and you have signed in through the real domain. From a one-off API container, with `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` set in that command's environment and not in the image:

```bash
uv run --project apps/api python -m app.bootstrap
```

Remove both variables after the first successful sign-in. The password is 12 to 1024 characters, must not be the email address, and must not be a shared demo password.

Do not load demonstration data for the first public launch. If a later private demonstration needs it, the explicit command is:

```bash
uv run --project apps/api python -m app.db.seed --demo
```

That command is not part of container startup.

## Worker and Beat

The worker and Beat use the API image. The worker listens only to `intelligence,integrations` and uses the solo pool. Beat writes its schedule to `/tmp/celerybeat-schedule`. That file is ephemeral. The schedules themselves live in the application code. Run exactly one Beat container. A restart can fire a due job once.

ThreatFox and URLhaus polling is off. Wazuh polling is off. The daily vulnerability intelligence job remains scheduled and can run without an NVD API key.

## Persistence

| Volume | Mount | Survives recreation |
| --- | --- | --- |
| `aegis_coolify_postgres_data` | `/var/lib/postgresql` | Yes |
| `aegis_coolify_valkey_data` | `/data` | Yes |

PostgreSQL 18 stores its data under `/var/lib/postgresql`. The Valkey volume keeps the AOF file so a container recreation does not drop every queued job. Valkey is capped at 256 MB and uses `noeviction`, so a full broker refuses writes instead of deleting Celery messages. The database remains the system of record.

R2 is outside the virtual machine. The Beat schedule file is not important state.

## Backups

Back up PostgreSQL with `pg_dump` on a schedule and copy the dump off the virtual machine. A disk snapshot of the Coolify volume is the other copy. Test a restore before relying on either one.

R2 is the object archive. Its durability does not protect the database. Export R2 only when you need a second copy of evidence or research artifacts.

The 50 GB disk holds the system, Coolify, images, build cache, and the database. It will not hold large datasets because those belong in R2, but image builds still need free space. Prune unused Coolify build images after a successful deploy.

## Memory

8 GB is enough for Coolify, Traefik, and this idle stack. It is not enough to rebuild the images, serve the application, and run a large dataset derivation at the same time.

The Compose file sets these ceilings: PostgreSQL 1 GB, Valkey 384 MB, API 1 GB, worker 1536 MB, Beat 512 MB, web 128 MB, and the short-lived migration 768 MB. Those ceilings can overlap above the memory left after Coolify and Ubuntu. That is acceptable for serving because the processes do not peak together. The worker ceiling is the tight one: a dataset near the 512 MB application limit plus NumPy and PyArrow can approach it. Do not train models on this machine.

## Google Cloud trial and a later move

The Google Cloud trial is 90 days. When it ends, the virtual machine can stop or be removed. Treat the trial as temporary capacity.

To move to another VPS:

1. Install Coolify on the new host and connect the same private repository.
2. Restore a PostgreSQL dump into the new `aegis_coolify_postgres_data` volume, or take a dump immediately before the cutover.
3. Keep the same R2 bucket and token. Objects do not move with the virtual machine.
4. Assign the domains in Coolify, update DNS, and rebuild the web image so `VITE_API_BASE_URL` and the Content Security Policy use the new API origin.
5. Confirm `PUBLIC_API_URL`, `TRUSTED_HOSTS`, and `CORS_ORIGINS` follow the new Coolify domains.
6. Run `alembic upgrade head` only if the restored database is behind the deployed code.

Do not enable HSTS preload before that move.

## First deploy checks

1. Coolify resource uses `compose.coolify.yaml`.
2. `POSTGRES_DB` and the four R2 values are set. Generated passwords are still the Coolify values.
3. API and web domains are HTTPS.
4. Deploy, then confirm `migrate` exited successfully and was not started a second time in parallel.
5. `GET /api/v1/health/live` returns success through the public API domain.
6. The web origin loads and its API calls use the HTTPS API origin.
7. Create the administrator manually. Do not seed demonstration data.
