import { expect, test } from "@playwright/test";

const baseURL = process.env.SMOKE_BASE_URL;
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;

if (!baseURL || !email || !password) {
	throw new Error(
		"SMOKE_BASE_URL, SMOKE_EMAIL, and SMOKE_PASSWORD env vars are required",
	);
}

test("participant can log in to production", async ({ page }) => {
	test.setTimeout(90_000);

	await page.goto(`${baseURL}/login.html`);
	await page.fill("#login-email", email);
	await page.fill("#login-password", password);
	await page.click('button[type="submit"]');

	await expect(page.getByRole("button", { name: "Odhlásit se" })).toBeVisible({
		timeout: 30_000,
	});
});
