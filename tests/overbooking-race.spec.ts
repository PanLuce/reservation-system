import { expect, test } from "@playwright/test";
import { LessonCalendarDB } from "../src/calendar-db.js";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	LessonDB,
	resetDatabaseForTests,
} from "../src/database.js";
import { createParticipant } from "../src/participant.js";
import { RegistrationManagerDB } from "../src/registration-db.js";

test.describe("Overbooking race — concurrent registrations on the last seat", () => {
	test.beforeEach(async () => {
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("registerParticipant never lets enrolledCount exceed capacity under concurrency", async () => {
		const course = createCourse({
			name: "Race skupinka",
			ageGroup: "1 - 2 roky",
		});
		await CourseDB.insert(course);

		const calendar = new LessonCalendarDB();
		const [lesson] = await calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Poslední místo",
			time: "10:00",
			dayOfWeek: "Monday",
			capacity: 1,
			dates: ["2027-08-02"],
		});

		const registrationManager = new RegistrationManagerDB();

		const CONCURRENCY = 10;
		const participants = Array.from({ length: CONCURRENCY }, (_, i) =>
			createParticipant({
				name: `Závodnice ${i}`,
				email: `race-${i}@test.cz`,
				phone: "",
				ageGroup: "1 - 2 roky",
			}),
		);

		await Promise.all(
			participants.map((p) =>
				registrationManager.registerParticipant(lesson!.id, p),
			),
		);

		const finalLesson = (await LessonDB.getById(lesson!.id)) as Record<
			string,
			unknown
		>;
		const finalEnrolledCount = finalLesson.enrolledCount as number;

		expect(finalEnrolledCount).toBeLessThanOrEqual(1);

		const registrations = await registrationManager.getRegistrationsForLesson(
			lesson!.id,
		);
		const confirmedCount = registrations.filter(
			(r) => r.status === "confirmed",
		).length;
		const waitlistCount = registrations.filter(
			(r) => r.status === "waitlist",
		).length;

		expect(confirmedCount).toBe(1);
		expect(waitlistCount).toBe(CONCURRENCY - 1);
		expect(finalEnrolledCount).toBe(confirmedCount);
	});
});
