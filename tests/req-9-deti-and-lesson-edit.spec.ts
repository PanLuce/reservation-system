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
let participantBeta: ReturnType<typeof createParticipant>;

async function setupData() {
	process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
	process.env.ADMIN_PASSWORD_SEED = "admin123";
	process.env.PARTICIPANT_EMAIL_SEED = "maminka@test.cz";
	process.env.PARTICIPANT_PASSWORD_SEED = "test123";
	await initializeDatabase();
	await resetDatabaseForTests();
	await ensureDemoParticipant();

	courseAlpha = createCourse({
		name: "Skupinka Alfa",
		ageGroup: "1 - 2 roky",
		location: "Vietnamská",
	});
	courseBeta = createCourse({
		name: "Skupinka Beta",
		ageGroup: "2 - 3 roky",
		location: "Nám. Míru",
	});
	await CourseDB.insert(courseAlpha);
	await CourseDB.insert(courseBeta);

	participant = createParticipant({
		name: "Anička Alfová",
		email: "anicka@test.cz",
		phone: "",
		ageGroup: "1 - 2 roky",
	});
	await ParticipantDB.insert(participant);
	await ParticipantDB.linkToCourse(participant.id, courseAlpha.id);

	participantBeta = createParticipant({
		name: "Betuška Betová",
		email: "betuska@test.cz",
		phone: "",
		ageGroup: "2 - 3 roky",
	});
	await ParticipantDB.insert(participantBeta);
	await ParticipantDB.linkToCourse(participantBeta.id, courseBeta.id);

	const calendar = new LessonCalendarDB();
	const rm = new RegistrationManagerDB();

	const alphaLesson = createLesson({
		title: "Lekce Alfa 1",
		date: "2027-07-05",
		dayOfWeek: "Monday",
		time: "10:00",
		ageGroup: "1 - 2 roky",
		capacity: 8,
		courseId: courseAlpha.id,
	});
	await calendar.addLesson(alphaLesson);
	await rm.registerParticipant(alphaLesson.id, participant);

	return { alphaLesson };
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
			await page.click('button[onclick="calendarNextMonth()"]');
		} else {
			await page.click('button[onclick="calendarPrevMonth()"]');
		}
		await page.waitForTimeout(100);
	}
}

// ─── REQ-2 + REQ-6: Rename + drop age column ─────────────────────────────────

test.describe("REQ-2: Maminky → Děti rename", () => {
	test.beforeEach(async () => {
		await setupData();
	});

	test("tab button shows Děti not Maminky", async ({ page }) => {
		await loginAsAdmin(page);
		const tabBtn = page.locator('[data-tab="participants"]');
		await expect(tabBtn).toContainText("Děti");
		await expect(tabBtn).not.toContainText("Maminky");
	});

	test("Děti tab heading does not contain Maminky", async ({ page }) => {
		await loginAsAdmin(page);
		await page.click('[data-tab="participants"]');
		await page.waitForSelector("#participants-list", { state: "visible" });
		await expect(page.locator("#participants")).toContainText("Děti");
		await expect(page.locator("#participants")).not.toContainText("Maminky");
	});

	test("detail modal title says Detail dítěte not Detail maminky", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await page.click('[data-tab="participants"]');
		await page.waitForSelector("#participants-list", { state: "visible" });
		await page.waitForTimeout(500);
		await page
			.locator("#participants-list td")
			.filter({ hasText: "Anička Alfová" })
			.first()
			.click();
		await page.waitForSelector("#participant-modal", { state: "visible" });
		await expect(page.locator("#participant-modal-title")).not.toContainText(
			"maminky",
		);
		await expect(page.locator("#participant-modal-title")).toContainText(
			"Anička Alfová",
		);
	});
});

test.describe("REQ-6: Drop Věk. skupina column from Děti table", () => {
	test.beforeEach(async () => {
		await setupData();
	});

	test("Děti table has no Věk. skupina column", async ({ page }) => {
		await loginAsAdmin(page);
		await page.click('[data-tab="participants"]');
		await page.waitForSelector("#participants-list table", {
			state: "visible",
		});
		const headers = await page
			.locator("#participants-list th")
			.allTextContents();
		expect(headers.some((h) => h.includes("Věk"))).toBe(false);
		expect(headers.some((h) => h.includes("Jméno"))).toBe(true);
		expect(headers.some((h) => h.includes("Skupinky"))).toBe(true);
	});
});

// ─── REQ-4: Skupinka label includes age + location ────────────────────────────

test.describe("REQ-4: Skupinka label includes age and location", () => {
	test.beforeEach(async () => {
		await setupData();
	});

	test("transfer dropdown option labels include location", async ({ page }) => {
		await loginAsAdmin(page);
		await page.click('[data-tab="participants"]');
		await page.waitForSelector("#participants-list", { state: "visible" });
		await page.waitForTimeout(500);

		const participantRow = page
			.locator("#participants-list tr")
			.filter({ hasText: "Anička Alfová" });
		const transferSelect = participantRow.locator("select.transfer-select");
		const optionTexts = await transferSelect.evaluate((el) =>
			Array.from((el as HTMLSelectElement).options).map((o) => o.textContent),
		);
		// Current option (Skupinka Alfa) should mention Vietnamská
		const current = optionTexts.find((t) => t?.includes("Skupinka Alfa"));
		expect(current).toMatch(/Vietnamská/);
		// Beta option should mention Nám. Míru
		const beta = optionTexts.find((t) => t?.includes("Skupinka Beta"));
		expect(beta).toMatch(/Nám\. Míru/);
	});
});

// ─── REQ-5: Sortable Děti table ──────────────────────────────────────────────

test.describe("REQ-5: Sortable Děti table", () => {
	test.beforeEach(async () => {
		// Insert two participants with names that are reversible alphabetically
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		process.env.PARTICIPANT_EMAIL_SEED = "maminka@test.cz";
		process.env.PARTICIPANT_PASSWORD_SEED = "test123";
		await initializeDatabase();
		await resetDatabaseForTests();
		await ensureDemoParticipant();

		const c = createCourse({
			name: "Skupinka Sort",
			ageGroup: "1 - 2 roky",
			location: "Telocvična",
		});
		await CourseDB.insert(c);

		const p1 = createParticipant({
			name: "Zuzana Žlutá",
			email: "zuzana@test.cz",
			phone: "",
			ageGroup: "1 - 2 roky",
		});
		const p2 = createParticipant({
			name: "Adam Azurový",
			email: "adam@test.cz",
			phone: "",
			ageGroup: "1 - 2 roky",
		});
		await ParticipantDB.insert(p1);
		await ParticipantDB.insert(p2);
		await ParticipantDB.linkToCourse(p1.id, c.id);
		await ParticipantDB.linkToCourse(p2.id, c.id);
	});

	test("clicking Jméno header sorts rows ascending then descending", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await page.click('[data-tab="participants"]');
		await page.waitForSelector("#participants-list table", {
			state: "visible",
		});
		await page.waitForTimeout(500);

		// Click Jméno header → ascending
		await page
			.locator("#participants-list th")
			.filter({ hasText: "Jméno" })
			.click();
		await page.waitForTimeout(200);

		const rows = page.locator("#participants-list tbody tr");
		const firstNameAsc = await rows.first().locator("td").first().textContent();
		const lastNameAsc = await rows.last().locator("td").first().textContent();
		expect(firstNameAsc?.localeCompare(lastNameAsc ?? "") ?? -1).toBeLessThan(
			0,
		);

		// Click again → descending
		await page
			.locator("#participants-list th")
			.filter({ hasText: "Jméno" })
			.click();
		await page.waitForTimeout(200);

		const firstNameDesc = await rows
			.first()
			.locator("td")
			.first()
			.textContent();
		expect(firstNameDesc).toBe(lastNameAsc);
	});

	test("clicking Email header sorts rows by email", async ({ page }) => {
		await loginAsAdmin(page);
		await page.click('[data-tab="participants"]');
		await page.waitForSelector("#participants-list table", {
			state: "visible",
		});
		await page.waitForTimeout(500);

		await page
			.locator("#participants-list th")
			.filter({ hasText: "Email" })
			.click();
		await page.waitForTimeout(200);

		const rows = page.locator("#participants-list tbody tr");
		const firstEmail = await rows.first().locator("td").nth(1).textContent();
		const lastEmail = await rows.last().locator("td").nth(1).textContent();
		expect(firstEmail?.localeCompare(lastEmail ?? "") ?? -1).toBeLessThan(0);
	});
});

// ─── REQ-1: Lesson editing ────────────────────────────────────────────────────

test.describe("REQ-1: Lesson editing in day-modal", () => {
	test.beforeEach(async () => {
		await setupData();
	});

	async function openDayModal(page: import("@playwright/test").Page) {
		await navigateToMonth(page, 2027, 7);
		await page
			.locator(".calendar-day")
			.filter({ hasText: "5" })
			.first()
			.click();
		await page.waitForSelector("#day-modal", { state: "visible" });
	}

	test("admin sees Upravit button next to Smazat in day-modal lesson row", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await openDayModal(page);
		await expect(
			page.locator("#day-modal-body button").filter({ hasText: "Upravit" }),
		).toBeVisible();
	});

	test("clicking Upravit opens edit modal pre-filled with lesson title", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await openDayModal(page);
		await page
			.locator("#day-modal-body button")
			.filter({ hasText: "Upravit" })
			.first()
			.click();
		await page.waitForSelector("#edit-lesson-modal", { state: "visible" });
		const titleInput = page.locator("#edit-lesson-title");
		await expect(titleInput).toHaveValue("Lekce Alfa 1");
	});

	test("saving edited lesson updates its title in the day-modal", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await openDayModal(page);
		await page
			.locator("#day-modal-body button")
			.filter({ hasText: "Upravit" })
			.first()
			.click();
		await page.waitForSelector("#edit-lesson-modal", { state: "visible" });

		await page.fill("#edit-lesson-title", "Upravená Lekce Alfa");
		await page.locator("#edit-lesson-form").locator('[type="submit"]').click();
		await page.waitForSelector("#edit-lesson-modal", { state: "hidden" });

		await expect(page.locator("#day-modal-body")).toContainText(
			"Upravená Lekce Alfa",
		);
	});
});

// ─── REQ-3: Cross-skupinka assignment ────────────────────────────────────────

test.describe("REQ-3: Cross-skupinka kid assignment to individual lesson", () => {
	test.beforeEach(async () => {
		await setupData();
	});

	async function openDayModal(page: import("@playwright/test").Page) {
		await navigateToMonth(page, 2027, 7);
		await page
			.locator(".calendar-day")
			.filter({ hasText: "5" })
			.first()
			.click();
		await page.waitForSelector("#day-modal", { state: "visible" });
	}

	test("admin sees '+ Přidat dítě' button in day-modal lesson row", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await openDayModal(page);
		await expect(
			page
				.locator("#day-modal-body button")
				.filter({ hasText: /Přidat dítě/i }),
		).toBeVisible();
	});

	test("picker shows all participants including from different skupinka", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await openDayModal(page);
		await page
			.locator("#day-modal-body button")
			.filter({ hasText: /Přidat dítě/i })
			.click();
		await page.waitForSelector("#info-modal", { state: "visible" });
		// Should show Beta participant even though this is an Alpha lesson
		await expect(page.locator("#info-modal")).toContainText("Betuška Betová");
	});

	test("selecting a participant from a different skupinka registers them on the lesson", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await openDayModal(page);
		await page
			.locator("#day-modal-body button")
			.filter({ hasText: /Přidat dítě/i })
			.click();
		await page.waitForSelector("#info-modal", { state: "visible" });

		// Click Přidat button inside Betuška's row (from Beta, different skupinka)
		await page
			.locator("#info-modal li")
			.filter({ hasText: "Betuška Betová" })
			.locator("button")
			.filter({ hasText: "Přidat" })
			.click();

		// Confirm prompt — now shows single "Potvrdit přidání" dialog
		await page.waitForSelector("#info-modal", { state: "visible" });
		await page
			.locator("#info-modal .btn-primary")
			.filter({ hasText: /přidat/i })
			.click();
		await page.waitForSelector("#info-modal", { state: "hidden" });

		// Betuška should now appear in the lesson members
		const alphaLesonRow = page
			.locator("#day-modal-body .day-lesson-row")
			.first();
		const toggleSpan = alphaLesonRow
			.locator("span")
			.filter({ hasText: /účastník|Načíst/i })
			.first();
		await toggleSpan.click();
		await page.waitForTimeout(500);
		await expect(alphaLesonRow).toContainText("Betuška Betová");
	});
});
