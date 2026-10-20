# ADR-020 — Host-Run Apps with Compose Infrastructure

**Status:** Accepted  
**Date:** October 20, 2026

## Context

Early development needs fast hot reload for React and FastAPI, while data-plane services benefit from Compose.

## Decision

- Run **PostgreSQL, Redis/Valkey, and SeaweedFS (S3 `weed mini`)** via Docker Compose  
- Run **React (Vite) and FastAPI** on the Mac host during early development  
- Keep apps **container-ready** (Dockerfiles / optional Compose services) for Phase 9 parity and Render  
- Include a **minimal Celery worker foundation** without meaningful jobs in Phase 1  
- Hosted object storage remains Cloudflare R2 (ADR-010 / ADR-021)

## Alternatives

- Fully containerize API/web from day one
- Run Postgres on the host without Docker

## Consequences

+ Faster local UX iteration  
− Developers must run Compose + two host processes; document scripts clearly  

