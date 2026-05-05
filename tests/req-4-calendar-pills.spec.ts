import { expect, test } from "@playwright/test";
import { LessonCalendarDB } from "../src/calendar-db.js";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	ensureDemoParticipant,
	initializeDatabase,
	resetDatabaseForTests,
} from "../src/database.js";
import { createLesson } from "../src/lesson.js";

const BASE = "http://localhost:3000";

async function loginAsAdmin(page: import("@playwright/test").Page) {
	await page.goto(`${BASE}/login.html`);
	await page.fill("#login-email", "admin@centrumrubacek.cz");
	await page.fill("#login-password", "admin123");
	await page.click('button[type="submit"]');
	await page.waitForURL(`${BASE}/`, { timeout: 10000 });
	await page.waitForSelector("#calendar-grid", { timeout: 10000 });
}

// Navigate calendar to a specific year-month
async function navigateToMonth(
	page: import("@playwright/test").Page,
	targetYear: number,
	targetMonth: number, // 1-indexed
) {
	const label = async () =>
		page.locator("#calendar-month-label").textContent();
	const CZECH_MONTHS = [
		"Leden", "Únor", "Březen", "Duben", "Květen", "Červen",
		"Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec",
	];
	const target = `${CZECH_MONTHS[targetMonth - 1]} ${targetYear}`;
	for (let i = 0; i < 24; i++) {
		const current = await label();
		if (current === target) return;
		const today = new Date();
		const currentMonth = today.getMonth() + 1 + i; // rough forward check
		if (
			today.getFullYear() < targetYear ||
			(today.getFullYear() === targetYear && today.getMonth() + 1 < targetMonth)
		) {
			await page.click('button[onclick="calendarNextMonth()"]');
		} else {
			await page.click('button[onclick="calendarPrevMonth()"]');
		}
		await page.waitForTimeout(100);
	}
}

test.describe("REQ-4: Calendar colored pills for admin view", () => {
	const YELLOW = "#ffe0b2";
	const GREEN = "#c8e6c9";
	// Use a fixed future date that won't collide with real data
	const TEST_DATE = "2027-06-07"; // Monday

	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		process.env.PARTICIPANT_EMAIL_SEED = "maminka@test.cz";
		process.env.PARTICIPANT_PASSWORD_SEED = "test123";
		await initializeDatabase();
		await resetDatabaseForTests();
		await ensureDemoParticipant();

		const course1 = createCourse({
			name: "Skupinka žlutá",
			ageGroup: "1 - 2 roky",
			color: YELLOW,
		});
		const course2 = createCourse({
			name: "Skupinka zelená",
			ageGroup: "3-6 měsíců",
			color: GREEN,
		});
		await CourseDB.insert(course1);
		await CourseDB.insert(course2);

		const calendar = new LessonCalendarDB();
		await calendar.addLesson(
			createLesson({
				title: "Lekce žlutá",
				date: TEST_DATE,
				dayOfWeek: "Monday",
				time: "10:00",
				ageGroup: "1 - 2 roky",
				capacity: 8,
				courseId: course1.id,
			}),
		);
		await calendar.addLesson(
			createLesson({
				title: "Lekce zelená",
				date: TEST_DATE,
				dayOfWeek: "Monday",
				time: "11:00",
				ageGroup: "3-6 měsíců",
				capacity: 8,
				courseId: course2.id,
			}),
		);
	});

	test("calendar pills are rendered for admin instead of bullet glyphs", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await navigateToMonth(page, 2027, 6);

		// Assert: pills exist, bullets do not
		const pills = page.locator(".calendar-pill");
		await expect(pills.first()).toBeVisible({ timeout: 5000 });
		await expect(pills).toHaveCount(2);

		// Assert: no plain bullet character rendered as icon
		const bulletIcons = page.locator(".calendar-icon");
		await expect(bulletIcons).toHaveCount(0);
	});

	test("pills carry the skupinka color in their style attribute", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await navigateToMonth(page, 2027, 6);

		await expect(page.locator(".calendar-pill").first()).toBeVisible({
			timeout: 5000,
		});

		const styles = await page.locator(".calendar-pill").evaluateAll((els) =>
			els.map((el) => (el as HTMLElement).style.background || (el as HTMLElement).style.backgroundColor),
		);

		expect(styles.some((s) => s.toLowerCase().includes(YELLOW.toLowerCase()) || s.includes("255, 224, 178"))).toBe(true);
		expect(styles.some((s) => s.toLowerCase().includes(GREEN.toLowerCase()) || s.includes("200, 230, 201"))).toBe(true);
	});

	test("pills have a tooltip title with course name and time", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await navigateToMonth(page, 2027, 6);

		await expect(page.locator(".calendar-pill").first()).toBeVisible({
			timeout: 5000,
		});

		const titles = await page.locator(".calendar-pill").evaluateAll((els) =>
			els.map((el) => el.getAttribute("title") ?? ""),
		);

		expect(titles.some((t) => t.includes("Skupinka žlutá"))).toBe(true);
		expect(titles.some((t) => t.includes("10:00"))).toBe(true);
	});

	test("participant view still uses emoji icons, not pills", async ({
		page,
	}) => {
		// Login as participant
		await page.goto(`${BASE}/login.html`);
		await page.fill("#login-email", "maminka@test.cz");
		await page.fill("#login-password", "test123");
		await page.click('button[type="submit"]');
		await page.waitForURL(`${BASE}/`, { timeout: 10000 });
		await page.waitForSelector("#calendar-grid", { timeout: 10000 });

		await navigateToMonth(page, 2027, 6);

		// Pills must NOT appear for participants
		const pills = page.locator(".calendar-pill");
		await expect(pills).toHaveCount(0);
	});

	test("admin calendar legend reads 'Lekce', not 'Skupinky v tento den'", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		const legend = page.locator(".calendar-legend.admin-only");
		await expect(legend).toBeVisible();
		await expect(legend).toContainText("Lekce");
		await expect(legend).not.toContainText("Skupinky v tento den");
	});
});
