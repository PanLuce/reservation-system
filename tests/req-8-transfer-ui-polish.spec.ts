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

// ─── REQ-8: Transfer dropdown UI polish ──────────────────────────────────────

test.describe("REQ-8: Maminky transfer dropdown shows current skupinka", () => {
	test.beforeEach(async () => {
		await setupParticipantWithLessons();
	});

	test("dropdown's selected option is the participant's current skupinka", async ({
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

		const selectedLabel = await transferSelect.evaluate((el) => {
			const sel = el as HTMLSelectElement;
			return sel.options[sel.selectedIndex]?.textContent ?? "";
		});
		expect(selectedLabel).toContain("Skupinka Alfa");
	});

	test("remaining-lesson count is rendered outside the dropdown element", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		await page.click('[data-tab="participants"]');
		await page.waitForSelector("#participants-list", { state: "visible" });
		await page.waitForTimeout(500);

		const participantRow = page
			.locator("#participants-list tr")
			.filter({ hasText: "Anička Testová" });

		// The "zbývá X lekcí" text must NOT live inside any <select>
		const insideSelect = await participantRow
			.locator("select.transfer-select")
			.evaluate((el) => el.textContent ?? "");
		expect(insideSelect).not.toContain("zbývá");

		// But it must still be visible somewhere in the row
		await expect(participantRow).toContainText("zbývá");
	});

	test("dropdown is styled to match the page (uses CSS class, not just inline font-size:11px)", async ({
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

		const styles = await transferSelect.evaluate((el) => {
			const s = window.getComputedStyle(el);
			return {
				fontFamily: s.fontFamily,
				borderRadius: s.borderRadius,
				borderWidth: s.borderWidth,
				padding: s.padding,
			};
		});
		// Page font is Raleway-based; the tiny 11px inline-styled dropdown
		// inherits browser default. Real on-brand styling rounds the corners.
		expect(styles.fontFamily.toLowerCase()).toMatch(/raleway|helvetica|arial/);
		expect(parseFloat(styles.borderRadius)).toBeGreaterThan(0);
	});
});

// ─── REQ-9: Confirmation dialog before any transfer ──────────────────────────

test.describe("REQ-9: Transfer requires confirmation dialog", () => {
	test.beforeEach(async () => {
		await setupParticipantWithLessons();
	});

	test("selecting a different skupinka opens a confirmation dialog (not the transfer itself)", async ({
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

		// Confirmation modal must appear with Yes/No buttons in the page modal
		await page.waitForSelector("#info-modal", { state: "visible" });
		const modal = page.locator("#info-modal");
		await expect(modal).toContainText("Skupinka Alfa");
		await expect(modal).toContainText("Skupinka Beta");
		await expect(
			modal.locator("button").filter({ hasText: /přesunout|potvrdit|ano/i }),
		).toBeVisible();
		await expect(
			modal.locator("button").filter({ hasText: /zrušit|ne/i }),
		).toBeVisible();
	});

	test("cancelling the confirmation dialog leaves the dropdown reset to the original skupinka", async ({
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

		await page.waitForSelector("#info-modal", { state: "visible" });
		await page
			.locator("#info-modal button")
			.filter({ hasText: /zrušit|ne/i })
			.click();
		await page.waitForSelector("#info-modal", { state: "hidden" });

		// API check: Anička is still in Alfa, not in Beta
		const resp = await page.request.get(
			`${BASE}/api/courses/${courseBeta.id}/participants`,
		);
		const members = await resp.json();
		const found = members.find(
			(m: { email: string }) => m.email === "anicka@test.cz",
		);
		expect(found).toBeUndefined();

		// Dropdown should now be back to Skupinka Alfa
		const selectedLabel = await transferSelect.evaluate((el) => {
			const sel = el as HTMLSelectElement;
			return sel.options[sel.selectedIndex]?.textContent ?? "";
		});
		expect(selectedLabel).toContain("Skupinka Alfa");
	});

	test("confirming the dialog proceeds with the transfer flow (mismatch popup or silent)", async ({
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

		await page.waitForSelector("#info-modal", { state: "visible" });
		await page
			.locator("#info-modal button")
			.filter({ hasText: /přesunout|potvrdit|ano/i })
			.click();

		// After confirmation, the mismatch modal should appear (2 vs 8)
		await expect(page.locator("#info-modal")).toContainText("2", {
			timeout: 5000,
		});
		await expect(page.locator("#info-modal")).toContainText("8");
		await expect(
			page.locator("#info-modal button").filter({ hasText: /prvních/i }),
		).toBeVisible();
	});
});
