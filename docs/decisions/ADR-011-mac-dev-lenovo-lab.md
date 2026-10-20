# ADR-011 — Mac Development, Lenovo Cyber Range

**Status:** Accepted  
**Date:** October 20, 2026

## Context

Heavy VMs (Wazuh, Windows, Kali, etc.) should not run on the primary coding machine.

## Decision

- **Mac + Cursor:** primary development (UI, API, Compose infra, tests, docs)  
- **Lenovo:** cyber-range host for VMs, PCAPs, lab datasets  
- Sync via GitHub (push from Mac, pull on Lenovo)

## Alternatives

- All-in-one workstation; cloud-only lab

## Consequences

+ Clear resource split  
− Requires verifying Lenovo RAM/disk before final VM allocations  
