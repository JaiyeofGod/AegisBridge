# AegisBridge Web (`apps/web`)

Phase 1 frontend foundation with **Sign-in** (`/signin`) and **Overview** (`/overview`) from the approved Figma file.

## Commands

```bash
pnpm install   # from repo root or this package
pnpm dev
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

Requires Node.js 24 LTS. Dev server: `http://127.0.0.1:5173` (proxies `/api` to `http://127.0.0.1:8000`).

## Notes

- Dark theme tokens are the Phase 1 default.
- Overview and asset inventory read from the development API (`VITE_API_BASE_URL`, default Vite proxy `/api`). Other modules still use deterministic mocks in `src/mocks/`.
- Sign-in controls are UI-only; Explore demo navigates to Overview without real auth.
- Spline/3D is not integrated; `SignInVisual` is a static fallback with a future embed boundary.
