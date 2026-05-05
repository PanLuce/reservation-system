import { expect, test } from "@playwright/test";
import {
	initializeDatabase,
	resetDatabaseForTests,
} from "../src/database.js";

const BASE = "http://localhost:3000";

async function loginAsAdmin(page: import("@playwright/test").Page) {
	await page.goto(`${BASE}/login.html`);
	await page.fill("#login-email", "admin@centrumrubacek.cz");
	await page.fill("#login-password", "admin123");
	await page.click('button[type="submit"]');
	await page.waitForURL(`${BASE}/`, { timeout: 10000 });
	await page.waitForSelector("#calendar-grid", { timeout: 10000 });
}

test.describe("REQ-2: Global loading feedback", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("global progress bar element exists in the DOM", async ({ page }) => {
		await loginAsAdmin(page);

		await expect(page.locator("#global-progress")).toBeAttached();
	});

	test("body gets is-busy class during a slow fetch", async ({ page }) => {
		// Log in first so we're on the main page
		await loginAsAdmin(page);
		await page.waitForLoadState("networkidle");

		// Intercept the next /api/lessons call with a 400ms delay
		await page.route("**/api/lessons", async (route) => {
			await new Promise((r) => setTimeout(r, 400));
			await route.continue();
		});

		// Trigger a calendar reload and observe is-busy appearing
		const busyObserved = page.evaluate(
			() =>
				new Promise<boolean>((resolve) => {
					const observer = new MutationObserver(() => {
						if (document.body.classList.contains("is-busy")) {
							observer.disconnect();
							resolve(true);
						}
					});
					observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
					setTimeout(() => { observer.disconnect(); resolve(false); }, 800);
				}),
		);

		// Trigger a calendar reload (calls fetch internally)
		await page.evaluate(() => (window as unknown as Record<string, () => void>).loadCalendar());

		expect(await busyObserved).toBe(true);
	});

	test("body does not have is-busy class after page fully loads", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		// Wait for network to settle
		await page.waitForLoadState("networkidle");

		const isBusy = await page.evaluate(() =>
			document.body.classList.contains("is-busy"),
		);
		expect(isBusy).toBe(false);
	});
});
