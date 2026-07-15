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
// in public/), and login.js's quick-login loader hits /api/test-accounts
// (404 outside quick-login test mode) whenever a test logs in via login.html.
// Neither is related to app wiring. Chrome's console error text for failed
// resource loads never includes the URL, so string-matching the message
// can't distinguish them — stop the requests from 404ing instead.
async function suppressBenign404s(page: import("@playwright/test").Page) {
	await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
	await page.route("**/api/test-accounts", (route) =>
		route.fulfill({ status: 200, json: { accounts: [] } }),
	);
}

/**
 * Test Suite: CSS File Loading Verification
 *
 * Purpose: Verify that styles.css loads correctly from the server
 * This is a focused test to check the static file path fix
 */

test.describe("CSS File Loading - Direct Check", () => {
	test("styles.css should return 200 OK", async ({ request }) => {
		// Act: Fetch CSS file directly
		const response = await request.get(`${BASE}/styles.css`);

		// Assert: Returns 200
		expect(response.status()).toBe(200);

		// Assert: Content type is CSS
		const contentType = response.headers()["content-type"];
		expect(contentType).toContain("css");

		// Assert: File has content
		const text = await response.text();
		expect(text.length).toBeGreaterThan(1000); // styles.css is ~4.7KB
		expect(text).toContain("linear-gradient"); // Should have gradients
		expect(text).toContain(".container"); // Should have container class
	});

	test("js/main.js should return 200 OK as a JS module", async ({
		request,
	}) => {
		// Act: Fetch JS file directly
		const response = await request.get(`${BASE}/js/main.js`);

		// Assert: Returns 200
		expect(response.status()).toBe(200);

		// Assert: Content type is JavaScript (modules refuse to execute on a wrong MIME type)
		const contentType = response.headers()["content-type"];
		expect(contentType).toMatch(/javascript|ecmascript/);

		// Assert: File has content
		const text = await response.text();
		expect(text.length).toBeGreaterThan(1000);
	});

	test("every public/js module returns 200 OK with a JS MIME type", async ({
		request,
	}) => {
		const modules = [
			"actions",
			"auth",
			"calendar",
			"courses",
			"lessons",
			"main",
			"ods-import",
			"participants",
			"reservations",
			"state",
			"utils",
		];
		for (const name of modules) {
			const response = await request.get(`${BASE}/js/${name}.js`);
			expect(response.status(), `${name}.js status`).toBe(200);
			expect(
				response.headers()["content-type"],
				`${name}.js content-type`,
			).toMatch(/javascript|ecmascript/);
		}
	});
});

test.describe("Dashboard Page - CSS Applied", () => {
	test("dashboard should load styles.css successfully", async ({ page }) => {
		// Arrange: Track network requests
		const cssRequests: Array<{ url: string; status: number }> = [];
		page.on("response", (response) => {
			if (response.url().endsWith("styles.css")) {
				cssRequests.push({
					url: response.url(),
					status: response.status(),
				});
			}
		});

		// Act: Navigate to dashboard (redirects to login if not authenticated)
		await page.goto(`${BASE}/`);

		// Assert: CSS was requested
		expect(cssRequests.length).toBeGreaterThan(0);

		// Assert: CSS request returned 200
		const successfulCss = cssRequests.filter((req) => req.status === 200);
		expect(successfulCss.length).toBeGreaterThan(0);
	});

	test("login page should have warm brand background", async ({ page }) => {
		// Arrange
		await page.goto(`${BASE}/login.html`);
		await page.waitForLoadState("networkidle");

		// Act: Get body background color
		const bodyBg = await page.evaluate(() => {
			const body = document.body;
			const computed = window.getComputedStyle(body);
			return {
				backgroundColor: computed.backgroundColor,
			};
		});

		// Assert: Should have the warm off-white brand background (#f5f0eb)
		// rgb(245, 240, 235) is the computed value of #f5f0eb
		expect(bodyBg.backgroundColor).toBe("rgb(245, 240, 235)");
	});
});

test.describe("Static Assets - No 404 Errors", () => {
	test("loading dashboard should not result in 404 for CSS/JS", async ({
		page,
	}) => {
		// Arrange: Track 404 responses
		const failed404: string[] = [];

		page.on("response", (response) => {
			if (response.status() === 404) {
				failed404.push(response.url());
			}
		});

		// Act: Navigate to homepage
		await page.goto(`${BASE}/`);
		await page.waitForLoadState("networkidle");

		// Assert: No 404s for styles.css or the main module entry point
		const cssJs404 = failed404.filter(
			(url) => url.includes("styles.css") || url.includes("main.js"),
		);

		if (cssJs404.length > 0) {
			console.log("❌ 404 Errors found:", cssJs404);
		}

		expect(cssJs404).toHaveLength(0);
	});
});

// ─── Wiring invariant ──────────────────────────────────────────────────────────
// public/js/* dispatches all interactivity through data-action/data-change/data-submit
// attributes rather than inline onclick=/onchange=/onsubmit=. The dispatcher
// console.errors whenever an element carries an unregistered action, and a module
// script that fails to load/parse throws a pageerror — either failure mode is
// caught here by driving the real UI and asserting the console/page stayed clean.
test.describe("Interactive Elements - Action Wiring", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("clicking through every tab produces no console errors or page errors", async ({
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

	test("opening and closing the add-lesson form produces no console errors", async ({
		page,
	}) => {
		await suppressBenign404s(page);
		const consoleErrors: string[] = [];
		page.on("console", (msg) => {
			if (msg.type() === "error") consoleErrors.push(msg.text());
		});

		await loginAsAdmin(page);

		await page.click('button[data-action="show-add-lesson-form"]');
		await page.waitForSelector("#add-lesson-form", { state: "visible" });
		await page.click('button[data-action="hide-add-lesson-form"]');
		await page.waitForSelector("#add-lesson-form", { state: "hidden" });

		expect(consoleErrors).toHaveLength(0);
	});
});
