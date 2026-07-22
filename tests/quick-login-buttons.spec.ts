import { expect, test } from "@playwright/test";
import {
	ensureDemoParticipant,
	initializeDatabase,
	resetDatabaseForTests,
} from "../src/database.js";

import { BASE } from "./helpers/base.js";

test.describe
	.serial("Quick-login buttons", () => {
		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			process.env.PARTICIPANT_EMAIL_SEED = "maminka@test.cz";
			process.env.PARTICIPANT_PASSWORD_SEED = "test123";
			await initializeDatabase();
			await resetDatabaseForTests();
			await ensureDemoParticipant();
		});

		test("both quick-login buttons render on the login page", async ({
			page,
		}) => {
			await page.goto(`${BASE}/login.html`);

			await expect(
				page.getByRole("button", { name: "Přihlásit jako admin" }),
			).toBeVisible();
			await expect(
				page.getByRole("button", { name: "Přihlásit jako rodič" }),
			).toBeVisible();
		});

		test("clicking the admin quick-login button logs in as admin", async ({
			page,
		}) => {
			await page.goto(`${BASE}/login.html`);

			await page.getByRole("button", { name: "Přihlásit jako admin" }).click();

			await page.waitForURL(`${BASE}/`, { timeout: 10000 });
			await expect(page.locator("#user-role")).toHaveClass(/role-badge--admin/);
		});

		test("clicking the parent quick-login button logs in as the participant", async ({
			page,
		}) => {
			await page.goto(`${BASE}/login.html`);

			await page.getByRole("button", { name: "Přihlásit jako rodič" }).click();

			await page.waitForURL(`${BASE}/`, { timeout: 10000 });
			await expect(page.locator("#user-role")).toHaveClass(
				/role-badge--participant/,
			);
		});
	});
