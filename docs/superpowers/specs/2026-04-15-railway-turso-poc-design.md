# PoC Design: Deploy Reservation System to Railway + Turso

## Context

Centrum Rubacek uses SuperSaaS to manage reservations for children's movement classes. SuperSaaS is inconvenient: no self-service for parents, heavy manual admin burden, missing features (waitlists, bulk ops, substitute credits), vendor lock-in, and no extensibility. A replacement reservation system has been built in this repo (TypeScript/Express/SQLite) with 80-90% of required features already implemented. This design covers deploying it as a PoC to replace SuperSaaS on the live WordPress site.

## Problem

The existing app runs locally with SQLite on disk. It needs to be deployed to a cloud platform and embedded in the WordPress site at centrumrubacek.cz so parents can use it and SuperSaaS can be retired.

## Decision: Railway + Turso

**Hosting:** Railway (Node.js process hosting, free tier: 500 hrs/month)
- Runs Express natively (no serverless rewrites)
- Simple deploy from GitHub
- Free tier sufficient for 50-200 participants

**Database:** Turso (cloud SQLite via HTTP, free tier: 500M rows read/month)
- Same SQL as current better-sqlite3
- `@libsql/client` supports `file:` protocol for local dev (no Turso account needed locally)
- No vendor lock-in (open-source libSQL)

**Integration:** Iframe embedded in WordPress page (already documented in `docs/WORDPRESS_INTEGRATION.md`)

## Scope

### In scope (PoC)
- Database migration: better-sqlite3 (sync) -> @libsql/client (async)
- Railway deployment with environment configuration
- WordPress iframe embedding
- Full enrollment flow: parent registers -> admin enrolls after payment -> parent self-manages

### Out of scope (future)
- Payment integration (Phase 3)
- Substitute credits display/management (Phase 2 remaining)
- Custom domain (reservations.centrumrubacek.cz)
- Production session storage (Redis)
- TypeScript compilation build step (using tsx in production for PoC)

## Architecture

```
WordPress (centrumrubacek.cz)
  +-- iframe --> Railway (Node.js/Express)
                  +-- Static files (login.html, index.html, app.js, styles.css)
                  +-- API routes (/api/*)
                  +-- Session auth (express-session, in-memory store)
                  +-- Turso DB (cloud SQLite via HTTP)
```

## Enrollment Flow

1. Parent visits centrumrubacek.cz/lekce-a-krouzky
2. Sees iframe with reservation app
3. Creates account (email + password)
4. Browses available courses/lessons
5. **[OFFLINE]** Parent pays (bank transfer / cash)
6. Admin logs in, confirms enrollment to paid course
7. Parent gains full self-service: view schedule, cancel lessons (before midnight), transfer between lessons (same age group), sign up for substitutes

## Implementation Phases

### Phase A: Database Migration (core work)

The main change: all `better-sqlite3` synchronous calls become `@libsql/client` async calls. This is mechanical but touches most of the codebase (~50+ methods).

**Files to modify:**

| File | Lines | Nature of change |
|------|-------|-----------------|
| `src/database.ts` | 639 | Full rewrite: replace better-sqlite3 with @libsql/client, all exports become async |
| `src/auth.ts` | ~120 | Add await to UserDB calls, make verifyToken async |
| `src/calendar-db.ts` | ~200 | 10 methods become async |
| `src/registration-db.ts` | 655 | 15 methods become async (largest service file) |
| `src/excel-loader.ts` | ~80 | Make bulkLoadAndRegister async |
| `server.ts` | 834 | All 26+ route handlers get await, startup becomes async, auth middleware async |
| 9 test files | various | beforeEach and test bodies get async/await |

**Key technical details:**
- `better-sqlite3`: `db.prepare(sql).run(...args)` (sync)
- `@libsql/client`: `await client.execute({ sql, args })` (async, returns `ResultSet` with `.rows` and `.rowsAffected`)
- Multi-statement `db.exec()` calls -> `client.batch([...])` (Turso doesn't support multi-statement execute)
- Local dev uses `file:data/reservations.db` protocol (no Turso account needed)
- TypeScript compiler catches missed awaits as type errors

### Phase B: Deployment Setup

1. Create Turso database via CLI
2. Create `railway.json` config
3. Move `tsx` from devDependencies to dependencies (PoC shortcut)
4. Configure Railway environment variables:
   - `NODE_ENV=production`
   - `SESSION_SECRET=<random>`
   - `ALLOWED_ORIGINS=https://centrumrubacek.cz,https://www.centrumrubacek.cz`
   - `TURSO_DATABASE_URL=libsql://...`
   - `TURSO_AUTH_TOKEN=<token>`
   - `ADMIN_EMAIL_SEED=<admin-email>`
   - `ADMIN_PASSWORD_SEED=<admin-password>`
5. Deploy via GitHub connection

### Phase C: WordPress Integration & Verification

1. Add iframe HTML block to WordPress page
2. Test complete flow end-to-end
3. Verify cross-site cookies work in iframe context

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Async cascade is large (~50+ methods) | High effort | TypeScript compiler catches all missed awaits |
| Turso row format differs from better-sqlite3 | Potential runtime errors | Both return plain-object-compatible rows; test locally first |
| Session loss on Railway restart | Parents must re-login | Acceptable for PoC; add Redis session store later |
| Winston file logging on ephemeral filesystem | Logs lost on restart | Railway captures stdout; console transport is primary |
| Cross-site cookies in iframe | Auth may break in Safari/strict browsers | Already configured with SameSite=none + Secure; test in target browsers |

## Verification Plan

### After database migration (local):
- `npm run typecheck` passes
- `npm test` passes (all 24 Playwright tests)

### After deployment (Railway):
- `GET /health` returns 200
- `GET /ready` returns 200 with database: "connected"
- Admin can log in and create a course
- Admin can bulk-create lessons
- Parent can register and view available courses
- Admin can enroll parent into paid course
- Parent can view their registrations
- Parent can cancel a registration (before deadline)
- Parent can transfer to different lesson (same age group)

### After WordPress integration:
- Iframe loads on centrumrubacek.cz
- Login works inside iframe
- Full enrollment flow works end-to-end in iframe context

## Additional Fix Required

**`public/app.js` line 1**: `API_URL` is hardcoded to `http://localhost:3000/api`. This must be made dynamic (e.g., use `window.location.origin + '/api'`) or it will break in production. This is a one-line fix but critical.

## Files Reference

- `src/database.ts` - Core rewrite target
- `server.ts` - All route handlers need async updates
- `src/registration-db.ts` - Largest service file (655 lines)
- `src/calendar-db.ts` - Lesson management
- `src/auth.ts` - Authentication
- `package.json` - Dependency changes
- `docs/WORDPRESS_INTEGRATION.md` - Existing integration guide
- `prompt.md` - Original project requirements