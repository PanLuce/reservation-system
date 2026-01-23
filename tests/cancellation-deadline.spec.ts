import { expect, test } from "@playwright/test";
import { LessonCalendar } from "../src/calendar.js";
import type { Lesson } from "../src/lesson.js";
import type { Participant } from "../src/participant.js";
import { RegistrationManager } from "../src/registration.js";

test.describe("Cancellation Deadline Validation", () => {
	test("should allow cancellation before midnight of lesson day", () => {
		// Arrange
		const calendar = new LessonCalendar();

		// Lesson is tomorrow at 10:00
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(10, 0, 0, 0);

		const lesson: Lesson = {
			id: "lesson_1",
			title: "Morning Class",
			date: tomorrow.toISOString().split('T')[0], // YYYY-MM-DD format
			dayOfWeek: "Monday",
			time: "10:00",
			location: "CVČ Vietnamská",
			ageGroup: "3-12 months",
			capacity: 10,
			enrolledCount: 0,
		};
		calendar.addLesson(lesson);

		const registrationManager = new RegistrationManager(calendar);
		const participant: Participant = {
			id: "p1",
			name: "Jana Nováková",
			email: "jana@example.cz",
			phone: "+420 777 888 999",
			ageGroup: "3-12 months",
		};

		// Register participant
		const registration = registrationManager.registerParticipant(
			"lesson_1",
			participant,
		);

		// Act - Try to cancel (current time is before midnight)
		const result = registrationManager.cancelRegistration(
			registration.id,
			new Date(), // Current time (mocked for testing)
		);

		// Assert
		expect(result.success).toBe(true);
		const cancelledReg = registrationManager
			.getRegistrationsForLesson("lesson_1")
			.find((r) => r.id === registration.id);
		expect(cancelledReg?.status).toBe("cancelled");
	});

	test("should reject cancellation after midnight of lesson day", () => {
		// Arrange
		const calendar = new LessonCalendar();

		// Lesson is today at 10:00
		const today = new Date();
		today.setHours(10, 0, 0, 0);

		const lesson: Lesson = {
			id: "lesson_1",
			title: "Morning Class",
			date: today.toISOString().split('T')[0], // YYYY-MM-DD format (today)
			dayOfWeek: "Monday",
			time: "10:00",
			location: "CVČ Vietnamská",
			ageGroup: "3-12 months",
			capacity: 10,
			enrolledCount: 0,
		};
		calendar.addLesson(lesson);

		const registrationManager = new RegistrationManager(calendar);
		const participant: Participant = {
			id: "p1",
			name: "Jana Nováková",
			email: "jana@example.cz",
			phone: "+420 777 888 999",
			ageGroup: "3-12 months",
		};

		// Register participant
		const registration = registrationManager.registerParticipant(
			"lesson_1",
			participant,
		);

		// Act - Try to cancel at 2am on lesson day (after midnight deadline)
		const attemptTime = new Date(today);
		attemptTime.setHours(2, 0, 0, 0); // 2 AM on lesson day

		const result = registrationManager.cancelRegistration(
			registration.id,
			attemptTime,
		);

		// Assert
		expect(result.success).toBe(false);
		expect(result.error).toContain("midnight");

		// Registration should remain confirmed
		const stillActiveReg = registrationManager
			.getRegistrationsForLesson("lesson_1")
			.find((r) => r.id === registration.id);
		expect(stillActiveReg?.status).toBe("confirmed");
	});

	test("should allow cancellation at 11:59 PM the day before", () => {
		// Arrange
		const calendar = new LessonCalendar();

		// Lesson is tomorrow at 10:00
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		tomorrow.setHours(10, 0, 0, 0);

		const lesson: Lesson = {
			id: "lesson_1",
			title: "Morning Class",
			date: tomorrow.toISOString().split('T')[0],
			dayOfWeek: "Tuesday",
			time: "10:00",
			location: "CVČ Vietnamská",
			ageGroup: "3-12 months",
			capacity: 10,
			enrolledCount: 0,
		};
		calendar.addLesson(lesson);

		const registrationManager = new RegistrationManager(calendar);
		const participant: Participant = {
			id: "p1",
			name: "Jana Nováková",
			email: "jana@example.cz",
			phone: "+420 777 888 999",
			ageGroup: "3-12 months",
		};

		const registration = registrationManager.registerParticipant(
			"lesson_1",
			participant,
		);

		// Act - Cancel at 11:59 PM today (still before midnight of lesson day)
		const justBeforeMidnight = new Date();
		justBeforeMidnight.setHours(23, 59, 59, 999);

		const result = registrationManager.cancelRegistration(
			registration.id,
			justBeforeMidnight,
		);

		// Assert
		expect(result.success).toBe(true);
	});
});
