# ADR-016 — Use Pyright for Python Type Checking

**Status:** Accepted  
**Date:** October 20, 2026

## Context

Master allows Pyright or mypy for backend typing.

## Decision

Use **Pyright** for Python type checking in local scripts and CI.

## Alternatives

- mypy

## Consequences

+ Fast feedback; good editor integration  
− Config must align with uv-managed environment paths  
