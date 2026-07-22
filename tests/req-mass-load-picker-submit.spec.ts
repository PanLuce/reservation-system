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
}

test.describe
	.serial("Bulk-assign modal — submit", () => {
		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();
		});

		test("assigning a checked subset registers only that combination", async ({
			page,
		}) => {
			const course = createCourse({
				name: "Picker Submit Skupinka",
				ageGroup: "1 - 2 roky",
				color: "#778899",
			});
			await CourseDB.insert(course);

			const p1 = createParticipant({
				name: "Milan",
				email: "milan@t.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			const p2 = createParticipant({
				name: "Nikola",
				email: "nikola@t.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(p1);
			await ParticipantDB.insert(p2);
			await ParticipantDB.linkToCourse(p1.id, course.id);
			await ParticipantDB.linkToCourse(p2.id, course.id);

			await LessonDB.insert(
				{
					id: "submit_lesson_1",
					title: "Lekce první",
					date: "2027-12-01",
					dayOfWeek: "Wednesday",
					time: "10:00",
					location: "Studio",
					ageGroup: "1 - 2 roky",
					capacity: 10,
					enrolledCount: 0,
				},
				course.id,
			);
			await LessonDB.insert(
				{
					id: "submit_lesson_2",
					title: "Lekce druhá",
					date: "2027-12-08",
					dayOfWeek: "Wednesday",
					time: "10:00",
					location: "Studio",
					ageGroup: "1 - 2 roky",
					capacity: 10,
					enrolledCount: 0,
				},
				course.id,
			);

			await loginAsAdmin(page);
			await page.click('[data-tab="courses"]');
			await page
				.locator(`#course-card-${course.id}`)
				.getByRole("button", { name: "Hromadně přiřadit" })
				.click();

			const modal = page.locator("#bulk-assign-modal");
			await expect(modal).toBeVisible();

			// Only p1 + lesson 1 checked.
			await modal
				.locator(`input.bulk-assign-participant[value="${p1.id}"]`)
				.check();
			await modal
				.locator('input.bulk-assign-lesson[value="submit_lesson_1"]')
				.check();

			await page.click("#bulk-assign-submit");

			await expect(page.locator("#info-modal")).toBeVisible();
			await expect(page.locator("#info-modal-body")).toContainText("1");

			const shouldExist = await RegistrationDB.getByParticipantAndLesson(
				p1.id,
				"submit_lesson_1",
			);
			expect(shouldExist).toBeDefined();

			const shouldNotExist: [string, string][] = [
				[p1.id, "submit_lesson_2"],
				[p2.id, "submit_lesson_1"],
				[p2.id, "submit_lesson_2"],
			];
			for (const [participantId, lessonId] of shouldNotExist) {
				const reg = await RegistrationDB.getByParticipantAndLesson(
					participantId,
					lessonId,
				);
				expect(reg).toBeUndefined();
			}
		});

		test("submit stays disabled until both a child and a lesson are checked", async ({
			page,
		}) => {
			const course = createCourse({
				name: "Guard Skupinka",
				ageGroup: "1 - 2 roky",
				color: "#889900",
			});
			await CourseDB.insert(course);

			const p = createParticipant({
				name: "Oskar",
				email: "oskar@t.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(p);
			await ParticipantDB.linkToCourse(p.id, course.id);

			await LessonDB.insert(
				{
					id: "guard_lesson_1",
					title: "Guard Lekce",
					date: "2027-12-15",
					dayOfWeek: "Wednesday",
					time: "10:00",
					location: "Studio",
					ageGroup: "1 - 2 roky",
					capacity: 10,
					enrolledCount: 0,
				},
				course.id,
			);

			await loginAsAdmin(page);
			await page.click('[data-tab="courses"]');
			await page
				.locator(`#course-card-${course.id}`)
				.getByRole("button", { name: "Hromadně přiřadit" })
				.click();

			const modal = page.locator("#bulk-assign-modal");
			await expect(modal).toBeVisible();

			const submitBtn = page.locator("#bulk-assign-submit");
			await expect(submitBtn).toBeDisabled();

			await modal
				.locator(`input.bulk-assign-participant[value="${p.id}"]`)
				.check();
			await expect(submitBtn).toBeDisabled();

			await modal
				.locator('input.bulk-assign-lesson[value="guard_lesson_1"]')
				.check();
			await expect(submitBtn).toBeEnabled();
		});
	});
