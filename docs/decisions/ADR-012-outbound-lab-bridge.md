# ADR-012 — Outbound Lab Bridge

**Status:** Accepted  
**Date:** October 20, 2026

## Context

Hosting must not require exposing Wazuh or lab management ports to the public internet.

## Decision

Build `aegis-lab-bridge` on the Lenovo that queries approved local Wazuh endpoints, sanitizes payloads, and **pushes outbound HTTPS** to hosted `/api/v1/lab-sync` with dedicated credentials, timestamps, and replay resistance. Hosted app continues when the lab is offline.

## Alternatives

- Inbound VPN to home lab; public Wazuh API

## Consequences

+ Stronger security boundary  
− Sync freshness depends on lab uptime and bridge reliability  
