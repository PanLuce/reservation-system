# Deploy to Railway & WordPress Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the reservation system production-ready, deploy it to Railway at `rezervace.centrumrubacek.cz`, and create a hidden WordPress test page linking to it.

**Architecture:** Express monolith with Turso/LibSQL database. Three changes: (1) add `trust proxy` + harden session secret for Railway reverse proxy, (2) replace in-memory session store with a Turso-backed persistent store, (3) fix cookie config for first-party subdomain use. WordPress gets a simple page with a styled link.

**Tech Stack:** Express 5, TypeScript, `@libsql/client`, `express-session`, Playwright (tests), Railway (hosting), Turso (database)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/session-store.ts` | Create | `LibSQLSessionStore` class — persistent session storage backed by Turso |
| `src/database.ts` | Modify (lines 35-158) | Add `sessions` table + index to `initializeDatabase()` batch |
| `server.ts` | Modify (lines 52-58, 76, 156-168) | Add trust proxy, wire session store, fix cookie config, harden secret |
| `tests/session-store.spec.ts` | Create | Unit tests for LibSQLSessionStore (get/set/destroy/touch/cleanup) |

---

### Task 1: Add sessions table to database schema

**Files:**
- Modify: `src/database.ts:35-158` (add to the `initializeDatabase` batch)

- [ ] **Step 1: Write the failing test**

Create `tests/session-store.spec.ts` with an initial test that verifies the sessions table exists after initialization:

```typescript
import { expect, test } from "@playwright/test";
import { client, initializeDatabase, resetDatabaseForTests } from "../src/database.js";

test.describe("Sessions table", () => {
	test.beforeEach(async () => {
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("should create sessions table during initialization", async () => {
		const result = await client.execute({
			sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'",
			args: [],
		});
		expect(result.rows.length).toBe(1);
		expect(result.rows[0]?.name).toBe("sessions");
	});

	test("should create index on sessions expired column", async () => {
		const result = await client.execute({
			sql: "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_sessions_expired'",
			args: [],
		});
		expect(result.rows.length).toBe(1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/session-store.spec.ts -v`
Expected: FAIL — sessions table does not exist yet.

- [ ] **Step 3: Add sessions table and index to initializeDatabase()**

In `src/database.ts`, add two statements to the `client.batch()` call inside `initializeDatabase()`, right after the `course_participants` table creation (after line 115) and before the existing indexes:

```typescript
			{
				sql: `CREATE TABLE IF NOT EXISTS sessions (
				sid TEXT PRIMARY KEY,
				sess TEXT NOT NULL,
				expired DATETIME NOT NULL
			)`,
				args: [],
			},
```

And add the index alongside the other indexes (after the existing `idx_registrations_status` index, around line 155):

```typescript
			{
				sql: "CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired)",
				args: [],
			},
```

Also add `DELETE FROM sessions` to `resetDatabaseForTests()` — add it as the first statement in the batch (before `DELETE FROM registrations`):

```typescript
			{ sql: "DELETE FROM sessions", args: [] },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx playwright test tests/session-store.spec.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/database.ts tests/session-store.spec.ts
git commit -m "feat: add sessions table to database schema"
```

---

### Task 2: Implement LibSQLSessionStore

**Files:**
- Create: `src/session-store.ts`
- Test: `tests/session-store.spec.ts` (extend from Task 1)

- [ ] **Step 1: Write failing tests for session store get/set/destroy**

Add to `tests/session-store.spec.ts`:

```typescript
import { expect, test } from "@playwright/test";
import type { SessionData } from "express-session";
import { client, initializeDatabase, resetDatabaseForTests } from "../src/database.js";
import { LibSQLSessionStore } from "../src/session-store.js";

test.describe.configure({ mode: "serial" });

test.describe("Sessions table", () => {
	test.beforeEach(async () => {
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("should create sessions table during initialization", async () => {
		const result = await client.execute({
			sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'",
			args: [],
		});
		expect(result.rows.length).toBe(1);
		expect(result.rows[0]?.name).toBe("sessions");
	});

	test("should create index on sessions expired column", async () => {
		const result = await client.execute({
			sql: "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_sessions_expired'",
			args: [],
		});
		expect(result.rows.length).toBe(1);
	});
});

test.describe("LibSQLSessionStore", () => {
	let store: LibSQLSessionStore;

	const testSession: SessionData = {
		cookie: {
			originalMaxAge: 86400000,
			httpOnly: true,
			secure: false,
			path: "/",
			sameSite: "lax",
		},
		userId: "user_123",
	};

	test.beforeEach(async () => {
		await initializeDatabase();
		await resetDatabaseForTests();
		store = new LibSQLSessionStore(client);
	});

	test("set should store a session", async () => {
		await new Promise<void>((resolve, reject) => {
			store.set("sid_1", testSession, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		const result = await client.execute({
			sql: "SELECT * FROM sessions WHERE sid = ?",
			args: ["sid_1"],
		});
		expect(result.rows.length).toBe(1);
		expect(result.rows[0]?.sid).toBe("sid_1");

		const storedSession = JSON.parse(result.rows[0]?.sess as string);
		expect(storedSession.userId).toBe("user_123");
	});

	test("get should retrieve a stored session", async () => {
		await new Promise<void>((resolve, reject) => {
			store.set("sid_2", testSession, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		const session = await new Promise<SessionData | null | undefined>((resolve, reject) => {
			store.get("sid_2", (err, session) => {
				if (err) reject(err);
				else resolve(session);
			});
		});

		expect(session).toBeDefined();
		expect(session?.userId).toBe("user_123");
	});

	test("get should return null for non-existent session", async () => {
		const session = await new Promise<SessionData | null | undefined>((resolve, reject) => {
			store.get("nonexistent", (err, session) => {
				if (err) reject(err);
				else resolve(session);
			});
		});

		expect(session).toBeNull();
	});

	test("destroy should remove a session", async () => {
		await new Promise<void>((resolve, reject) => {
			store.set("sid_3", testSession, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		await new Promise<void>((resolve, reject) => {
			store.destroy("sid_3", (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		const result = await client.execute({
			sql: "SELECT * FROM sessions WHERE sid = ?",
			args: ["sid_3"],
		});
		expect(result.rows.length).toBe(0);
	});

	test("touch should update session expiry without changing data", async () => {
		await new Promise<void>((resolve, reject) => {
			store.set("sid_4", testSession, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		const beforeResult = await client.execute({
			sql: "SELECT expired FROM sessions WHERE sid = ?",
			args: ["sid_4"],
		});
		const expiryBefore = beforeResult.rows[0]?.expired as string;

		// Wait a moment so timestamps differ
		await new Promise((r) => setTimeout(r, 50));

		const touchedSession: SessionData = {
			...testSession,
			cookie: { ...testSession.cookie, originalMaxAge: 86400000 * 2 },
		};

		await new Promise<void>((resolve, reject) => {
			store.touch!("sid_4", touchedSession, () => {
				resolve();
			});
		});

		const afterResult = await client.execute({
			sql: "SELECT expired FROM sessions WHERE sid = ?",
			args: ["sid_4"],
		});
		const expiryAfter = afterResult.rows[0]?.expired as string;

		expect(expiryAfter).not.toBe(expiryBefore);
	});

	test("set should clean up expired sessions", async () => {
		// Insert an expired session directly into DB
		const pastDate = new Date(Date.now() - 100000).toISOString();
		await client.execute({
			sql: "INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)",
			args: ["expired_sid", JSON.stringify(testSession), pastDate],
		});

		// Setting a new session should clean up the expired one
		await new Promise<void>((resolve, reject) => {
			store.set("sid_5", testSession, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		const result = await client.execute({
			sql: "SELECT * FROM sessions WHERE sid = ?",
			args: ["expired_sid"],
		});
		expect(result.rows.length).toBe(0);
	});

	test("get should return null for expired session", async () => {
		// Insert an expired session directly
		const pastDate = new Date(Date.now() - 100000).toISOString();
		await client.execute({
			sql: "INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)",
			args: ["expired_get", JSON.stringify(testSession), pastDate],
		});

		const session = await new Promise<SessionData | null | undefined>((resolve, reject) => {
			store.get("expired_get", (err, session) => {
				if (err) reject(err);
				else resolve(session);
			});
		});

		expect(session).toBeNull();
	});

	test("set should overwrite existing session (upsert)", async () => {
		await new Promise<void>((resolve, reject) => {
			store.set("sid_upsert", testSession, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		const updatedSession: SessionData = {
			...testSession,
			userId: "user_456",
		};

		await new Promise<void>((resolve, reject) => {
			store.set("sid_upsert", updatedSession, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		const session = await new Promise<SessionData | null | undefined>((resolve, reject) => {
			store.get("sid_upsert", (err, session) => {
				if (err) reject(err);
				else resolve(session);
			});
		});

		expect(session?.userId).toBe("user_456");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test tests/session-store.spec.ts -v`
Expected: FAIL — `LibSQLSessionStore` does not exist yet.

- [ ] **Step 3: Implement LibSQLSessionStore**

Create `src/session-store.ts`:

```typescript
import type { Client } from "@libsql/client";
import { Store } from "express-session";
import type { SessionData } from "express-session";

export class LibSQLSessionStore extends Store {
	private db: Client;

	constructor(db: Client) {
		super();
		this.db = db;
	}

	get(sid: string, callback: (err: unknown, session?: SessionData | null) => void): void {
		this.db
			.execute({
				sql: "SELECT sess FROM sessions WHERE sid = ? AND expired > ?",
				args: [sid, new Date().toISOString()],
			})
			.then((result) => {
				const row = result.rows[0];
				if (!row) {
					return callback(null, null);
				}
				const session = JSON.parse(row.sess as string) as SessionData;
				callback(null, session);
			})
			.catch((err) => callback(err));
	}

	set(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
		const maxAge = session.cookie.maxAge ?? 86400000; // default 24h
		const expired = new Date(Date.now() + maxAge).toISOString();
		const sess = JSON.stringify(session);

		// Clean up expired sessions, then upsert
		this.db
			.execute({
				sql: "DELETE FROM sessions WHERE expired <= ?",
				args: [new Date().toISOString()],
			})
			.then(() =>
				this.db.execute({
					sql: "INSERT OR REPLACE INTO sessions (sid, sess, expired) VALUES (?, ?, ?)",
					args: [sid, sess, expired],
				}),
			)
			.then(() => callback?.())
			.catch((err) => callback?.(err));
	}

	destroy(sid: string, callback?: (err?: unknown) => void): void {
		this.db
			.execute({
				sql: "DELETE FROM sessions WHERE sid = ?",
				args: [sid],
			})
			.then(() => callback?.())
			.catch((err) => callback?.(err));
	}

	touch(sid: string, session: SessionData, callback?: () => void): void {
		const maxAge = session.cookie.maxAge ?? 86400000;
		const expired = new Date(Date.now() + maxAge).toISOString();

		this.db
			.execute({
				sql: "UPDATE sessions SET expired = ? WHERE sid = ?",
				args: [expired, sid],
			})
			.then(() => callback?.())
			.catch(() => callback?.());
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test tests/session-store.spec.ts -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/session-store.ts tests/session-store.spec.ts
git commit -m "feat: implement LibSQLSessionStore for persistent sessions"
```

---

### Task 3: Wire session store and production fixes into server.ts

**Files:**
- Modify: `server.ts:52-58` (session secret validation — already done, verify)
- Modify: `server.ts:76` (add trust proxy)
- Modify: `server.ts:156-168` (wire session store, fix cookie config)

- [ ] **Step 1: Add trust proxy setting**

In `server.ts`, add `app.set('trust proxy', 1)` right after `const app = express();` on line 76:

```typescript
const app = express();

// Trust first proxy (Railway reverse proxy) — required for secure cookies behind proxy
app.set("trust proxy", 1);
```

- [ ] **Step 2: Import and wire the session store**

Add import at the top of `server.ts` (after the existing imports, around line 22):

```typescript
import { LibSQLSessionStore } from "./src/session-store.js";
```

Update the session middleware config (lines 156-168) to use the store and fix the cookie:

```typescript
app.use(
	session({
		store: new LibSQLSessionStore(client),
		secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
		resave: false,
		saveUninitialized: false,
		cookie: {
			secure: isProduction,
			httpOnly: true,
			maxAge: 24 * 60 * 60 * 1000, // 24 hours
			sameSite: "lax",
		},
	}),
);
```

Changes from original:
- Added `store: new LibSQLSessionStore(client)`
- Changed `sameSite` from `isProduction ? "none" : "lax"` to just `"lax"` (no iframe = first-party cookies only)
- Removed the comment about cross-site iframe

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: All existing tests PASS. The session store is transparent to existing tests — they still use the same session middleware, just backed by Turso now instead of memory.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 5: Run build**

Run: `npm run build`
Expected: Compiles without errors.

- [ ] **Step 6: Manual smoke test**

Run: `npm run dev`
Then in browser:
1. Visit `http://localhost:3000` — should redirect to login
2. Log in with admin credentials — should work
3. Refresh the page — session should persist (not logged out)
4. Stop the server (Ctrl+C), restart with `npm run dev` — session should STILL persist (not in-memory anymore)

- [ ] **Step 7: Commit**

```bash
git add server.ts
git commit -m "feat: wire LibSQLSessionStore, add trust proxy, fix cookie config for production"
```

---

### Task 4: Verify all existing tests still pass (regression check)

**Files:** None (read-only verification)

- [ ] **Step 1: Run the full Playwright test suite**

Run: `npm run test`
Expected: All tests PASS. No regressions.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No new warnings or errors from the changes.

- [ ] **Step 3: Fix any lint issues if present**

Run: `npm run lint:fix` if needed.

- [ ] **Step 4: Commit lint fixes if any**

```bash
git add -A
git commit -m "fix: lint cleanup after session store integration"
```

(Skip this step if lint was clean.)

---

### Task 5: Railway deployment (manual steps — documented checklist)

This task is not code — it's a checklist for the user to follow in browser/terminal. The agent should present these steps to the user.

- [ ] **Step 1: Push code to GitHub**

Ensure all commits from Tasks 1-4 are pushed:

```bash
git push origin main
```

- [ ] **Step 2: Create Railway project**

1. Go to [railway.app](https://railway.app) and log in
2. Click "New Project" → "Deploy from GitHub Repo"
3. Select the `PanLuce/reservation-system` repository
4. Railway will auto-detect Node.js and use the existing `railway.json`

- [ ] **Step 3: Set environment variables in Railway dashboard**

Navigate to the service → Variables tab. Add:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | (generate with `openssl rand -hex 32`) |
| `TURSO_DATABASE_URL` | (your Turso cloud DB URL) |
| `TURSO_AUTH_TOKEN` | (your Turso auth token) |
| `ADMIN_EMAIL_SEED` | (your admin email) |
| `ADMIN_PASSWORD_SEED` | (strong admin password) |
| `ALLOWED_ORIGINS` | `https://centrumrubacek.cz,https://www.centrumrubacek.cz` |

- [ ] **Step 4: Configure custom domain**

1. In Railway: service Settings → Networking → Custom Domain
2. Add: `rezervace.centrumrubacek.cz`
3. Railway provides a CNAME target
4. In DNS provider: add CNAME record `rezervace` → Railway's CNAME target
5. Wait for DNS propagation and SSL provisioning

- [ ] **Step 5: Verify deployment**

```bash
curl https://rezervace.centrumrubacek.cz/health
curl https://rezervace.centrumrubacek.cz/ready
```

Both should return 200. Then visit `https://rezervace.centrumrubacek.cz` in browser and log in.

---

### Task 6: Create WordPress test page (manual — documented checklist)

This task is manual WordPress admin work. The agent should present these steps to the user.

- [ ] **Step 1: Create the page in WordPress**

1. WordPress Admin → Pages → Add New
2. Title: "Rezervacni system - Test"
3. Slug: `testovaci-rezervace-2026`
4. Set visibility to Private (or publish with the obscure slug)

- [ ] **Step 2: Add content**

Add a Custom HTML block with:

```html
<div style="text-align: center; padding: 40px 20px; max-width: 600px; margin: 0 auto;">
  <h2>Rezervacni system Centra Rubacek</h2>
  <p style="font-size: 16px; color: #555; margin-bottom: 30px;">
    Zde se muzete prihlasit, prohlednout nabidku lekci a prihlasit sve deti na cviceni.
  </p>
  <a href="https://rezervace.centrumrubacek.cz"
     style="display:inline-block; padding:15px 30px; background:#4CAF50; color:white;
     text-decoration:none; border-radius:8px; font-size:18px;">
     Vstoupit do rezervacniho systemu
  </a>
</div>
```

- [ ] **Step 3: Publish and test**

1. Save/Publish the page
2. Visit the page URL
3. Click the button — should open the reservation app
4. Log in → browse courses → test registration flow
