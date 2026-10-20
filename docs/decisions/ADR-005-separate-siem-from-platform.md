# ADR-005 — Separate SIEM from AegisBridge Platform

**Status:** Accepted  
**Date:** October 20, 2026

## Context

Storing massive raw telemetry in PostgreSQL would break the platform’s purpose and cost model.

## Decision

AegisBridge consumes **summaries, findings, state, references, and selected normalized data**. Wazuh retains raw events. PostgreSQL is not a second SIEM.

## Alternatives

- Mirror full event streams into Postgres
- Replace Wazuh with AegisBridge event storage

## Consequences

+ Clear responsibilities; scalable app DB  
− Requires careful sync design and honest UI labeling of freshness  
