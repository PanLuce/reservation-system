import { expect, test } from "@playwright/test";
import {
	ensureDemoParticipant,
	initializeDatabase,
	resetDatabaseForTests,
} from "../src/database.js";

import { BASE } from "./helpers/base.js";

async function loginAsAdmin(page: import("@playwright/test").Page) {
	await page.goto(`${BASE}/login.html`);
	await page.fill("#login-email", "admin@centrumrubacek.cz");
	await page.fill("#login-password", "admin123");
	await page.click('button[type="submit"]');
	await page.waitForURL(`${BASE}/`, { timeout: 10000 });
	await page.waitForSelector("#calendar-grid", { timeout: 10000 });
}

async function openSkupinkyTab(page: import("@playwright/test").Page) {
	await page.click('[data-tab="courses"]');
	await page.waitForSelector("#courses-list", { timeout: 5000 });
}

async function openLekceTab(page: import("@playwright/test").Page) {
	await page.click('[data-tab="lessons"]');
	await page.waitForSelector("#calendar-grid", { timeout: 5000 });
}

test.describe("REQ-1: Tab switch resets open create/edit forms", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		process.env.PARTICIPANT_EMAIL_SEED = "maminka@test.cz";
		process.env.PARTICIPANT_PASSWORD_SEED = "test123";
		await initializeDatabase();
		await resetDatabaseForTests();
		await ensureDemoParticipant();
	});

	test("returning to the Skupinky tab no longer shows a stale 'Nová skupinka' form", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await openSkupinkyTab(page);

		await page.click('[data-action="show-add-course-form"]');
		await page.waitForSelector("#add-course-form", { state: "visible" });

		await openLekceTab(page);
		await openSkupinkyTab(page);

		await expect(page.locator("#add-course-form")).toBeHidden();
	});

	test("returning to the Skupinky tab no longer shows a stale 'Nový kurz' form", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await openSkupinkyTab(page);

		await page.click('[data-action="show-add-program-form"]');
		await page.waitForSelector("#add-program-form", { state: "visible" });

		await openLekceTab(page);
		await openSkupinkyTab(page);

		await expect(page.locator("#add-program-form")).toBeHidden();
	});

	test("returning to the Lekce tab no longer shows a stale 'Nová Lekce' form", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await openLekceTab(page);

		await page.click('[data-action="show-add-lesson-form"]');
		await page.waitForSelector("#add-lesson-form", { state: "visible" });

		await openSkupinkyTab(page);
		await openLekceTab(page);

		await expect(page.locator("#add-lesson-form")).toBeHidden();
		await expect(page.locator("#lessons-calendar-block")).toBeVisible();
	});
});
