import { expect, test } from "@playwright/test";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	LessonDB,
	ParticipantDB,
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
	.serial("Bulk-assign modal — render", () => {
		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();
		});

		test("shows checkboxes for the course's kids and only its future lessons", async ({
			page,
		}) => {
			const course = createCourse({
				name: "Picker Render Skupinka",
				ageGroup: "1 - 2 roky",
				color: "#334455",
			});
			await CourseDB.insert(course);

			const p1 = createParticipant({
				name: "Jindra",
				email: "jindra@t.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			const p2 = createParticipant({
				name: "Karel",
				email: "karel@t.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(p1);
			await ParticipantDB.insert(p2);
			await ParticipantDB.linkToCourse(p1.id, course.id);
			await ParticipantDB.linkToCourse(p2.id, course.id);

			await LessonDB.insert(
				{
					id: "picker_future_lesson",
					title: "Budoucí lekce",
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
					id: "picker_past_lesson",
					title: "Minulá lekce",
					date: "2020-01-01",
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

			const participantLabelsLocator = modal.locator(
				"#bulk-assign-participants label",
			);
			await expect(participantLabelsLocator).toHaveCount(2);
			const names = (await participantLabelsLocator.allTextContents()).map(
				(t) => t.trim(),
			);
			expect(names.sort()).toEqual(["Jindra", "Karel"]);

			await expect(modal.locator("#bulk-assign-lessons")).toContainText(
				"Budoucí lekce",
			);
			await expect(modal.locator("#bulk-assign-lessons")).not.toContainText(
				"Minulá lekce",
			);
		});

		test("shows an explicit empty state when the course has no future lessons", async ({
			page,
		}) => {
			const course = createCourse({
				name: "No Future Lessons Skupinka",
				ageGroup: "1 - 2 roky",
				color: "#556677",
			});
			await CourseDB.insert(course);

			const p = createParticipant({
				name: "Lada",
				email: "lada@t.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(p);
			await ParticipantDB.linkToCourse(p.id, course.id);

			await loginAsAdmin(page);
			await page.click('[data-tab="courses"]');
			await page
				.locator(`#course-card-${course.id}`)
				.getByRole("button", { name: "Hromadně přiřadit" })
				.click();

			const modal = page.locator("#bulk-assign-modal");
			await expect(modal).toBeVisible();
			await expect(modal.locator("#bulk-assign-lessons")).toContainText(
				"Žádné budoucí lekce",
			);
			await expect(modal.locator("#bulk-assign-participants")).toContainText(
				"Lada",
			);
		});
	});
