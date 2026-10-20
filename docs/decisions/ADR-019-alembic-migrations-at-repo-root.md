# ADR-019 — Alembic Migrations at Repository Root

**Status:** Accepted  
**Date:** October 20, 2026

## Context

Master tree shows top-level `migrations/`. Some FastAPI templates keep Alembic under `apps/api`.

## Decision

Place Alembic migrations at repository root `migrations/` so API and worker share one schema history.

## Alternatives

- `apps/api/alembic`

## Consequences

+ Single source of schema truth  
− API package config must point Alembic at the root path  
