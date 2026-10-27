FROM python:3.14.8-slim-bookworm

COPY --from=ghcr.io/astral-sh/uv:0.13.3 /uv /uvx /bin/

RUN useradd --system --uid 10001 --create-home --home-dir /home/aegis aegis

WORKDIR /app

COPY apps/api/pyproject.toml apps/api/uv.lock apps/api/README.md apps/api/
COPY apps/api/app apps/api/app
COPY alembic.ini alembic.ini
COPY migrations migrations

ENV PYTHONPATH=/app/apps/api \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/apps/api/.venv

RUN uv sync --project apps/api --frozen --no-dev \
    && chown -R aegis:aegis /app

USER aegis

CMD ["uv", "run", "--project", "apps/api", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
