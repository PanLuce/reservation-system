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

// ─── Test data helpers ────────────────────────────────────────────────────────

const _TEST_LESSON_DATE = "2027-07-05"; // Monday

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

	// Create 8 future lessons in Alpha, register participant on first 2
	const alphaLessons: Array<ReturnType<typeof createLesson>> = [];
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
		alphaLessons.push(lesson);
		if (i < 2) {
			await rm.registerParticipant(lesson.id, participant);
		}
	}

	// Create 8 future lessons in Beta (no registrations yet)
	const betaLessons: Array<ReturnType<typeof createLesson>> = [];
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
		betaLessons.push(lesson);
	}

	return { alphaLessons, betaLessons };
}

// ─── REQ-1: User-role badge contrast ─────────────────────────────────────────

test.describe("REQ-1: User-role badge has sufficient contrast", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("admin badge text color is dark enough to read on its background", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		const { color, background } = await page
			.locator("#user-role")
			.evaluate((el) => {
				const s = window.getComputedStyle(el);
				return { color: s.color, background: s.backgroundColor };
			});

		// Color must NOT be nearly the same as background (poor contrast)
		// Simplest check: text color must not be a very light grey/white
		// rgb(255,255,255) or similar high-lightness colors fail
		// We require dark text (r+g+b < 400) or white text on dark bg
		const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
		const bgMatch = background.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

		expect(rgbMatch).not.toBeNull();
		expect(bgMatch).not.toBeNull();

		const channels = rgbMatch!.slice(1).map(Number) as [number, number, number];
		const bgChannels = bgMatch!.slice(1).map(Number) as [
			number,
			number,
			number,
		];

		// Contrast difference: sum of channel differences must be > 200
		const diff =
			Math.abs(channels[0] - bgChannels[0]) +
			Math.abs(channels[1] - bgChannels[1]) +
			Math.abs(channels[2] - bgChannels[2]);
		expect(diff).toBeGreaterThan(200);
	});

	test("participant badge text color is dark enough on its background", async ({
		page,
	}) => {
		await ensureDemoParticipant();
		await page.goto(`${BASE}/login.html`);
		await page.fill("#login-email", "maminka@test.cz");
		await page.fill("#login-password", "test123");
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE}/`, { timeout: 10000 });

		const { color, background } = await page
			.locator("#user-role")
			.evaluate((el) => {
				const s = window.getComputedStyle(el);
				return { color: s.color, background: s.backgroundColor };
			});

		const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
		const bgMatch = background.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

		expect(rgbMatch).not.toBeNull();
		expect(bgMatch).not.toBeNull();

		const channels = rgbMatch!.slice(1).map(Number) as [number, number, number];
		const bgChannels = bgMatch!.slice(1).map(Number) as [
			number,
			number,
			number,
		];

		const diff =
			Math.abs(channels[0] - bgChannels[0]) +
			Math.abs(channels[1] - bgChannels[1]) +
			Math.abs(channels[2] - bgChannels[2]);
		expect(diff).toBeGreaterThan(200);
	});
});

// ─── REQ-2: Show participants in day-modal lesson rows ────────────────────────

test.describe("REQ-2: Day-modal shows enrolled participants per lesson", () => {
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
				await page.click('button[onclick="calendarNextMonth()"]');
			} else {
				await page.click('button[onclick="calendarPrevMonth()"]');
			}
			await page.waitForTimeout(100);
		}
	}

	test.beforeEach(async () => {
		await setupParticipantWithLessons();
	});

	async function openDayAndExpandMembers(
		page: import("@playwright/test").Page,
		year: number,
		month: number,
	) {
		await navigateToMonth(page, year, month);

		// Click day 5 of the month
		await page
			.locator(".calendar-day")
			.filter({ hasText: "5" })
			.first()
			.click();

		await page.waitForSelector("#day-modal", { state: "visible" });

		// Expand members on the first lesson row (Alfa has Anička registered)
		const toggleSpan = page
			.locator("#day-modal-body span")
			.filter({ hasText: /Načíst účastníky/ })
			.first();
		await expect(toggleSpan).toBeVisible({ timeout: 3000 });
		await toggleSpan.click();
		await page.waitForTimeout(500);
	}

	test("day-modal lesson row shows enrolled participant name and email", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await openDayAndExpandMembers(page, 2027, 7);

		const modalBody = page.locator("#day-modal-body");
		await expect(modalBody).toContainText("Anička Testová");
		await expect(modalBody).toContainText("anicka@test.cz");
	});

	test("day-modal participant row shows remaining-lesson count", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await openDayAndExpandMembers(page, 2027, 7);

		// Should see "zbývá X lekcí" for the participant
		await expect(page.locator("#day-modal-body")).toContainText("zbývá");
	});
});

// ─── REQ-3: Remaining-lesson count in Skupinky tab ───────────────────────────

test.describe("REQ-3: Remaining-lesson count in Skupinky member list", () => {
	test.beforeEach(async () => {
		await setupParticipantWithLessons();
	});

	test("skupinky member list shows 'zbývá X lekcí' for enrolled participant", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		// Go to Skupinky tab
		await page.click('[data-tab="courses"]');
		await page.waitForSelector("#courses-list", { state: "visible" });

		// Wait for course cards to load
		await page.waitForSelector(".lesson-card");

		// Click to expand members on Skupinka Alfa
		const alfaCard = page.locator(`#course-card-${courseAlpha.id}`);
		await alfaCard.locator('[onclick*="toggleMembersList"]').click();

		// Should show remaining count
		await expect(alfaCard).toContainText("zbývá");
		await expect(alfaCard).toContainText("Anička Testová");
	});
});

// ─── REQ-4: Maminky tab ───────────────────────────────────────────────────────

test.describe("REQ-4: Maminky admin tab", () => {
	test.beforeEach(async () => {
		await setupParticipantWithLessons();
	});

	test("Maminky tab is visible for admin", async ({ page }) => {
		await loginAsAdmin(page);
		await expect(page.locator('[data-tab="participants"]')).toBeVisible();
	});

	test("Maminky tab is hidden for participant", async ({ page }) => {
		await page.goto(`${BASE}/login.html`);
		await page.fill("#login-email", "maminka@test.cz");
		await page.fill("#login-password", "test123");
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE}/`, { timeout: 10000 });

		await expect(page.locator('[data-tab="participants"]')).not.toBeVisible();
	});

	test("Maminky tab shows all participants with name, email and skupinka", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		await page.click('[data-tab="participants"]');
		await page.waitForSelector("#participants-list", { state: "visible" });

		const list = page.locator("#participants-list");
		await expect(list).toContainText("Anička Testová");
		await expect(list).toContainText("anicka@test.cz");
		await expect(list).toContainText("Skupinka Alfa");
	});

	test("Maminky tab shows remaining-lesson count per participant", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		await page.click('[data-tab="participants"]');
		await page.waitForSelector("#participants-list", { state: "visible" });

		await expect(page.locator("#participants-list")).toContainText("zbývá");
	});
});

// ─── REQ-5 + REQ-6: Transfer between skupinky with mismatch popup ─────────────

test.describe("REQ-5/6: Transfer participant between skupinky", () => {
	test.beforeEach(async () => {
		await setupParticipantWithLessons();
	});

	test("Skupinky member row has a transfer dropdown listing other skupinky", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		await page.click('[data-tab="courses"]');
		await page.waitForSelector("#courses-list", { state: "visible" });
		await page.waitForSelector(".lesson-card");

		const alfaCard = page.locator(`#course-card-${courseAlpha.id}`);
		await alfaCard.locator('[onclick*="toggleMembersList"]').click();

		// Transfer dropdown should exist for the member
		const transferSelect = alfaCard.locator("select.transfer-select");
		await expect(transferSelect).toBeVisible();

		// Should list Beta as a target
		await expect(transferSelect).toContainText("Skupinka Beta");
	});

	test("transfer with count mismatch shows popup with three options", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		await page.click('[data-tab="courses"]');
		await page.waitForSelector(".lesson-card");

		const alfaCard = page.locator(`#course-card-${courseAlpha.id}`);
		await alfaCard.locator('[onclick*="toggleMembersList"]').click();

		// Select Beta in transfer dropdown → triggers phase-1 check
		const transferSelect = alfaCard.locator("select.transfer-select");
		await transferSelect.selectOption({ label: "Skupinka Beta" });

		// Mismatch popup must appear (2 remaining in Alfa, 8 future in Beta)
		await page.waitForSelector("#info-modal", { state: "visible" });

		const modal = page.locator("#info-modal");
		await expect(modal).toContainText("2");
		await expect(modal).toContainText("8");

		// Three action buttons: first N, all, cancel
		await expect(
			modal.locator("button").filter({ hasText: /prvních/i }),
		).toBeVisible();
		await expect(
			modal.locator("button").filter({ hasText: /všech/i }),
		).toBeVisible();
		await expect(
			modal.locator("button").filter({ hasText: /Zrušit/i }),
		).toBeVisible();
	});

	test("choosing 'prvních 2' registers participant on exactly 2 lessons in new skupinka", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		await page.click('[data-tab="courses"]');
		await page.waitForSelector(".lesson-card");

		const alfaCard = page.locator(`#course-card-${courseAlpha.id}`);
		await alfaCard.locator('[onclick*="toggleMembersList"]').click();

		const transferSelect = alfaCard.locator("select.transfer-select");
		await transferSelect.selectOption({ label: "Skupinka Beta" });

		await page.waitForSelector("#info-modal", { state: "visible" });

		// Click "prvních 2"
		await page
			.locator("#info-modal button")
			.filter({ hasText: /prvních/i })
			.click();

		await page.waitForSelector("#info-modal", { state: "hidden" });

		// Verify via API: participant now has 2 confirmed regs in Beta, 0 in Alfa
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

	test("transfer with matching counts is silent (no popup)", async ({
		page,
	}) => {
		// Build a 2-lesson Alpha, register participant on both, Beta also has 2 future lessons
		await resetDatabaseForTests();

		const c1 = createCourse({ name: "Match Alfa", ageGroup: "1 - 2 roky" });
		const c2 = createCourse({ name: "Match Beta", ageGroup: "1 - 2 roky" });
		await CourseDB.insert(c1);
		await CourseDB.insert(c2);

		const p = createParticipant({
			name: "Matched Maminka",
			email: "matched@test.cz",
			phone: "",
			ageGroup: "1 - 2 roky",
		});
		await ParticipantDB.insert(p);
		await ParticipantDB.linkToCourse(p.id, c1.id);

		const calendar = new LessonCalendarDB();
		const rm = new RegistrationManagerDB();

		const MATCH_DAYS = [
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday",
		] as const;
		for (let i = 0; i < 2; i++) {
			const dayDate = new Date(2027, 6, 5 + i);
			const l1 = createLesson({
				title: `Match Alfa Lekce ${i + 1}`,
				date: dayDate.toISOString().slice(0, 10),
				dayOfWeek: MATCH_DAYS[dayDate.getDay()]!,
				time: "10:00",
				ageGroup: "1 - 2 roky",
				capacity: 8,
				courseId: c1.id,
			});
			await calendar.addLesson(l1);
			await rm.registerParticipant(l1.id, p);

			const l2 = createLesson({
				title: `Match Beta Lekce ${i + 1}`,
				date: dayDate.toISOString().slice(0, 10),
				dayOfWeek: MATCH_DAYS[dayDate.getDay()]!,
				time: "11:00",
				ageGroup: "1 - 2 roky",
				capacity: 8,
				courseId: c2.id,
			});
			await calendar.addLesson(l2);
		}

		await loginAsAdmin(page);

		await page.click('[data-tab="courses"]');
		await page.waitForSelector(".lesson-card");

		const c1Card = page.locator(`#course-card-${c1.id}`);
		await c1Card.locator('[onclick*="toggleMembersList"]').click();

		const transferSelect = c1Card.locator("select.transfer-select");
		await transferSelect.selectOption({ label: "Match Beta" });

		// No popup should appear — silent transfer
		await page.waitForTimeout(500);
		const modalVisible = await page
			.locator("#info-modal")
			.evaluate(
				(el) =>
					(el as HTMLElement).style.display !== "none" &&
					(el as HTMLElement).style.display !== "",
			);
		expect(modalVisible).toBe(false);
	});
});
