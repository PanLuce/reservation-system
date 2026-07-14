import { expect, test } from "@playwright/test";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	LessonDB,
	resetDatabaseForTests,
} from "../src/database.js";
import { createLesson } from "../src/lesson.js";

import { BASE } from "./helpers/base.js";

// Payload renders as a visible marker if unescaped, and sets a flag on the
// window if it actually executes. Either signal proves the vulnerability.
const XSS_NAME =
	'<img src=x onerror="window.__xssFired = true">Zlobivá Maminka';

async function loginAsAdmin(page: import("@playwright/test").Page) {
	await page.goto(`${BASE}/login.html`);
	await page.fill("#login-email", "admin@centrumrubacek.cz");
	await page.fill("#login-password", "admin123");
	await page.click('button[type="submit"]');
	await page.waitForURL(`${BASE}/`, { timeout: 10000 });
	await page.waitForSelector("#calendar-grid", { timeout: 10000 });
}

test.describe("Stored XSS via public registration name", () => {
	let lessonId: string;

	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();

		const course = createCourse({
			name: "Test skupinka XSS",
			ageGroup: "1 - 2 roky",
		});
		await CourseDB.insert(course);

		const today = new Date();
		const future = new Date(today);
		future.setDate(today.getDate() + 7);
		const lesson = createLesson({
			title: "XSS test lekce",
			date: future.toISOString().slice(0, 10),
			dayOfWeek: "Monday",
			time: "10:00",
			ageGroup: "1 - 2 roky",
			capacity: 10,
		});
		await LessonDB.insertWithCourse(lesson, course.id);
		lessonId = lesson.id;

		// Register the malicious participant through the UNAUTHENTICATED public endpoint.
		const res = await fetch(`${BASE}/api/registrations`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				lessonId,
				participant: {
					name: XSS_NAME,
					email: "zlobiva@test.cz",
					phone: "",
					ageGroup: "1 - 2 roky",
				},
			}),
		});
		expect(res.status).toBe(201);
	});

	test("participant name is not executed or rendered as HTML in the admin Maminky table", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		await page.click('[data-tab="participants"]');
		await page.waitForSelector("#participants-list", { state: "visible" });
		await expect(page.locator("#participants-list")).toContainText(
			"Zlobivá Maminka",
		);

		const fired = await page.evaluate(
			() => (window as unknown as { __xssFired?: boolean }).__xssFired,
		);
		expect(fired).toBeUndefined();

		const rawHtml = await page.locator("#participants-list").innerHTML();
		expect(rawHtml).not.toContain("<img src=x");
	});

	test("participant name is not executed or rendered as HTML in the participant detail modal", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		await page.click('[data-tab="participants"]');
		await page.waitForSelector("#participants-list", { state: "visible" });
		await page.locator("#participants-list tbody tr").first().click();
		await page.waitForSelector("#participant-modal", { state: "visible" });

		const fired = await page.evaluate(
			() => (window as unknown as { __xssFired?: boolean }).__xssFired,
		);
		expect(fired).toBeUndefined();

		const rawHtml = await page.locator("#participant-modal-body").innerHTML();
		expect(rawHtml).not.toContain("<img src=x");
	});
});
