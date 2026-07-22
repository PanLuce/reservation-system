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

test.describe
	.serial("Whole-course sync button", () => {
		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();
		});

		test("clicking the sync button enrolls an out-of-sync roster onto future lessons", async ({
			page,
		}) => {
			const course = createCourse({
				name: "Sync Button Skupinka",
				ageGroup: "1 - 2 roky",
				color: "#665544",
			});
			await CourseDB.insert(course);

			const participant = createParticipant({
				name: "Ivana",
				email: "ivana@t.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(participant);
			// Linking directly, bypassing the admin-add route, so no auto-sync has
			// happened yet — the roster is deliberately out of sync.
			await ParticipantDB.linkToCourse(participant.id, course.id);

			await LessonDB.insert(
				{
					id: "sync_button_lesson_1",
					title: "Lekce k synchronizaci",
					date: "2027-11-01",
					dayOfWeek: "Monday",
					time: "10:00",
					location: "Studio",
					ageGroup: "1 - 2 roky",
					capacity: 10,
					enrolledCount: 0,
				},
				course.id,
			);

			// Sanity: no registration exists yet.
			const before = await RegistrationDB.getByParticipantAndLesson(
				participant.id,
				"sync_button_lesson_1",
			);
			expect(before).toBeUndefined();

			await page.goto(`${BASE}/login.html`);
			await page.fill("#login-email", "admin@centrumrubacek.cz");
			await page.fill("#login-password", "admin123");
			await page.click('button[type="submit"]');
			await page.waitForURL(`${BASE}/`, { timeout: 10000 });

			await page.click('[data-tab="courses"]');
			await page
				.locator(`#course-card-${course.id}`)
				.getByRole("button", { name: "Přihlásit skupinku" })
				.click();

			await expect(page.locator(".notification")).toContainText("Přihlášeno");

			const after = await RegistrationDB.getByParticipantAndLesson(
				participant.id,
				"sync_button_lesson_1",
			);
			expect(after).toBeDefined();
			expect(after?.status).toBe("confirmed");
		});
	});
