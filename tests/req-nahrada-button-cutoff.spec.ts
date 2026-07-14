import { expect, test } from "@playwright/test";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	CreditDB,
	ensureDemoParticipant,
	initializeDatabase,
	LessonDB,
	ParticipantDB,
	resetDatabaseForTests,
} from "../src/database.js";

import { BASE } from "./helpers/base.js";
import { today, tomorrow } from "./helpers/dates.js";

const CUTOFF_TOOLTIP = "Nelze se přihlásit jako náhrada po půlnoci před lekcí";

async function loginAsParticipant(page: import("@playwright/test").Page) {
	await page.goto(`${BASE}/login.html`);
	await page.fill("#login-email", "maminka@test.cz");
	await page.fill("#login-password", "test123");
	await page.click('button[type="submit"]');
	await page.waitForURL(`${BASE}/`, { timeout: 10000 });
	await page.waitForSelector("#calendar-grid", { timeout: 10000 });
}

// Takes a Prague-local YYYY-MM-DD string (from tests/helpers/dates) so calendar
// navigation matches the Prague-pinned browser timezone — no Node-local Date math.
async function openDayModalFor(
	page: import("@playwright/test").Page,
	dateStr: string,
) {
	const [year, month, day] = dateStr.split("-").map(Number);
	const [ty, tm] = today().split("-").map(Number);
	const monthsAhead =
		((year as number) - (ty as number)) * 12 +
		((month as number) - (tm as number));
	for (let i = 0; i < monthsAhead; i++) {
		await page.click('button[onclick="calendarNextMonth()"]');
	}
	await page
		.locator(".calendar-day")
		.filter({
			has: page.locator(".calendar-day-number", {
				hasText: new RegExp(`^${day}$`),
			}),
		})
		.click();
	await page.waitForSelector("#day-modal", { state: "visible" });
}

// The demo participant (maminka@test.cz, ageGroup "1 - 2 roky") is enrolled in
// her own course; the lesson lives in a second course with the same ageGroup
// and free capacity, which makes it a substitution candidate for her.
async function seedCandidateLesson(lessonDate: string) {
	const courseMine = createCourse({
		name: "Moje Skupinka",
		ageGroup: "1 - 2 roky",
		color: "#AABBCC",
	});
	const courseOther = createCourse({
		name: "Cizí Skupinka",
		ageGroup: "1 - 2 roky",
		color: "#CCBBAA",
	});
	await CourseDB.insert(courseMine);
	await CourseDB.insert(courseOther);
	await ParticipantDB.linkToCourse("demo_participant_seed", courseMine.id);

	await LessonDB.insert(
		{
			id: `lesson_nahrada_${lessonDate}`,
			title: "Nahrada Cutoff Lesson",
			date: lessonDate,
			dayOfWeek: "Monday",
			time: "10:00",
			location: "Studio",
			ageGroup: "1 - 2 roky",
			capacity: 10,
			enrolledCount: 0,
		},
		courseOther.id,
	);
}

async function seedActiveCredit() {
	const expires = new Date();
	expires.setFullYear(expires.getFullYear() + 1);
	await CreditDB.insert({
		id: "credit_nahrada_test",
		participantId: "demo_participant_seed",
		earnedFromRegistrationId: null,
		expiresAt: expires.toISOString(),
	});
}

function nahradaButton(page: import("@playwright/test").Page) {
	return page
		.locator("#day-modal-body button")
		.filter({ hasText: "Přihlásit jako náhrada" });
}

async function openMyReservationsTab(page: import("@playwright/test").Page) {
	await page.click('[data-tab="my-reservations"]');
	await page.waitForSelector("#substitution-candidates-list .lesson-card", {
		timeout: 5000,
	});
}

function candidatesListButton(page: import("@playwright/test").Page) {
	return page
		.locator("#substitution-candidates-list button")
		.filter({ hasText: "Přihlásit jako náhrada" });
}

test.describe("REQ: Náhrada button disabled after midnight cutoff (day modal)", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		process.env.PARTICIPANT_EMAIL_SEED = "maminka@test.cz";
		process.env.PARTICIPANT_PASSWORD_SEED = "test123";
		await initializeDatabase();
		await resetDatabaseForTests();
		await ensureDemoParticipant();
	});

	test("náhrada button is disabled with cutoff tooltip for a lesson today (past midnight cutoff)", async ({
		page,
	}) => {
		await seedCandidateLesson(today());
		await seedActiveCredit();

		await loginAsParticipant(page);
		await openDayModalFor(page, today());

		const button = nahradaButton(page);
		await expect(button).toBeDisabled();
		await expect(button).toHaveAttribute("title", CUTOFF_TOOLTIP);
	});

	test("náhrada button is enabled for a lesson tomorrow (before midnight cutoff, credit available)", async ({
		page,
	}) => {
		await seedCandidateLesson(tomorrow());
		await seedActiveCredit();

		await loginAsParticipant(page);
		await openDayModalFor(page, tomorrow());

		await expect(nahradaButton(page)).toBeEnabled();
	});

	test("cutoff tooltip takes priority over the zero-credit tooltip for a lesson today", async ({
		page,
	}) => {
		await seedCandidateLesson(today());

		await loginAsParticipant(page);
		await openDayModalFor(page, today());

		const button = nahradaButton(page);
		await expect(button).toBeDisabled();
		await expect(button).toHaveAttribute("title", CUTOFF_TOOLTIP);
	});
});

test.describe("REQ: Náhrada button disabled after midnight cutoff (candidates list)", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		process.env.PARTICIPANT_EMAIL_SEED = "maminka@test.cz";
		process.env.PARTICIPANT_PASSWORD_SEED = "test123";
		await initializeDatabase();
		await resetDatabaseForTests();
		await ensureDemoParticipant();
	});

	test("list náhrada button is disabled with cutoff tooltip for a lesson today", async ({
		page,
	}) => {
		await seedCandidateLesson(today());
		await seedActiveCredit();

		await loginAsParticipant(page);
		await openMyReservationsTab(page);

		const button = candidatesListButton(page);
		await expect(button).toBeDisabled();
		await expect(button).toHaveAttribute("title", CUTOFF_TOOLTIP);
	});

	test("list náhrada button is enabled for a lesson tomorrow", async ({
		page,
	}) => {
		await seedCandidateLesson(tomorrow());
		await seedActiveCredit();

		await loginAsParticipant(page);
		await openMyReservationsTab(page);

		await expect(candidatesListButton(page)).toBeEnabled();
	});
});
