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

const BASE = "http://localhost:3000";

async function loginAsAdmin(page: import("@playwright/test").Page) {
	await page.goto(`${BASE}/login.html`);
	await page.fill("#login-email", "admin@centrumrubacek.cz");
	await page.fill("#login-password", "admin123");
	await page.click('button[type="submit"]');
	await page.waitForURL(`${BASE}/`, { timeout: 10000 });
	await page.waitForSelector("#calendar-grid", { timeout: 10000 });
}

let courseAlpha: ReturnType<typeof createCourse>;
let courseBeta: ReturnType<typeof createCourse>;
let participant: ReturnType<typeof createParticipant>;

async function setupParticipantWithLessons() {
	process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
	process.env.ADMIN_PASSWORD_SEED = "admin123";
	process.env.PARTICIPANT_EMAIL_SEED = "maminka@test.cz";
	process.env.PARTICIPANT_PASSWORD_SEED = "test123";
	await initializeDatabase();
	await resetDatabaseForTests();
	await ensureDemoParticipant();

	courseAlpha = createCourse({ name: "Skupinka Alfa", ageGroup: "1 - 2 roky" });
	courseBeta = createCourse({ name: "Skupinka Beta", ageGroup: "1 - 2 roky" });
	await CourseDB.insert(courseAlpha);
	await CourseDB.insert(courseBeta);

	participant = createParticipant({
		name: "Anička Testová",
		email: "anicka@test.cz",
		phone: "",
		ageGroup: "1 - 2 roky",
	});
	await ParticipantDB.insert(participant);
	await ParticipantDB.linkToCourse(participant.id, courseAlpha.id);

	const calendar = new LessonCalendarDB();
	const rm = new RegistrationManagerDB();

	const DAYS = [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
	] as const;

	for (let i = 0; i < 8; i++) {
		const dayDate = new Date(2027, 6, 5 + i);
		const lesson = createLesson({
			title: `Lekce Alfa ${i + 1}`,
			date: dayDate.toISOString().slice(0, 10),
			dayOfWeek: DAYS[dayDate.getDay()]!,
			time: "10:00",
			ageGroup: "1 - 2 roky",
			capacity: 8,
			courseId: courseAlpha.id,
		});
		await calendar.addLesson(lesson);
		if (i < 2) {
			await rm.registerParticipant(lesson.id, participant);
		}
	}

	for (let i = 0; i < 8; i++) {
		const dayDate = new Date(2027, 6, 5 + i);
		const lesson = createLesson({
			title: `Lekce Beta ${i + 1}`,
			date: dayDate.toISOString().slice(0, 10),
			dayOfWeek: DAYS[dayDate.getDay()]!,
			time: "11:00",
			ageGroup: "1 - 2 roky",
			capacity: 8,
			courseId: courseBeta.id,
		});
		await calendar.addLesson(lesson);
	}
}

// ─── REQ-7: Transfer dropdown in Maminky tab ─────────────────────────────────

test.describe("REQ-7: Maminky tab has per-skupinka transfer dropdown", () => {
	test.beforeEach(async () => {
		await setupParticipantWithLessons();
	});

	test("participant row in Maminky tab has transfer dropdown listing other skupinky", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		await page.click('[data-tab="participants"]');
		await page.waitForSelector("#participants-list", { state: "visible" });
		await page.waitForTimeout(500);

		// The Skupinka Alfa entry for Anička should have a transfer-select
		const participantRow = page
			.locator("#participants-list tr")
			.filter({ hasText: "Anička Testová" });
		const transferSelect = participantRow.locator("select.transfer-select");
		await expect(transferSelect).toBeVisible();

		// Should offer Skupinka Beta as a target
		await expect(transferSelect).toContainText("Skupinka Beta");
	});

	test("selecting transfer target from Maminky tab triggers mismatch modal", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		await page.click('[data-tab="participants"]');
		await page.waitForSelector("#participants-list", { state: "visible" });
		await page.waitForTimeout(500);

		const participantRow = page
			.locator("#participants-list tr")
			.filter({ hasText: "Anička Testová" });
		const transferSelect = participantRow.locator("select.transfer-select");
		await transferSelect.selectOption({ value: courseBeta.id });

		// Confirmation modal first
		await page.waitForSelector("#info-modal", { state: "visible" });
		await page
			.locator("#info-modal button")
			.filter({ hasText: /přesunout|potvrdit|ano/i })
			.click();

		// Mismatch modal must appear (2 remaining in Alfa, 8 future in Beta)
		const modal = page.locator("#info-modal");
		await expect(modal).toContainText("2");
		await expect(modal).toContainText("8");
		await expect(
			modal.locator("button").filter({ hasText: /prvních/i }),
		).toBeVisible();
	});

	test("choosing 'prvních 2' from Maminky tab transfers participant to new skupinka", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		await page.click('[data-tab="participants"]');
		await page.waitForSelector("#participants-list", { state: "visible" });
		await page.waitForTimeout(500);

		const participantRow = page
			.locator("#participants-list tr")
			.filter({ hasText: "Anička Testová" });
		const transferSelect = participantRow.locator("select.transfer-select");
		await transferSelect.selectOption({ value: courseBeta.id });

		// Confirmation modal
		await page.waitForSelector("#info-modal", { state: "visible" });
		await page
			.locator("#info-modal button")
			.filter({ hasText: /přesunout|potvrdit|ano/i })
			.click();

		// Mismatch modal
		await page
			.locator("#info-modal button")
			.filter({ hasText: /prvních/i })
			.click();
		await page.waitForSelector("#info-modal", { state: "hidden" });

		// Verify via API: participant now has 2 confirmed regs in Beta
		const resp = await page.request.get(
			`${BASE}/api/courses/${courseBeta.id}/participants`,
		);
		expect(resp.ok()).toBeTruthy();
		const members = await resp.json();
		const found = members.find(
			(m: { email: string }) => m.email === "anicka@test.cz",
		);
		expect(found).toBeDefined();
		expect(found.remainingLessons).toBe(2);
	});

	test("clicking maminka row (not dropdown) opens detail modal without triggering transfer", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		await page.click('[data-tab="participants"]');
		await page.waitForSelector("#participants-list", { state: "visible" });
		await page.waitForTimeout(500);

		// Click the name cell directly, not the dropdown
		const nameCell = page
			.locator("#participants-list td")
			.filter({ hasText: "Anička Testová" })
			.first();
		await nameCell.click();

		await page.waitForSelector("#participant-modal", { state: "visible" });
		await expect(page.locator("#participant-modal-title")).toContainText(
			"Anička Testová",
		);

		// Info modal should NOT have appeared
		const infoModalVisible = await page
			.locator("#info-modal")
			.evaluate(
				(el) =>
					(el as HTMLElement).style.display !== "none" &&
					(el as HTMLElement).style.display !== "",
			);
		expect(infoModalVisible).toBe(false);
	});
});
