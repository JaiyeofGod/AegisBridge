# ADR-017 — Use Prettier for Frontend Formatting

**Status:** Accepted  
**Date:** October 20, 2026

## Context

Master specifies ESLint for frontend lint but does not name a formatter. Consistent formatting is required for CI.

## Decision

Use **Prettier** for frontend formatting, alongside ESLint for lint rules. Backend formatting remains **Ruff format**.

## Alternatives

- ESLint stylistic rules only
- dprint

## Consequences

+ Clear frontend format gate  
− Two formatters across stacks (Prettier + Ruff) — documented and acceptable  
