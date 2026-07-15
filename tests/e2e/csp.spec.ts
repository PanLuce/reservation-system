import { expect, test } from "@playwright/test";
import {
	initializeDatabase,
	resetDatabaseForTests,
} from "../../src/database.js";
import { BASE } from "../helpers/base.js";

async function loginAsAdmin(page: import("@playwright/test").Page) {
	await page.goto(`${BASE}/login.html`);
	await page.fill("#login-email", "admin@centrumrubacek.cz");
	await page.fill("#login-password", "admin123");
	await page.click('button[type="submit"]');
	await page.waitForURL(`${BASE}/`, { timeout: 10000 });
	await page.waitForSelector("#calendar-grid", { timeout: 10000 });
}

// The browser auto-requests /favicon.ico on every navigation (404, no favicon
// in public/) and /api/test-accounts 404s outside quick-login test mode;
// neither is related to CSP or app wiring, and Chrome's console error text
// for failed resource loads never includes the URL, so string-matching the
// message can't distinguish them — stop the requests from 404ing instead.
async function suppressBenign404s(page: import("@playwright/test").Page) {
	await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
	await page.route("**/api/test-accounts", (route) =>
		route.fulfill({ status: 200, json: { accounts: [] } }),
	);
}

test.describe("CSP — script-src / script-src-attr tightened", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("/ response header disallows inline scripts and inline handlers", async ({
		request,
	}) => {
		const response = await request.get(`${BASE}/`, {
			maxRedirects: 0,
			failOnStatusCode: false,
		});
		const csp = response.headers()["content-security-policy"];
		expect(csp).toBeTruthy();
		expect(csp).toContain("script-src 'self'");
		expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
		expect(csp).toContain("script-src-attr 'none'");
	});

	test("/login.html response header disallows inline scripts and inline handlers", async ({
		request,
	}) => {
		const response = await request.get(`${BASE}/login.html`);
		const csp = response.headers()["content-security-policy"];
		expect(csp).toBeTruthy();
		expect(csp).toContain("script-src 'self'");
		expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
		expect(csp).toContain("script-src-attr 'none'");
	});

	test("login page loads and functions with no console/page errors under the tightened policy", async ({
		page,
	}) => {
		await suppressBenign404s(page);
		const consoleErrors: string[] = [];
		const pageErrors: string[] = [];
		page.on("console", (msg) => {
			if (msg.type() === "error") consoleErrors.push(msg.text());
		});
		page.on("pageerror", (error) => pageErrors.push(error.message));

		await page.goto(`${BASE}/login.html`);
		await page.click('button[type="submit"]').catch(() => {});

		// Switching tabs exercises login.js's own event wiring (not inline handlers).
		await page.getByRole("button", { name: "Registrace" }).click();
		await page.getByRole("button", { name: "Přihlášení" }).click();

		expect(pageErrors).toHaveLength(0);
		expect(consoleErrors).toHaveLength(0);
	});

	test("main app loads and every tab is reachable with no console/page errors under the tightened policy", async ({
		page,
	}) => {
		await suppressBenign404s(page);
		const consoleErrors: string[] = [];
		const pageErrors: string[] = [];
		page.on("console", (msg) => {
			if (msg.type() === "error") consoleErrors.push(msg.text());
		});
		page.on("pageerror", (error) => pageErrors.push(error.message));

		await loginAsAdmin(page);

		for (const tab of ["courses", "excel", "participants", "lessons"]) {
			await page.click(`button[data-tab="${tab}"]`);
			await page.waitForSelector(`#${tab}.tab-content.active`);
		}

		expect(pageErrors).toHaveLength(0);
		expect(consoleErrors).toHaveLength(0);
	});
});
