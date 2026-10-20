# ADR-002 — Use React and FastAPI

**Status:** Accepted  
**Date:** October 20, 2026

## Context

Need a maintainable TypeScript UI and a typed Python API suitable for GRC/SOC domain logic, OpenAPI, and async workers.

## Decision

- Frontend: React 19.3 + TypeScript + Vite 8  
- Backend: FastAPI + Pydantic 2 + SQLAlchemy 2  

## Alternatives

- Next.js full-stack; Django; Go API; Vue/Svelte

## Consequences

+ Strong ecosystem fit for portfolio/security tooling  
+ Clear UI/API separation  
− Two runtimes (Node + Python) to maintain  
