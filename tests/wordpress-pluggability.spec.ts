import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import {
	DEFAULT_ADMIN_EMAIL,
	DEFAULT_ADMIN_PASSWORD,
	initializeDatabase,
	resetDatabaseForTests,
} from "../src/database.js";

// Proves the subdomain-redirect contract described in
// docs/WORDPRESS_INTEGRATION.md: a plain top-level link from WordPress must
// land on the app's own login page, first-party session cookies must work,
// and the health/public-read surface a WordPress admin depends on must be up.

const BASE = "http://localhost:3000";
const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url));
const MOCK_WORDPRESS_PAGE = `file://${path.join(FIXTURE_DIR, "fixtures", "mock-wordpress.html")}`;

test.describe("WordPress pluggability — subdomain redirect", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = DEFAULT_ADMIN_EMAIL;
		process.env.ADMIN_PASSWORD_SEED = DEFAULT_ADMIN_PASSWORD;
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("unauthenticated GET / redirects to /login.html", async ({ page }) => {
		await page.goto(`${BASE}/`);

		expect(new URL(page.url()).pathname).toBe("/login.html");
	});

	test("session cookie is host-scoped and SameSite=Lax after login", async ({
		request,
	}) => {
		const res = await request.post(`${BASE}/api/auth/login`, {
			data: { email: DEFAULT_ADMIN_EMAIL, password: DEFAULT_ADMIN_PASSWORD },
		});
		expect(res.status()).toBe(200);

		const setCookie = res.headers()["set-cookie"] ?? "";
		expect(setCookie).toContain("connect.sid=");
		expect(setCookie.toLowerCase()).not.toContain("domain=");
		expect(setCookie).toContain("SameSite=Lax");
	});

	test("GET /health and GET /ready are reachable without auth", async ({
		request,
	}) => {
		const health = await request.get(`${BASE}/health`);
		expect(health.status()).toBe(200);
		expect((await health.json()).status).toBe("ok");

		const ready = await request.get(`${BASE}/ready`);
		expect(ready.status()).toBe(200);
		expect((await ready.json()).status).toBe("ready");
	});

	test("GET /api/lessons is a public read, no auth required", async ({
		request,
	}) => {
		const res = await request.get(`${BASE}/api/lessons`);

		expect(res.status()).toBe(200);
		expect(Array.isArray(await res.json())).toBe(true);
	});

	test("clicking the WordPress link navigates into the app's login page", async ({
		page,
	}) => {
		await page.goto(MOCK_WORDPRESS_PAGE);

		await page.click("#rezervace-link");
		await page.waitForURL(`${BASE}/login.html`);

		expect(new URL(page.url()).pathname).toBe("/login.html");
	});
});
