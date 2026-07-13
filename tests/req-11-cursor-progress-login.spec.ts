import { expect, test } from "@playwright/test";
import { initializeDatabase, resetDatabaseForTests } from "../src/database.js";

import { BASE } from "./helpers/base.js";

test.describe("REQ-11: Login page — busy cursor feedback", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("body gets is-busy class while login fetch is in flight", async ({
		page,
	}) => {
		await page.goto(`${BASE}/login.html`);

		await page.route("**/api/auth/login", async (route) => {
			await new Promise((r) => setTimeout(r, 300));
			await route.continue();
		});

		await page.fill("#login-email", "admin@centrumrubacek.cz");
		await page.fill("#login-password", "admin123");

		const busyObserved = page.evaluate(
			() =>
				new Promise<boolean>((resolve) => {
					const observer = new MutationObserver(() => {
						if (document.body.classList.contains("is-busy")) {
							observer.disconnect();
							resolve(true);
						}
					});
					observer.observe(document.body, {
						attributes: true,
						attributeFilter: ["class"],
					});
					setTimeout(() => {
						observer.disconnect();
						resolve(false);
					}, 600);
				}),
		);

		await page.click('button[type="submit"]');

		expect(await busyObserved).toBe(true);
	});

	test("is-busy is cleared after failed login", async ({ page }) => {
		await page.goto(`${BASE}/login.html`);

		await page.fill("#login-email", "wrong@example.cz");
		await page.fill("#login-password", "wrongpass");
		await page.click('button[type="submit"]');

		await expect(page.locator("#error-message")).toBeVisible();
		const isBusy = await page.evaluate(() =>
			document.body.classList.contains("is-busy"),
		);
		expect(isBusy).toBe(false);
	});
});
