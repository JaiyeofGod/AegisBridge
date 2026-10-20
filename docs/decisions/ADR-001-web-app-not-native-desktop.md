# ADR-001 — Web Application, Not Native Desktop

**Status:** Accepted  
**Date:** October 20, 2026

## Context

AegisBridge must run across macOS, Windows, and Linux for portfolio and operational use, with centralized data, RBAC, and cloud deployment.

## Decision

Build a browser-based full-stack web application as the primary product. A future Tauri (or similar) shell may wrap the web app but must not fork the architecture.

## Alternatives

- Native desktop (Swift/Electron-first)
- Separate per-OS clients

## Consequences

+ One codebase, standard API security model, Render-friendly  
− Requires hosting and browser security controls  
