# AegisBridge Web (`apps/web`)

Phase 1 frontend with **Sign-in** (`/signin`), product modules, and **Account** pages wired to the FastAPI auth/session/account APIs.

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

## Authentication

- Session cookies are HttpOnly. All auth and account fetches use `credentials: "include"`.
- Session tokens are never stored in `localStorage` / `sessionStorage` and are never read from JavaScript.
- On load, the client calls `GET /api/v1/auth/session` before treating the user as authenticated.
- Sign-in posts to `POST /api/v1/auth/login`, then invalidates session queries and navigates to `/overview`.
- Logout posts to `POST /api/v1/auth/logout` (and logout-all from Account Security when used).
- Account pages read `/api/v1/account/profile|security|preferences|workspace`. Preferences report `persistence=not_stored`.

### Route guards (UX only)

`RequireAuth` / `GuestOnly` protect product and account routes in the SPA. They are **not** the security boundary.

**Backend domain authorization enforcement is the next security slice.** Domain GET routes may still be publicly readable until that work lands.

## Notes

- Dark theme tokens are the Phase 1 default.
- Overview through Reports and Cyber Range read from the development API (`VITE_API_BASE_URL`, default Vite proxy `/api`).
- Development sign-in hint shows the seeded email only; the password comes from private local env (`AEGIS_DEV_ADMIN_PASSWORD`) and is never displayed.
- Spline scene remains on the sign-in visual panel; reduced motion / compact viewports use the static fallback.
