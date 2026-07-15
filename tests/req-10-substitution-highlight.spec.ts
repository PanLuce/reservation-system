import { expect, test } from "@playwright/test";
import { LessonCalendarDB } from "../src/calendar-db.js";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	ensureDemoParticipant,
	initializeDatabase,
	ParticipantDB,
	resetDatabaseForTests,
} from "../src/database.js";
import { createLesson } from "../src/lesson.js";
import { createParticipant } from "../src/participant.js";
import { RegistrationManagerDB } from "../src/registration-db.js";

import { BASE } from "./helpers/base.js";

async function loginAsParticipant(page: import("@playwright/test").Page) {
	await page.goto(`${BASE}/login.html`);
	await page.fill("#login-email", "maminka@test.cz");
	await page.fill("#login-password", "test123");
	await page.click('button[type="submit"]');
	await page.waitForURL(`${BASE}/`, { timeout: 10000 });
	await page.waitForSelector("#calendar-grid", { timeout: 10000 });
}

async function navigateToMonth(
	page: import("@playwright/test").Page,
	year: number,
	month: number,
) {
	const CZECH_MONTHS = [
		"Leden",
		"Únor",
		"Březen",
		"Duben",
		"Květen",
		"Červen",
		"Červenec",
		"Srpen",
		"Září",
		"Říjen",
		"Listopad",
		"Prosinec",
	];
	const target = `${CZECH_MONTHS[month - 1]} ${year}`;
	for (let i = 0; i < 36; i++) {
		const current = await page.locator("#calendar-month-label").textContent();
		if (current === target) return;
		const today = new Date();
		if (
			today.getFullYear() < year ||
			(today.getFullYear() === year && today.getMonth() + 1 < month)
		) {
			await page.click('button[data-action="calendar-next-month"]');
		} else {
			await page.click('button[data-action="calendar-prev-month"]');
		}
		// Wait for the label to change rather than guessing a fixed delay.
		await expect(page.locator("#calendar-month-label")).not.toHaveText(
			current ?? "",
		);
	}
}

async function setupSubData() {
	process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
	process.env.ADMIN_PASSWORD_SEED = "admin123";
	process.env.PARTICIPANT_EMAIL_SEED = "maminka@test.cz";
	process.env.PARTICIPANT_PASSWORD_SEED = "test123";
	await initializeDatabase();
	await resetDatabaseForTests();
	await ensureDemoParticipant();

	// Demo participant (maminka@test.cz) is in ageGroup "1 - 2 roky"
	// and owns courseMine. The sub target is courseOther with matching age.
	const courseMine = createCourse({
		name: "Moje Skupinka",
		ageGroup: "1 - 2 roky",
		location: "Vietnamská",
	});
	const courseOther = createCourse({
		name: "Cizí Skupinka",
		ageGroup: "1 - 2 roky",
		location: "Nám. Míru",
	});
	await CourseDB.insert(courseMine);
	await CourseDB.insert(courseOther);

	// Demo participant always has fixed ID "demo_participant_seed" (set by ensureDemoParticipant)
	const demoParticipant = {
		id: "demo_participant_seed",
		name: "Maminka Testovací",
		email: "maminka@test.cz",
		phone: "",
		ageGroup: "1 - 2 roky",
	};
	await ParticipantDB.linkToCourse(demoParticipant.id, courseMine.id);

	const calendar = new LessonCalendarDB();
	const rm = new RegistrationManagerDB();

	// Lesson on 2027-08-02 (Monday) in courseOther — has free capacity → should highlight
	const subLesson = createLesson({
		title: "Cizí Lekce Sub",
		date: "2027-08-02",
		dayOfWeek: "Monday",
		time: "10:00",
		ageGroup: "1 - 2 roky",
		capacity: 8,
		courseId: courseOther.id,
	});
	await calendar.addLesson(subLesson);

	// Lesson on 2027-08-09 (Monday) in courseOther — FULL → no highlight
	const anotherParticipant = createParticipant({
		name: "Extra Díte",
		email: "extra@test.cz",
		phone: "",
		ageGroup: "1 - 2 roky",
	});
	await ParticipantDB.insert(anotherParticipant);

	const fullLesson = createLesson({
		title: "Cizí Lekce Plno",
		date: "2027-08-09",
		dayOfWeek: "Monday",
		time: "10:00",
		ageGroup: "1 - 2 roky",
		capacity: 1,
		courseId: courseOther.id,
	});
	await calendar.addLesson(fullLesson);
	await rm.registerParticipant(fullLesson.id, anotherParticipant);

	// Lesson on 2027-08-16 in courseOther — free, but demo already registered on own lesson same day
	const myLesson = createLesson({
		title: "Moje Lekce",
		date: "2027-08-16",
		dayOfWeek: "Monday",
		time: "10:00",
		ageGroup: "1 - 2 roky",
		capacity: 8,
		courseId: courseMine.id,
	});
	await calendar.addLesson(myLesson);
	await rm.registerParticipant(myLesson.id, demoParticipant);

	const subOnMyDay = createLesson({
		title: "Cizí Na Môj Den",
		date: "2027-08-16",
		dayOfWeek: "Monday",
		time: "11:00",
		ageGroup: "1 - 2 roky",
		capacity: 8,
		courseId: courseOther.id,
	});
	await calendar.addLesson(subOnMyDay);

	return { subLesson, fullLesson, myLesson };
}

test.describe("REQ-2: Substitution tile highlight in participant calendar", () => {
	test.beforeEach(async () => {
		await setupSubData();
	});

	function dayTile(page: import("@playwright/test").Page, day: number) {
		return page
			.locator(".calendar-day")
			.filter({
				has: page
					.locator(".calendar-day-number")
					.getByText(String(day), { exact: true }),
			})
			.first();
	}

	test("tile with eligible substitution lesson has class has-substitution", async ({
		page,
	}) => {
		await loginAsParticipant(page);
		await navigateToMonth(page, 2027, 8);

		await expect(dayTile(page, 2)).toHaveClass(/has-substitution/);
	});

	test("tile with full lesson does NOT have class has-substitution", async ({
		page,
	}) => {
		await loginAsParticipant(page);
		await navigateToMonth(page, 2027, 8);

		await expect(dayTile(page, 9)).not.toHaveClass(/has-substitution/);
	});

	test("tile where participant already has own lesson is NOT has-substitution", async ({
		page,
	}) => {
		await loginAsParticipant(page);
		await navigateToMonth(page, 2027, 8);

		// Day 16: demo has ❤️ (myLesson) + there's also a sub-eligible lesson
		// has-substitution must NOT be applied — heart wins
		await expect(dayTile(page, 16)).not.toHaveClass(/has-substitution/);
	});

	test("legend wording is 'Možná náhrada' not 'Volná náhrada'", async ({
		page,
	}) => {
		await loginAsParticipant(page);
		await expect(
			page.locator(".calendar-legend.participant-only"),
		).toContainText("Možná náhrada");
		await expect(
			page.locator(".calendar-legend.participant-only"),
		).not.toContainText("Volná náhrada");
	});

	test("calendar-icon tooltip on substitution tile contains 'Možná náhrada'", async ({
		page,
	}) => {
		await loginAsParticipant(page);
		await navigateToMonth(page, 2027, 8);

		const icon = dayTile(page, 2).locator(".calendar-icon");
		const title = await icon.getAttribute("title");
		expect(title).toMatch(/Možná náhrada/);
	});
});
