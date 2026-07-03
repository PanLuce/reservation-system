import { expect, test } from "@playwright/test";
import { assertDatabaseIsResettable } from "../src/database.js";

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
