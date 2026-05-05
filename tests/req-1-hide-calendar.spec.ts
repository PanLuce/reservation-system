import { expect, test } from "@playwright/test";
import {
	CourseDB,
	initializeDatabase,
	resetDatabaseForTests,
} from "../src/database.js";
import { createCourse } from "../src/course.js";

const BASE = "http://localhost:3000";

async function loginAsAdmin(page: import("@playwright/test").Page) {
	await page.goto(`${BASE}/login.html`);
	await page.fill("#login-email", "admin@centrumrubacek.cz");
	await page.fill("#login-password", "admin123");
	await page.click('button[type="submit"]');
	await page.waitForURL(`${BASE}/`, { timeout: 10000 });
	await page.waitForSelector("#calendar-grid", { timeout: 10000 });
}

test.describe("REQ-1: Hide calendar while create-lekce form is open", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();
		await CourseDB.insert(
			createCourse({ name: "Test skupinka", ageGroup: "1 - 2 roky" }),
		);
	});

	test("calendar is visible on Lekce tab by default", async ({ page }) => {
		await loginAsAdmin(page);

		// Arrange: we are on the Lekce tab (default)
		// Assert: calendar block is visible
		await expect(page.locator("#lessons-calendar-block")).toBeVisible();
	});

	test("calendar is hidden when create form is opened", async ({ page }) => {
		await loginAsAdmin(page);

		// Act: open the create-lekce form
		await page.click('button[onclick="showAddLessonForm()"]');
		await expect(page.locator("#add-lesson-form")).toBeVisible();

		// Assert: calendar block is hidden
		await expect(page.locator("#lessons-calendar-block")).toBeHidden();
	});

	test("calendar is restored after clicking Zrušit", async ({ page }) => {
		await loginAsAdmin(page);

		await page.click('button[onclick="showAddLessonForm()"]');
		await expect(page.locator("#add-lesson-form")).toBeVisible();

		// Act: cancel the form
		await page.click('button[onclick="hideAddLessonForm()"]');

		// Assert: calendar is back
		await expect(page.locator("#lessons-calendar-block")).toBeVisible();
	});
});
