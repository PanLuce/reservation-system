# Deploy to Railway & WordPress Integration — Design Spec

## Context

The Centrum Rubacek reservation system has been developed and tested locally but never deployed. The goal is to:

1. Deploy the app to Railway with a custom subdomain (`rezervace.centrumrubacek.cz`)
2. Create a hidden WordPress test page at `centrumrubacek.cz` that links to the deployed app
3. Enable end-to-end testing of the full flow (parent visits WP page -> clicks link -> logs in -> browses courses -> registers)

**Chosen approach**: Subdomain redirect (Approach B). A styled link on a WordPress page directs users to the standalone app. No iframe embedding — avoids third-party cookie issues with Safari/Chrome that would break session-based auth in a cross-origin iframe context.

**Out of scope for this spec**: UI polish, branding alignment with WP site, removing test credentials from login page. These will be addressed in a follow-up.

---

## Section 1: Production-Readiness Fixes (Express App)

These changes are required for the app to function correctly on Railway, regardless of WordPress integration.

### 1.1 Trust Proxy

**File**: `server.ts` (after line 76, right after `const app = express()`)

**Change**: Add `app.set('trust proxy', 1)`

**Why**: Railway runs behind a reverse proxy. Without this, Express sees all requests as HTTP. The `secure: true` cookie setting causes session cookies to never be set, silently breaking all authentication.

### 1.2 Persistent Session Store (Turso-backed)

**Problem**: The current session config uses the default `MemoryStore`. Railway restarts containers on deploys and periodically — every restart loses all active sessions.

**Solution**: Create a `LibSQLSessionStore` class backed by a `sessions` table in the existing Turso database.

**New file**: `src/session-store.ts`

Implementation requirements:
- Extends `express-session`'s `Store` class
- Implements methods: `get(sid, callback)`, `set(sid, session, callback)`, `destroy(sid, callback)`, `touch(sid, session, callback)`
- Uses the existing `@libsql/client` — zero new dependencies
- Session data stored as JSON string
- Expired sessions cleaned up on every `set` call (delete expired rows before inserting). No separate cleanup interval needed at this app's scale — keeps implementation simple.

**Database table** (added to `initializeDatabase()` in `src/database.ts`):

```sql
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY,
  sess TEXT NOT NULL,
  expired DATETIME NOT NULL
)
```

Add an index on `expired` for cleanup queries:
```sql
CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired)
```

**Wire into session config** in `server.ts`:
```typescript
session({
  store: new LibSQLSessionStore(db),  // pass the existing db client
  secret: ...,
  ...
})
```

### 1.3 Cookie Configuration Cleanup

**File**: `server.ts` (session config, lines 156-168)

**Changes**:
- Change `sameSite` from `"none"` to `"lax"` in production — since we're not using iframes, cookies are first-party. `"lax"` is more secure and avoids unnecessary cross-site cookie warnings.
- Remove the comment about "cross-site iframe" — no longer applicable.

### 1.4 Session Secret Validation

**File**: `server.ts`

**Change**: In production, if `SESSION_SECRET` is not set, throw an error instead of falling back to the hardcoded default. The current fallback (`"dev-secret-change-in-production"`) is a security risk if someone forgets to set the env var.

---

## Section 2: Railway Deployment

### 2.1 Railway Project Setup

- Create a Railway project and connect the GitHub repo (`PanLuce/reservation-system`)
- Railway auto-detects Node.js via NIXPACKS (already configured in `railway.json`)
- The existing `railway.json` config is sufficient:
  - Builder: NIXPACKS
  - Start command: `npm start`
  - Health check: `/health` (30s timeout)
  - Restart: ON_FAILURE, max 5 retries

### 2.2 Environment Variables

| Variable | Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables secure cookies, CORS restrictions |
| `SESSION_SECRET` | (random 64-char hex) | Generate with `openssl rand -hex 32` |
| `TURSO_DATABASE_URL` | `libsql://your-db.turso.io` | Turso cloud DB URL |
| `TURSO_AUTH_TOKEN` | (Turso auth token) | From Turso dashboard |
| `ADMIN_EMAIL_SEED` | (admin email) | Creates initial admin account on first run |
| `ADMIN_PASSWORD_SEED` | (strong password) | Admin password for seed |
| `ALLOWED_ORIGINS` | `https://centrumrubacek.cz,https://www.centrumrubacek.cz` | CORS allowed origins |

`PORT` is auto-set by Railway. The app reads `process.env.PORT` with fallback to 3000.

### 2.3 Custom Domain Setup

1. In Railway dashboard: Settings -> Networking -> Add custom domain: `rezervace.centrumrubacek.cz`
2. Railway provides a CNAME target (e.g., `your-project.up.railway.app`)
3. In DNS provider: Add CNAME record `rezervace` -> Railway's CNAME target
4. Railway auto-provisions SSL certificate via Let's Encrypt
5. Wait for DNS propagation (5-30 minutes)

### 2.4 Verify Deployment

After deploy:
1. `curl https://rezervace.centrumrubacek.cz/health` — should return 200 with uptime info
2. `curl https://rezervace.centrumrubacek.cz/ready` — should return 200 confirming DB connectivity
3. Visit `https://rezervace.centrumrubacek.cz` in browser — should show login page
4. Log in with admin credentials — should work and persist session across page reloads

---

## Section 3: WordPress Integration (Testing Phase)

### 3.1 Create Hidden Test Page

In WordPress admin:
1. Create a new page
2. Set slug to something obscure: `/testovaci-rezervace-2026`
3. Set visibility to "Private" (visible only to logged-in WP admins) or publish with the obscure slug
4. Content: brief Czech intro text + styled CTA button linking to `https://rezervace.centrumrubacek.cz`

Example content (Custom HTML block):
```html
<div style="text-align: center; padding: 40px 20px;">
  <h2>Rezervacni system Centra Rubacek</h2>
  <p>Zde se muzete prihlasit, prohlednout nabidku lekci a prihlasit sve deti na cviceni.</p>
  <a href="https://rezervace.centrumrubacek.cz"
     style="display:inline-block; padding:15px 30px; background:#4CAF50; color:white;
     text-decoration:none; border-radius:8px; font-size:18px; margin-top:20px;">
     Vstoupit do rezervacniho systemu
  </a>
</div>
```

### 3.2 Going Public (Future — Out of Scope)

When testing is satisfactory:
- Add a menu item in WP navigation: "Rezervace" linking to the subdomain
- Or add the link prominently on the homepage
- Remove/redirect the test page

---

## Critical Files to Modify

| File | Changes |
|---|---|
| `server.ts` | Add `trust proxy`, wire session store, update cookie config, harden session secret |
| `src/database.ts` | Add `sessions` table to `initializeDatabase()` |
| `src/session-store.ts` (new) | `LibSQLSessionStore` class implementing express-session Store |

---

## Verification Plan

### After code changes (local):
1. `npm run build` — must compile without errors
2. `npm run test` — all existing Playwright tests must pass
3. Write a test for the session store (get/set/destroy/touch/expiry cleanup)
4. Start locally with `npm run dev`, verify login still works, sessions persist

### After Railway deployment:
1. Hit `/health` and `/ready` endpoints — both return 200
2. Visit the app in browser, log in as admin — session persists across reloads
3. Open a new incognito window, register a new participant account — self-registration works
4. Log in as participant — see participant view (no admin features)
5. Close browser, reopen, revisit — session should still be active (not memory-store behavior)

### After WordPress page:
1. Visit the hidden WP page while logged into WordPress admin
2. Click the link to the reservation system
3. Complete full flow: login -> browse courses -> register for a lesson
4. Verify the "journey" feels coherent (even without branding alignment yet)