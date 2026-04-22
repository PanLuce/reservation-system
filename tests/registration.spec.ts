import { expect, test } from "@playwright/test";
import { LessonCalendar } from "../src/calendar.js";
import type { Lesson } from "../src/lesson.js";
import type { Participant } from "../src/participant.js";
import { RegistrationManager } from "../src/registration.js";
import { toDateString } from "../src/types.js";

test.describe("Registration Management", () => {
	const tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	const futureDate = toDateString(tomorrow);

	test("should register a participant to a lesson", () => {
		// Arrange
		const calendar = new LessonCalendar();
		const lesson: Lesson = {
			id: "lesson_1",
			title: "Morning Class",
			date: futureDate,
			dayOfWeek: "Monday",
			time: "10:00",
			location: "CVČ Vietnamská",
			ageGroup: "6-9 měsíců (do lezení)",
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
			ageGroup: "6-9 měsíců (do lezení)",
		};

		// Act
		const registration = registrationManager.registerParticipant(
			"lesson_1",
			participant,
		);

		// Assert
		expect(registration).toBeDefined();
		expect(registration.lessonId).toBe("lesson_1");
		expect(registration.participantId).toBe("p1");
		expect(registration.status).toBe("confirmed");

		// Check lesson enrolledCount increased
		const updatedLesson = calendar.getLessonById("lesson_1");
		expect(updatedLesson?.enrolledCount).toBe(1);
	});

	test("should register multiple participants at once (bulk)", () => {
		// Arrange
		const calendar = new LessonCalendar();
		const lesson: Lesson = {
			id: "lesson_1",
			title: "Morning Class",
			date: futureDate,
			dayOfWeek: "Monday",
			time: "10:00",
			location: "CVČ Vietnamská",
			ageGroup: "6-9 měsíců (do lezení)",
			capacity: 10,
			enrolledCount: 0,
		};
		calendar.addLesson(lesson);

		const registrationManager = new RegistrationManager(calendar);
		const participants: Participant[] = [
			{
				id: "p1",
				name: "Jana Nováková",
				email: "jana@example.cz",
				phone: "+420 777 888 999",
				ageGroup: "6-9 měsíců (do lezení)",
			},
			{
				id: "p2",
				name: "Petr Svoboda",
				email: "petr@example.cz",
				phone: "+420 666 555 444",
				ageGroup: "6-9 měsíců (do lezení)",
			},
			{
				id: "p3",
				name: "Marie Dvořáková",
				email: "marie@example.cz",
				phone: "+420 555 444 333",
				ageGroup: "6-9 měsíců (do lezení)",
			},
		];

		// Act
		const registrations = registrationManager.bulkRegisterParticipants(
			"lesson_1",
			participants,
		);

		// Assert
		expect(registrations).toHaveLength(3);
		for (const registration of registrations) {
			expect(registration.status).toBe("confirmed");
		}

		// Check lesson enrolledCount increased
		const updatedLesson = calendar.getLessonById("lesson_1");
		expect(updatedLesson?.enrolledCount).toBe(3);
	});

	test("should put participant on waitlist when lesson is full", () => {
		// Arrange
		const calendar = new LessonCalendar();
		const lesson: Lesson = {
			id: "lesson_1",
			title: "Morning Class",
			date: futureDate,
			dayOfWeek: "Monday",
			time: "10:00",
			location: "CVČ Vietnamská",
			ageGroup: "6-9 měsíců (do lezení)",
			capacity: 2, // Only 2 spots
			enrolledCount: 2, // Already full
		};
		calendar.addLesson(lesson);

		const registrationManager = new RegistrationManager(calendar);
		const participant: Participant = {
			id: "p1",
			name: "Jana Nováková",
			email: "jana@example.cz",
			phone: "+420 777 888 999",
			ageGroup: "6-9 měsíců (do lezení)",
		};

		// Act
		const registration = registrationManager.registerParticipant(
			"lesson_1",
			participant,
		);

		// Assert
		expect(registration.status).toBe("waitlist");

		// enrolledCount should not increase
		const updatedLesson = calendar.getLessonById("lesson_1");
		expect(updatedLesson?.enrolledCount).toBe(2);
	});

	test("should cancel a registration", () => {
		// Arrange
		const calendar = new LessonCalendar();
		const lesson: Lesson = {
			id: "lesson_1",
			title: "Morning Class",
			date: futureDate,
			dayOfWeek: "Monday",
			time: "10:00",
			location: "CVČ Vietnamská",
			ageGroup: "6-9 měsíců (do lezení)",
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
			ageGroup: "6-9 měsíců (do lezení)",
		};

		const registration = registrationManager.registerParticipant(
			"lesson_1",
			participant,
		);

		// Act
		const result = registrationManager.cancelRegistration(registration.id);

		// Assert
		expect(result.success).toBe(true);
		const registrations =
			registrationManager.getRegistrationsForLesson("lesson_1");
		const cancelledReg = registrations.find((r) => r.id === registration.id);
		expect(cancelledReg?.status).toBe("cancelled");

		// enrolledCount should decrease
		const updatedLesson = calendar.getLessonById("lesson_1");
		expect(updatedLesson?.enrolledCount).toBe(0);
	});
});
