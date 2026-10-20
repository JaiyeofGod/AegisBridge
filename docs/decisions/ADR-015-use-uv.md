# ADR-015 — Use uv for Python Environments and Lockfiles

**Status:** Accepted  
**Date:** October 20, 2026

## Context

Backend needs a locked dependency workflow portable across Mac, CI, and containers.

## Decision

Use **uv** to manage Python environments and lockfiles for `apps/api` and `apps/worker`.

## Alternatives

- Poetry
- pip-tools + venv
- Hatch

## Consequences

+ Fast, modern locking aligned with Phase 1 plan  
− Team must standardize on uv in docs/CI  
