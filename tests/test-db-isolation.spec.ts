import { expect, test } from "@playwright/test";
import {
	assertDatabaseIsResettable,
	perWorkerTestDatabaseUrl,
} from "../src/database.js";

// npm test must never touch the dev or production database. The Playwright
// config forces a dedicated file: test DB for both the test-runner process
// and the webServer, and resetDatabaseForTests refuses anything remote.

test.describe("test database isolation", () => {
	test("test run is wired to the dedicated test database", () => {
		expect(process.env.TURSO_DATABASE_URL).toBe("file:./data/test.db");
	});

	test("refuses to reset a remote libsql database", () => {
		expect(() =>
			assertDatabaseIsResettable("libsql://prod-db.turso.io"),
		).toThrow(/refusing to reset/i);
	});

	test("refuses to reset an https-based remote database", () => {
		expect(() =>
			assertDatabaseIsResettable("https://prod-db.turso.io"),
		).toThrow(/refusing to reset/i);
	});

	test("allows resetting a local file database", () => {
		expect(() =>
			assertDatabaseIsResettable("file:./data/test.db"),
		).not.toThrow();
	});
});

test.describe("per-worker test database URL", () => {
	test("appends the worker index to a local test database file", () => {
		expect(
			perWorkerTestDatabaseUrl("file:./data/test.db", {
				nodeEnv: "test",
				parallelIndex: "2",
			}),
		).toBe("file:./data/test-2.db");
	});

	test("maps worker index 0 to its own file (no shared test.db)", () => {
		expect(
			perWorkerTestDatabaseUrl("file:./data/test.db", {
				nodeEnv: "test",
				parallelIndex: "0",
			}),
		).toBe("file:./data/test-0.db");
	});

	test("leaves the URL untouched when no worker index is present", () => {
		expect(
			perWorkerTestDatabaseUrl("file:./data/test.db", {
				nodeEnv: "test",
				parallelIndex: undefined,
			}),
		).toBe("file:./data/test.db");
	});

	test("never rewrites outside test mode", () => {
		expect(
			perWorkerTestDatabaseUrl("file:./data/reservations.db", {
				nodeEnv: "production",
				parallelIndex: "1",
			}),
		).toBe("file:./data/reservations.db");
	});

	test("never rewrites a remote libsql URL", () => {
		expect(
			perWorkerTestDatabaseUrl("libsql://prod-db.turso.io", {
				nodeEnv: "test",
				parallelIndex: "1",
			}),
		).toBe("libsql://prod-db.turso.io");
	});
});
