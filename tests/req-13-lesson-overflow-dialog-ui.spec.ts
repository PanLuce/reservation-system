import { expect, test } from "@playwright/test";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	LessonDB,
	ParticipantDB,
	RegistrationDB,
	resetDatabaseForTests,
} from "../src/database.js";
import { createParticipant } from "../src/participant.js";

import { BASE } from "./helpers/base.js";

async function loginAsAdmin(page: import("@playwright/test").Page) {
	await page.goto(`${BASE}/login.html`);
	await page.fill("#login-email", "admin@centrumrubacek.cz");
	await page.fill("#login-password", "admin123");
	await page.click('button[type="submit"]');
	await page.waitForURL(`${BASE}/`, { timeout: 10000 });
	await page.waitForSelector("#calendar-grid", { timeout: 10000 });
}

async function createCourseWithRoster(
	names: string[],
	ageGroup = "1 - 2 roky",
): Promise<{ courseId: string; participantIds: Record<string, string> }> {
	const course = createCourse({
		name: `Dialog Test ${Math.random().toString(36).slice(2)}`,
		ageGroup,
	});
	await CourseDB.insert(course);

	const participantIds: Record<string, string> = {};
	for (const name of names) {
		const p = createParticipant({
			name,
			email: `${name.toLowerCase()}-${course.id}@t.cz`,
			phone: "",
			ageGroup,
		});
		await ParticipantDB.insert(p);
		await ParticipantDB.linkToCourse(p.id, course.id);
		participantIds[name] = p.id;
	}

	return { courseId: course.id, participantIds };
}

async function fillAndSubmitLessonForm(
	page: import("@playwright/test").Page,
	courseId: string,
	capacity: number,
) {
	await page.click('button[data-action="show-add-lesson-form"]');
	await page.fill('#add-lesson-form input[name="title"]', "Test Lekce");
	await page.selectOption("#lesson-course", courseId);
	await page.selectOption(
		'#add-lesson-form select[name="dayOfWeek"]',
		"Monday",
	);
	await page.fill('#add-lesson-form input[name="time"]', "10:00");
	await page.fill('#add-lesson-form input[name="startDate"]', "2027-12-06");
	await page.fill('#add-lesson-form input[name="endDate"]', "2027-12-06");
	await page.fill('#add-lesson-form input[name="capacity"]', String(capacity));
	await page.click('#add-lesson-form button[type="submit"]');
}

test.describe
	.serial("REQ-13: Lesson overflow resolution dialog", () => {
		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();
		});

		test("roster bigger than capacity opens the resolve dialog with one checkbox per roster kid", async ({
			page,
		}) => {
			const { courseId } = await createCourseWithRoster([
				"Anna",
				"Bob",
				"Cyril",
			]);
			await loginAsAdmin(page);
			await fillAndSubmitLessonForm(page, courseId, 2);

			await expect(page.locator("#info-modal")).toBeVisible();
			await expect(page.locator("#info-modal-title")).toContainText(
				"Nedostatek místa",
			);
			const checkboxes = page.locator(
				'#info-modal input[name="overflow-participant"]',
			);
			await expect(checkboxes).toHaveCount(3);
			const checkedCount = await checkboxes.evaluateAll(
				(els) => els.filter((el) => (el as HTMLInputElement).checked).length,
			);
			expect(checkedCount).toBe(2);
		});

		test("submitting a custom selection confirms the checked kids and waitlists the rest", async ({
			page,
		}) => {
			const { courseId, participantIds } = await createCourseWithRoster([
				"Dana",
				"Emil",
				"Filip",
			]);
			await loginAsAdmin(page);
			await fillAndSubmitLessonForm(page, courseId, 2);
			await expect(page.locator("#info-modal")).toBeVisible();

			// Roster order (and therefore which kids are pre-checked by default)
			// is not guaranteed, so set the desired final state explicitly
			// instead of assuming which boxes start checked.
			await page
				.locator(
					`#info-modal input[name="overflow-participant"][value="${participantIds.Dana}"]`,
				)
				.setChecked(true);
			await page
				.locator(
					`#info-modal input[name="overflow-participant"][value="${participantIds.Filip}"]`,
				)
				.setChecked(true);
			await page
				.locator(
					`#info-modal input[name="overflow-participant"][value="${participantIds.Emil}"]`,
				)
				.setChecked(false);

			await page.click('#info-modal button[type="submit"]');
			await expect(page.locator("#notification")).toContainText("Přihlášeno");
			await expect(page.locator("#info-modal")).toBeHidden();

			const lessons = await LessonDB.getByCourse(courseId);
			expect(lessons.length).toBeGreaterThan(0);
			const firstLesson = lessons[0];
			if (!firstLesson) throw new Error("expected at least one created lesson");
			const regs = await RegistrationDB.getByLessonId(firstLesson.id as string);
			const byParticipant = new Map(regs.map((r) => [r.participantId, r]));
			expect(byParticipant.get(participantIds.Dana)?.status).toBe("confirmed");
			expect(byParticipant.get(participantIds.Filip)?.status).toBe("confirmed");
			expect(byParticipant.get(participantIds.Emil)?.status).toBe("waitlist");
		});

		test("roster fits capacity: no dialog, plain success notification as before", async ({
			page,
		}) => {
			const { courseId } = await createCourseWithRoster(["Gita"]);
			await loginAsAdmin(page);
			await fillAndSubmitLessonForm(page, courseId, 10);

			await expect(page.locator("#info-modal")).toBeHidden();
			await expect(page.locator("#notification")).toContainText("Vytvořeno");
			await expect(page.locator("#notification")).not.toContainText(
				"náhradník",
			);
		});
	});
