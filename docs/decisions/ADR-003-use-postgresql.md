# ADR-003 — Use PostgreSQL

**Status:** Accepted  
**Date:** October 20, 2026

## Context

AegisBridge needs a durable relational store for assets, risks, controls, evidence metadata, vulns, incidents, and audit history.

## Decision

Use **PostgreSQL 18** as the authoritative application database. Do not begin production on PostgreSQL 19 release candidates.

## Alternatives

- SQLite (too limited for concurrent hosted use)
- Document DB as primary store

## Consequences

+ Strong relational integrity and hosted Render support  
− Requires Compose/managed service operational care  
