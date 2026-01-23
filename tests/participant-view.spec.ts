import { expect, test } from "@playwright/test";
import { RegistrationManagerDB } from "../src/registration-db.js";
import { LessonCalendarDB } from "../src/calendar-db.js";
import { createParticipant } from "../src/participant.js";
import { createLesson } from "../src/lesson.js";
import {
	initializeDatabase,
	ParticipantDB,
	RegistrationDB,
} from "../src/database.js";

test.describe("Participant View - Get Own Registrations", () => {
	test.beforeEach(() => {
		initializeDatabase();
	});

	test("should get all registrations for a specific participant", () => {
		// Arrange
		const calendar = new LessonCalendarDB();
		const registrationManager = new RegistrationManagerDB();

		const lesson1 = createLesson({
			title: "Morning Yoga",
			date: "2024-02-15",
			dayOfWeek: "Thursday",
			time: "09:00",
			location: "Studio A",
			ageGroup: "3-4 years",
			capacity: 10,
		});

		const lesson2 = createLesson({
			title: "Evening Yoga",
			date: "2024-02-16",
			dayOfWeek: "Friday",
			time: "17:00",
			location: "Studio B",
			ageGroup: "3-4 years",
			capacity: 10,
		});

		calendar.addLesson(lesson1);
		calendar.addLesson(lesson2);

		const participant = createParticipant({
			name: "John Doe",
			email: "john@example.com",
			phone: "123456789",
			ageGroup: "3-4 years",
		});

		// Register participant to first lesson (this will insert the participant)
		registrationManager.registerParticipant(lesson1.id, participant);

		// For second lesson, add registration directly since participant exists
		RegistrationDB.insert({
			id: `reg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			lessonId: lesson2.id,
			participantId: participant.id,
			status: "confirmed",
		});

		// Act
		const registrations = ParticipantDB.getRegistrationsByParticipantId(
			participant.id,
		);

		// Assert
		expect(registrations).toHaveLength(2);
		const lessonIds = registrations.map(
			(r: { lessonId: string }) => r.lessonId,
		);
		expect(lessonIds).toContain(lesson1.id);
		expect(lessonIds).toContain(lesson2.id);
	});

	test("should return empty array when participant has no registrations", () => {
		// Arrange
		const participant = createParticipant({
			name: "Jane Doe",
			email: "jane@example.com",
			phone: "987654321",
			ageGroup: "2-3 years",
		});

		// Act
		const registrations = ParticipantDB.getRegistrationsByParticipantId(
			participant.id,
		);

		// Assert
		expect(registrations).toHaveLength(0);
	});

	test("should include lesson details with participant registrations", () => {
		// Arrange
		const calendar = new LessonCalendarDB();
		const registrationManager = new RegistrationManagerDB();

		const lesson = createLesson({
			title: "Test Lesson",
			date: "2024-02-20",
			dayOfWeek: "Tuesday",
			time: "10:00",
			location: "Main Hall",
			ageGroup: "1-2 years",
			capacity: 5,
		});

		calendar.addLesson(lesson);

		const participant = createParticipant({
			name: "Test User",
			email: "test@example.com",
			phone: "111222333",
			ageGroup: "1-2 years",
		});

		registrationManager.registerParticipant(lesson.id, participant);

		// Act
		const registrations = ParticipantDB.getRegistrationsWithLessonDetails(
			participant.id,
		);

		// Assert
		expect(registrations).toHaveLength(1);
		const reg = registrations[0] as Record<string, unknown>;
		expect(reg).toHaveProperty("lessonTitle", "Test Lesson");
		expect(reg).toHaveProperty("lessonDate", "2024-02-20");
		expect(reg).toHaveProperty("lessonTime", "10:00");
		expect(reg).toHaveProperty("lessonLocation", "Main Hall");
		expect(reg).toHaveProperty("status");
	});
});
