# ADR-021 — Local SeaweedFS S3; Production Remains Cloudflare R2

**Status:** Accepted  
**Date:** October 20, 2026  
**Supersedes (local only):** MinIO local emulator language in ADR-010

## Context

Docker Hub community MinIO images (`minio/minio`, `minio/mc`) used for local Compose failed startup and are no longer a safe/current default for this project. Local development still needs an S3-compatible object store that mirrors the hosted R2 interface.

## Decision

1. **Production / staging object storage remains Cloudflare R2** (ADR-010 unchanged for hosted environments).
2. **Local development** uses **SeaweedFS** in S3-compatible **`weed mini`** single-node mode via Compose.
3. Pin image **`chrislusf/seaweedfs:4.48`** (multi-arch `linux/amd64` + `linux/arm64`, matching GitHub release 4.48).
4. Expose only **`127.0.0.1:8333`** (standard SeaweedFS S3 port).
5. Seed credentials with `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` and create `S3_BUCKET=aegis-dev-evidence` via SeaweedFS env support (no separate init container).
6. Application code talks only to an **S3-compatible storage abstraction** (endpoint URL + AWS-style keys). It must not call SeaweedFS-specific APIs.

## Alternatives

- Continue with obsolete MinIO Hub images (rejected)
- Local filesystem without S3 API (rejected — breaks R2 parity)
- Local R2 / cloud bucket for day-to-day Mac development (rejected — slower, costs, network dependency)

## Consequences

+ Current, multi-arch local S3 stand-in; bucket auto-created; R2 decision preserved  
− Developers must know local endpoint is `:8333` vs R2 hosted URLs  
− SeaweedFS Admin/Filer/Master UIs are not published on the host by default (S3-only bind)  
