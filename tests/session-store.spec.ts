import { expect, test } from "@playwright/test";
import type { SessionData } from "express-session";
import {
	client,
	initializeDatabase,
	resetDatabaseForTests,
} from "../src/database.js";
import { LibSQLSessionStore } from "../src/session-store.js";

test.describe.configure({ mode: "serial" });

test.describe("Session Store - Schema", () => {
	test.beforeEach(async () => {
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("sessions table exists after initialization", async () => {
		const result = await client.execute({
			sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'",
			args: [],
		});
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]?.name).toBe("sessions");
	});

	test("index on expired column exists", async () => {
		const result = await client.execute({
			sql: "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_sessions_expired'",
			args: [],
		});
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]?.name).toBe("idx_sessions_expired");
	});
});

test.describe("Session Store - Operations", () => {
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

	test("set stores a session", async () => {
		await new Promise<void>((resolve, reject) => {
			store.set("sid_1", testSession, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		// Verify by reading DB directly
		const result = await client.execute({
			sql: "SELECT sid, sess, expired FROM sessions WHERE sid = ?",
			args: ["sid_1"],
		});
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0]?.sid).toBe("sid_1");
		const stored = JSON.parse(result.rows[0]?.sess as string);
		expect(stored.userId).toBe("user_123");
	});

	test("get retrieves a stored session", async () => {
		// Insert directly
		const expired = new Date(Date.now() + 86400000).toISOString();
		await client.execute({
			sql: "INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)",
			args: ["sid_2", JSON.stringify(testSession), expired],
		});

		const session = await new Promise<SessionData | null | undefined>(
			(resolve, reject) => {
				store.get("sid_2", (err, session) => {
					if (err) reject(err);
					else resolve(session);
				});
			},
		);

		expect(session).toBeDefined();
		expect(session).not.toBeNull();
		expect((session as unknown as Record<string, unknown>).userId).toBe(
			"user_123",
		);
	});

	test("get returns null for non-existent session", async () => {
		const session = await new Promise<SessionData | null | undefined>(
			(resolve, reject) => {
				store.get("nonexistent_sid", (err, session) => {
					if (err) reject(err);
					else resolve(session);
				});
			},
		);

		expect(session).toBeNull();
	});

	test("destroy removes a session", async () => {
		// Store a session first
		await new Promise<void>((resolve, reject) => {
			store.set("sid_destroy", testSession, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		// Destroy it
		await new Promise<void>((resolve, reject) => {
			store.destroy("sid_destroy", (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		// Verify it's gone
		const result = await client.execute({
			sql: "SELECT * FROM sessions WHERE sid = ?",
			args: ["sid_destroy"],
		});
		expect(result.rows).toHaveLength(0);
	});

	test("touch updates expiry without changing data", async () => {
		// Store a session first
		await new Promise<void>((resolve, reject) => {
			store.set("sid_touch", testSession, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		// Read the original expiry
		const before = await client.execute({
			sql: "SELECT expired, sess FROM sessions WHERE sid = ?",
			args: ["sid_touch"],
		});
		const originalExpiry = before.rows[0]?.expired as string;
		const originalSess = before.rows[0]?.sess as string;

		// Wait a tiny bit so the new expiry is different
		await new Promise((r) => setTimeout(r, 50));

		// Touch with a longer maxAge
		const touchSession: SessionData = {
			...testSession,
			cookie: { ...testSession.cookie, originalMaxAge: 172800000 },
		};
		await new Promise<void>((resolve) => {
			store.touch("sid_touch", touchSession, () => {
				resolve();
			});
		});

		// Read the updated expiry
		const after = await client.execute({
			sql: "SELECT expired, sess FROM sessions WHERE sid = ?",
			args: ["sid_touch"],
		});
		const newExpiry = after.rows[0]?.expired as string;
		const newSess = after.rows[0]?.sess as string;

		// Expiry should be updated (later)
		expect(new Date(newExpiry).getTime()).toBeGreaterThan(
			new Date(originalExpiry).getTime(),
		);
		// Session data should NOT have changed
		expect(newSess).toBe(originalSess);
	});

	test("set cleans up expired sessions", async () => {
		// Insert an already-expired session directly
		const pastDate = new Date(Date.now() - 1000).toISOString();
		await client.execute({
			sql: "INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)",
			args: ["expired_sid", JSON.stringify(testSession), pastDate],
		});

		// Verify it exists
		const before = await client.execute({
			sql: "SELECT * FROM sessions WHERE sid = ?",
			args: ["expired_sid"],
		});
		expect(before.rows).toHaveLength(1);

		// set() a new session — this should clean up expired ones
		await new Promise<void>((resolve, reject) => {
			store.set("fresh_sid", testSession, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		// The expired session should be gone
		const after = await client.execute({
			sql: "SELECT * FROM sessions WHERE sid = ?",
			args: ["expired_sid"],
		});
		expect(after.rows).toHaveLength(0);

		// The fresh session should be there
		const fresh = await client.execute({
			sql: "SELECT * FROM sessions WHERE sid = ?",
			args: ["fresh_sid"],
		});
		expect(fresh.rows).toHaveLength(1);
	});

	test("get returns null for expired session", async () => {
		// Insert an expired session directly
		const pastDate = new Date(Date.now() - 1000).toISOString();
		await client.execute({
			sql: "INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, ?)",
			args: ["expired_sid_2", JSON.stringify(testSession), pastDate],
		});

		const session = await new Promise<SessionData | null | undefined>(
			(resolve, reject) => {
				store.get("expired_sid_2", (err, session) => {
					if (err) reject(err);
					else resolve(session);
				});
			},
		);

		expect(session).toBeNull();
	});

	test("set overwrites existing session (upsert)", async () => {
		// Store initial session
		await new Promise<void>((resolve, reject) => {
			store.set("sid_upsert", testSession, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});

		// Update with different data
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

		// Should only be one row, with the updated data
		const result = await client.execute({
			sql: "SELECT * FROM sessions WHERE sid = ?",
			args: ["sid_upsert"],
		});
		expect(result.rows).toHaveLength(1);
		const stored = JSON.parse(result.rows[0]?.sess as string);
		expect(stored.userId).toBe("user_456");
	});
});
