# ADR-013 — Python 3.14.x Baseline

**Status:** Accepted  
**Date:** October 20, 2026

## Context

Python 3.15.0 is stable as of October 9, 2026, but is very new for the full dependency matrix.

## Decision

Begin on **Python 3.14.x**. Move to 3.15 only after the dependency/test matrix passes and this ADR is updated.

## Alternatives

- Jump immediately to 3.15
- Stay on 3.13 LTS-style pin

## Consequences

+ Balance currency and risk  
− Phase 1 must verify FastAPI/SQLAlchemy/Celery/psycopg compatibility; fallback requires a new ADR if 3.14 is unusable  
