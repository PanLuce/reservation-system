import { expect, test } from "@playwright/test";
import { initializeDatabase, resetDatabaseForTests } from "../src/database.js";
import { isQuickLoginEnabled } from "../src/env-flags.js";

const BASE = "http://localhost:3000";

// Endpoint is opt-in: served only when ENABLE_QUICK_LOGIN=true.
// webServer in playwright.config.ts sets ENABLE_QUICK_LOGIN=true, so the
// E2E tests below cover the enabled path; the disabled path is covered by
// the unit tests on the gate helper (one shared webServer cannot run both).

test.describe("isQuickLoginEnabled", () => {
	test("is disabled when the flag is unset", () => {
		expect(isQuickLoginEnabled(undefined)).toBe(false);
	});

	test("is disabled for empty string", () => {
		expect(isQuickLoginEnabled("")).toBe(false);
	});

	test("is disabled for 'false'", () => {
		expect(isQuickLoginEnabled("false")).toBe(false);
	});

	test("is disabled for near-miss values like '1' and 'TRUE'", () => {
		expect(isQuickLoginEnabled("1")).toBe(false);
		expect(isQuickLoginEnabled("TRUE")).toBe(false);
	});

	test("is enabled only for exact 'true'", () => {
		expect(isQuickLoginEnabled("true")).toBe(true);
	});
});

test.describe
	.serial("GET /api/test-accounts", () => {
		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			process.env.PARTICIPANT_EMAIL_SEED = "maminka@test.cz";
			process.env.PARTICIPANT_PASSWORD_SEED = "test123";
			await initializeDatabase();
			await resetDatabaseForTests();
		});

		test("returns both accounts when quick login is enabled", async () => {
			const res = await fetch(`${BASE}/api/test-accounts`);
			expect(res.status).toBe(200);
			const data = (await res.json()) as {
				accounts: {
					label: string;
					email: string;
					password: string;
					role: string;
				}[];
			};
			expect(data.accounts).toHaveLength(2);
		});

		test("admin account has correct shape and role", async () => {
			const res = await fetch(`${BASE}/api/test-accounts`);
			const data = (await res.json()) as {
				accounts: {
					label: string;
					email: string;
					password: string;
					role: string;
				}[];
			};
			const admin = data.accounts.find((a) => a.role === "admin");
			expect(admin).toBeDefined();
			expect(admin?.email).toBe("admin@centrumrubacek.cz");
			expect(admin?.password).toBe("admin123");
			expect(admin?.label).toBeTruthy();
		});

		test("participant account has correct shape and role", async () => {
			const res = await fetch(`${BASE}/api/test-accounts`);
			const data = (await res.json()) as {
				accounts: {
					label: string;
					email: string;
					password: string;
					role: string;
				}[];
			};
			const participant = data.accounts.find((a) => a.role === "participant");
			expect(participant).toBeDefined();
			expect(participant?.email).toBe("maminka@test.cz");
			expect(participant?.password).toBe("test123");
			expect(participant?.label).toBeTruthy();
		});
	});
