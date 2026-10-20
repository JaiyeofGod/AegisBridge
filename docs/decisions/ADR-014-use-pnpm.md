# ADR-014 — Use pnpm as Frontend Package Manager

**Status:** Accepted  
**Date:** October 20, 2026

## Context

Master allows npm or pnpm; one must be chosen for lockfiles and CI consistency.

## Decision

Use **pnpm** with a workspace rooted at the monorepo (`pnpm-workspace.yaml`) for `apps/web`.

## Alternatives

- npm
- yarn

## Consequences

+ Efficient installs; strict lockfile discipline  
− Contributors must have pnpm available  
