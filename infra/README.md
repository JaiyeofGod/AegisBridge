# Infrastructure helpers

Local data-plane services are defined in the repository root `compose.yaml`.

- PostgreSQL 18
- Valkey (Redis-compatible)
- SeaweedFS `weed mini` S3 API on `127.0.0.1:8333` (`chrislusf/seaweedfs:4.48`)

Hosted object storage remains Cloudflare R2. See ADR-010 and ADR-021.
