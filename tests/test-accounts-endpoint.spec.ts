import { expect, test } from "@playwright/test";
import { initializeDatabase, resetDatabaseForTests } from "../src/database.js";

const BASE = "http://localhost:3000";

// Endpoint is always-on by default (hidden only when ENABLE_QUICK_LOGIN=false).
// webServer in playwright.config.ts does NOT set ENABLE_QUICK_LOGIN=false,
// so these tests run against the live default behaviour.

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

		test("always returns both accounts by default", async () => {
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
