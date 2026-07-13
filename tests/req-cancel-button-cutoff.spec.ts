import { expect, test } from "@playwright/test";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	ensureDemoParticipant,
	initializeDatabase,
	LessonDB,
	RegistrationDB,
	resetDatabaseForTests,
} from "../src/database.js";

import { BASE } from "./helpers/base.js";

// Mirrors localDateString() in public/app.js — the cutoff compares local
// calendar dates, so the test must create lessons on the local date too,
// or it goes flaky between 00:00–02:00 Prague time (UTC offset).
function localDateString(date = new Date()) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function loginAsParticipant(page: import("@playwright/test").Page) {
	await page.goto(`${BASE}/login.html`);
	await page.fill("#login-email", "maminka@test.cz");
	await page.fill("#login-password", "test123");
	await page.click('button[type="submit"]');
	await page.waitForURL(`${BASE}/`, { timeout: 10000 });
	await page.waitForSelector("#calendar-grid", { timeout: 10000 });
}

async function openMyReservationsTab(page: import("@playwright/test").Page) {
	await page.click('[data-tab="my-reservations"]');
	await page.waitForSelector("#my-lessons-list", { timeout: 5000 });
}

test.describe("REQ: Cancel button disabled after midnight cutoff", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		process.env.PARTICIPANT_EMAIL_SEED = "maminka@test.cz";
		process.env.PARTICIPANT_PASSWORD_SEED = "test123";
		await initializeDatabase();
		await resetDatabaseForTests();
		await ensureDemoParticipant();
	});

	test("cancel button is disabled for a lesson scheduled today (past midnight cutoff)", async ({
		page,
	}) => {
		const course = createCourse({
			name: "Cutoff Test Course",
			ageGroup: "1 - 2 roky",
			color: "#AABBCC",
		});
		await CourseDB.insert(course);

		const todayStr = localDateString();

		await LessonDB.insert(
			{
				id: "lesson_cutoff_today",
				title: "Today Cutoff Lesson",
				date: todayStr,
				dayOfWeek: "Monday",
				time: "10:00",
				location: "Studio",
				ageGroup: "1 - 2 roky",
				capacity: 10,
				enrolledCount: 1,
			},
			course.id,
		);

		await RegistrationDB.insert({
			id: "reg_cutoff_today",
			lessonId: "lesson_cutoff_today",
			participantId: "demo_participant_seed",
			status: "confirmed",
		});

		await loginAsParticipant(page);
		await openMyReservationsTab(page);

		const cancelButton = page
			.locator(".lesson-card")
			.filter({ hasText: "Today Cutoff Lesson" })
			.locator("button", { hasText: "Odhlásit" });

		await expect(cancelButton).toBeDisabled();
	});

	test("cancel button is enabled for a lesson scheduled tomorrow (before midnight cutoff)", async ({
		page,
	}) => {
		const course = createCourse({
			name: "Future Test Course",
			ageGroup: "1 - 2 roky",
			color: "#CCBBAA",
		});
		await CourseDB.insert(course);

		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		const tomorrowStr = localDateString(tomorrow);

		await LessonDB.insert(
			{
				id: "lesson_cutoff_tomorrow",
				title: "Tomorrow Cutoff Lesson",
				date: tomorrowStr,
				dayOfWeek: "Tuesday",
				time: "10:00",
				location: "Studio",
				ageGroup: "1 - 2 roky",
				capacity: 10,
				enrolledCount: 1,
			},
			course.id,
		);

		await RegistrationDB.insert({
			id: "reg_cutoff_tomorrow",
			lessonId: "lesson_cutoff_tomorrow",
			participantId: "demo_participant_seed",
			status: "confirmed",
		});

		await loginAsParticipant(page);
		await openMyReservationsTab(page);

		const cancelButton = page
			.locator(".lesson-card")
			.filter({ hasText: "Tomorrow Cutoff Lesson" })
			.locator("button", { hasText: "Odhlásit" });

		await expect(cancelButton).toBeEnabled();
	});
});
