# Design review — reservation system & WordPress ecosystem fit

**Date:** 2026-07-12
**Scope:** A staged re-check of the whole design, and an assessment of whether the app
can plug into the existing `centrumrubacek.cz` WordPress ecosystem.
**Verdict up front:** the design is sound and the app is **pluggable today** via a
subdomain redirect (`reservations.centrumrubacek.cz`). No application code changes are
required to integrate. The main risks are operational (data safety on deploy), not
architectural.

---

## Stage 1 — Architecture

**Shape.** A single Express 5 + TypeScript server (`start.mjs` → `server.ts`, run live
via `tsx`, no build artifact in the start path). The frontend is a static multi-page
vanilla-JS app in `public/` (`index.html`, `login.html`, `app.js`, `styles.css`),
served by `express.static` and populated via `fetch` against a flat `/api/*` JSON
surface. Domain logic lives in `src/` modules (`auth`, `database`, `registration-db`,
`session-store`, `email-*`, per-entity model factories).

**Strengths.**

- Clear separation between the static client and the JSON API.
- Domain logic is factored into `src/` modules rather than all inline.
- Proxy-aware, health-checked, and session-persistent (see stages 2–3).

**Structural debt (not blocking integration).**

- `server.ts` is a **1,526-line god-file** — all ~48 routes and several business
  transactions inline (`REQUIREMENTS.md` item 14). It works, but it is the biggest
  maintainability liability.
- `public/app.js` is ~1,971 lines of global-namespace vanilla JS with inline `onclick`
  handlers, which is why the CSP still needs `'unsafe-inline'` for scripts
  (`server.ts:163-164`; items 8 & 19).
- No real migration system — boot-time `try { ALTER TABLE } catch {}` idempotent
  functions with no version tracking (item 17).

These are known and tracked; they do not affect pluggability.

---

## Stage 2 — Auth & session

**Mechanism.** `AuthService` (`src/auth.ts`) with bcrypt (cost 10). Users live in a
Turso `users` table; roles are `admin | participant`. There are **no tokens/JWTs** —
auth state lives entirely in a server-side session. Sessions are persisted in Turso via
a custom `LibSQLSessionStore` (`src/session-store.ts`, `sessions` table), so they
survive restarts and multiple instances.

**Cookie config** (`server.ts:195-208`):

```
secure:   isProduction     // TLS-only in prod
httpOnly: true             // invisible to JS
sameSite: "lax"
maxAge:   24h
// no `domain` attribute → cookie is HOST-SCOPED
```

Combined with `app.set("trust proxy", 1)` (`server.ts:115`), secure cookies work behind
Render's TLS terminator.

**Why this is correct for a subdomain redirect (and wrong for an iframe).**

- The cookie is **host-scoped** (no `domain`) and `sameSite:"lax"`. When a WordPress
  link navigates the user *to* `reservations.centrumrubacek.cz`, that is a **top-level,
  first-party navigation** — the cookie is set and sent normally. Login works.
- If instead the app were **embedded in an iframe** on `centrumrubacek.cz`, the app
  would be in a **cross-site third-party context**. `sameSite:"lax"` suppresses the
  cookie there, so login would silently fail. On top of that, production sets
  `X-Frame-Options: SAMEORIGIN` via `frameguard` (`server.ts:175`) and there is no CSP
  `frame-ancestors` allowing WordPress — so the browser would refuse to render the
  frame at all.

This is the core reason the subdomain-redirect model is the right fit: **the code is
already configured for it**, and the iframe alternative would require a security
downgrade (`sameSite:"none"`) plus header changes plus a `postMessage` height shim that
does not exist.

---

## Stage 3 — Data & deployment

**Platform.** Render (free plan, Frankfurt, Node 20), single web service, `npm start`,
`healthCheckPath: /health` (`render.yaml`). CI (`.github/workflows/ci.yml`) runs
Playwright then triggers a Render deploy hook on push to `main`.

**Database.** `@libsql/client` → Turso in production (`TURSO_DATABASE_URL` +
`TURSO_AUTH_TOKEN`), local SQLite file otherwise. Schema created inline at boot
(`initializeDatabase`).

**Health surface.** `GET /health` (uptime/status, `server.ts:228`) and `GET /ready`
(runs `SELECT 1`, 503 if DB down, `server.ts:237`) — both useful as integration/uptime
probes.

**⚠️ The one landmine that blocks a safe deploy — `REQUIREMENTS.md` item 10.**
If `TURSO_DATABASE_URL` is unset, the app **silently falls back to an ephemeral local
SQLite file** on Render. Render's filesystem is ephemeral, so every redeploy = **total
data loss**, and there is **no backup script**. This has nothing to do with WordPress,
but any real staging/production test of the integration must set `TURSO_DATABASE_URL`
first, or the test itself becomes a data-loss demo. This must be handled before go-live.
(Remediation is deferred to separate work — see the plan's follow-ups.)

---

## Stage 4 — Ecosystem fit (the answer to "can it plug in?")

**Yes — via a subdomain redirect, with no app-code changes.** Topology:

```
centrumrubacek.cz (WordPress)
   └─ menu item / button ──▶ https://reservations.centrumrubacek.cz  (this app, owns its root)
```

A `reservations` CNAME points at the Render service; a WordPress menu item or button
links to it; the user makes a normal top-level navigation into the app and logs in
first-party. That is the whole integration.

**The contract that must hold** (and is verified by the Stage-3 harness in slice 3):

- Unauthenticated `GET /` redirects to `/login.html` (`server.ts:1421-1427`) — the
  landing behaviour a WordPress link relies on.
- The session cookie is host-scoped (no `Domain`) and `SameSite=Lax` — first-party on
  the subdomain, isolated from the apex.
- `GET /health` and `GET /ready` return 200 — deploy + uptime probes.
- Public read endpoints (`GET /api/lessons`, `GET /api/courses/:courseId/lessons`) are
  reachable without auth — *optional* material for a WordPress "upcoming lessons"
  widget, if ever wanted.

**Optional (not required for redirect): a WP-side schedule widget.** If WordPress ever
wants to `fetch()` the public lesson list to render a teaser on the apex domain, that is
a cross-origin credential-less request and needs `ALLOWED_ORIGINS` to include
`https://centrumrubacek.cz` (already the default, `server.ts:76-78`). The redirect model
itself needs none of this.

---

## Stage 5 — Risk register

| #  | Risk                                                                                                         | Severity     | Blocks integration?                          |
|----|--------------------------------------------------------------------------------------------------------------|--------------|----------------------------------------------|
| 10 | Missing `TURSO_DATABASE_URL` → ephemeral DB, data loss on redeploy, no backup                                | **Critical** | **Yes** — must set before any real deploy    |
| 18 | CI gates on Playwright only; typecheck/lint live in bypassable pre-commit hook; doc drift                    | High         | No                                           |
| —  | `docs/WORDPRESS_INTEGRATION.md` sells iframe + Vercel; contradicts code & chosen model                       | High         | No (misleads future work) — fixed in slice 2 |
| 7  | Unauthenticated write endpoints (`POST /api/registrations`, `/api/substitutions`) lack rate-limit/validation | High         | No                                           |
| 8  | Stored-XSS: user names rendered via unescaped `innerHTML` in `public/app.js`                                 | High         | No                                           |
| 14 | `server.ts` god-file (1,526 lines)                                                                           | Medium       | No                                           |

**Reading of the table:** only item 10 blocks a *safe* go-live. Everything else is
pre-existing debt the integration neither creates nor depends on. The integration itself
is architecturally free.
