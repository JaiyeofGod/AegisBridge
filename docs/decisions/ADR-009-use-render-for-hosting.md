# ADR-009 — Use Render for Public Hosting

**Status:** Accepted  
**Date:** October 20, 2026

## Context

Need one coherent hosting model for static frontend, API, worker, cron, Postgres, and Redis-compatible KV.

## Decision

Use **Render** with Blueprint (`render.yaml`) for public/staging application hosting.

## Alternatives

- Fly.io; Railway; AWS ECS; Vercel+separate API host

## Consequences

+ Maps cleanly to architecture planes  
− Plan/pricing limits must be rechecked at deploy time  
