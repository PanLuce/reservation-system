import { expect, test } from "@playwright/test";
import { resolveDatabaseUrl } from "../src/database.js";

// Prevents REQUIREMENTS.md item 10: a missing TURSO_DATABASE_URL in production
// must never silently fall back to an ephemeral local SQLite file (data loss
// on every Render redeploy) — it must fail loud instead.

test.describe("resolveDatabaseUrl", () => {
	test("throws when production and TURSO_DATABASE_URL is missing", () => {
		expect(() =>
			resolveDatabaseUrl({ isProduction: true, tursoDatabaseUrl: undefined }),
		).toThrow(/TURSO_DATABASE_URL is required in production/i);
	});

	test("returns the env URL when production and TURSO_DATABASE_URL is set", () => {
		const result = resolveDatabaseUrl({
			isProduction: true,
			tursoDatabaseUrl: "libsql://prod-db.turso.io",
		});
		expect(result).toBe("libsql://prod-db.turso.io");
	});

	test("returns the env URL when not production and set", () => {
		const result = resolveDatabaseUrl({
			isProduction: false,
			tursoDatabaseUrl: "file:./data/test.db",
		});
		expect(result).toBe("file:./data/test.db");
	});

	test("returns the local file fallback when not production and unset", () => {
		const result = resolveDatabaseUrl({
			isProduction: false,
			tursoDatabaseUrl: undefined,
		});
		expect(result.startsWith("file:")).toBe(true);
		expect(result).toContain("reservations.db");
	});
});
