# ADR-008 — Dataset Storage Policy

**Status:** Accepted  
**Date:** October 20, 2026

## Context

Research datasets can be large, licensed, and sometimes malicious. They are not the application database.

## Decision

- Keep operational data in PostgreSQL; research datasets local with Git manifests  
- Do not commit large raw files, PCAPs, memory dumps, or malware binaries  
- Record license, checksum, provenance for every dataset  
- Initial download target: Smishing IMC25 only when Phase 8 authorizes  
- Prefer safe static/feature subsets; do not execute dataset artifacts by default  

## Alternatives

- Store datasets in R2 by default; vendor everything into Postgres

## Consequences

+ Safer repo and clearer licensing  
− Researchers must manage local disk and manifests  
