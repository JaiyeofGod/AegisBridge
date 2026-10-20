# ADR-004 — Use Wazuh as SIEM/XDR Platform

**Status:** Accepted  
**Date:** October 20, 2026

## Context

The cyber range must produce authentic endpoint/network security telemetry for SOC workflows without building a commercial SIEM.

## Decision

Deploy **Wazuh** (planning baseline 4.14.9) as the authoritative platform for raw security telemetry in the lab.

## Alternatives

- ELK-only custom stack; Splunk free tier; skip live SIEM

## Consequences

+ Real agent telemetry and detection practice  
− Lab RAM/disk cost; must not expose management ports publicly  
