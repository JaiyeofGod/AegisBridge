# ADR-010 — Use Cloudflare R2 for Object Storage

**Status:** Accepted  
**Date:** October 20, 2026  
**Related:** ADR-021 (local SeaweedFS S3 stand-in)

## Context

Evidence and reports are unstructured objects that should not live on container disks.

## Decision

Use **Cloudflare R2** (S3-compatible) for **hosted** evidence/report objects (staging and production).

For **local development**, use an S3-compatible stand-in so the same application storage abstraction works offline. As of ADR-021, that stand-in is **SeaweedFS `weed mini`** (not MinIO).

Application code talks through a storage abstraction — no Cloudflare-specific or SeaweedFS-specific calls scattered through business logic.

## Alternatives

- Render disk; AWS S3 only; local filesystem in production
- MinIO locally (superseded for local use by ADR-021)

## Consequences

+ Portable S3 interface; independent object lifecycle  
− Dual-config (local SeaweedFS vs hosted R2) must stay consistent via endpoint/credential env vars  
