import { expect, test } from "@playwright/test";
import { RegistrationManagerDB } from "../src/registration-db.js";
import {
	LessonDB,
	ParticipantDB,
	RegistrationDB,
	db,
	initializeDatabase,
} from "../src/database.js";
import type { Participant } from "../src/participant.js";
import type { Lesson } from "../src/lesson.js";
import type { EmailServiceInterface } from "../src/email-factory.js";

// Helper to clean up test data
function cleanupTestData() {
	db.exec("DELETE FROM registrations");
	db.exec("DELETE FROM participants");
	db.exec("DELETE FROM lessons");
}

// Mock email service for testing
function createMockEmailService() {
	const calls: Array<{
		method: string;
		participant: Participant;
		lesson: Lesson;
		status: "confirmed" | "waitlist";
	}> = [];

	return {
		sendParticipantConfirmation: async (
			participant: Participant,
			lesson: Lesson,
			status: "confirmed" | "waitlist",
		) => {
			calls.push({ method: "sendParticipantConfirmation", participant, lesson, status });
		},
		sendAdminNotification: async (
			participant: Participant,
			lesson: Lesson,
			status: "confirmed" | "waitlist",
		) => {
			calls.push({ method: "sendAdminNotification", participant, lesson, status });
		},
		getCalls: () => calls,
		resetCalls: () => {
			calls.length = 0;
		},
	};
}

// Failing email service for testing error handling
function createFailingEmailService() {
	return {
		sendParticipantConfirmation: async () => {
			throw new Error("Email service failure");
		},
		sendAdminNotification: async () => {
			throw new Error("Email service failure");
		},
	};
}

test.describe.configure({ mode: "serial" });

test.describe("Registration with Email Integration", () => {
	test.beforeEach(() => {
		initializeDatabase();
		cleanupTestData();
	});

	test.afterEach(() => {
		cleanupTestData();
	});

	test("should send emails after successful confirmed registration", async () => {
		// Arrange
		const mockEmailService = createMockEmailService();
		const registrationManager = new RegistrationManagerDB(
			mockEmailService as EmailServiceInterface,
		);

		const lesson: Lesson = {
			id: "lesson_1",
			title: "Ranní cvičení",
			date: "2024-03-15",
			dayOfWeek: "Pondělí",
			time: "10:00",
			location: "CVČ Vietnamská",
			ageGroup: "3-12 months",
			capacity: 10,
			enrolledCount: 0,
		};
		LessonDB.insert(lesson);

		const participant: Participant = {
			id: "p1",
			name: "Jana Nováková",
			email: "jana@example.cz",
			phone: "+420 777 888 999",
			ageGroup: "3-12 months",
		};

		// Act
		const registration = registrationManager.registerParticipant(
			"lesson_1",
			participant,
		);

		// Wait a bit for async email sending
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Assert
		expect(registration.status).toBe("confirmed");

		const calls = mockEmailService.getCalls();
		expect(calls).toHaveLength(2);

		// Check participant confirmation call
		const participantCall = calls.find(
			(c) => c.method === "sendParticipantConfirmation",
		);
		expect(participantCall).toBeDefined();
		expect(participantCall?.participant.id).toBe("p1");
		expect(participantCall?.lesson.id).toBe("lesson_1");
		expect(participantCall?.status).toBe("confirmed");

		// Check admin notification call
		const adminCall = calls.find((c) => c.method === "sendAdminNotification");
		expect(adminCall).toBeDefined();
		expect(adminCall?.participant.id).toBe("p1");
		expect(adminCall?.lesson.id).toBe("lesson_1");
		expect(adminCall?.status).toBe("confirmed");
	});

	test("should send emails after waitlist registration", async () => {
		// Arrange
		const mockEmailService = createMockEmailService();
		const registrationManager = new RegistrationManagerDB(
			mockEmailService as EmailServiceInterface,
		);

		const lesson: Lesson = {
			id: "lesson_2",
			date: "2024-03-16",
			title: "Plný kurz",
			dayOfWeek: "Úterý",
			time: "14:00",
			location: "CVČ Vietnamská",
			ageGroup: "3-12 months",
			capacity: 5,
			enrolledCount: 5, // Full
		};
		LessonDB.insert(lesson);

		const participant: Participant = {
			id: "p2",
			name: "Petr Novák",
			email: "petr@example.cz",
			phone: "+420 888 999 111",
			ageGroup: "3-12 months",
		};

		// Act
		const registration = registrationManager.registerParticipant(
			"lesson_2",
			participant,
		);

		// Wait for async email sending
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Assert
		expect(registration.status).toBe("waitlist");

		const calls = mockEmailService.getCalls();
		expect(calls).toHaveLength(2);

		// Check both calls have waitlist status
		const participantCall = calls.find(
			(c) => c.method === "sendParticipantConfirmation",
		);
		expect(participantCall?.status).toBe("waitlist");

		const adminCall = calls.find((c) => c.method === "sendAdminNotification");
		expect(adminCall?.status).toBe("waitlist");
	});

	test("should complete registration even when email service fails", async () => {
		// Arrange
		const failingEmailService = createFailingEmailService();
		const registrationManager = new RegistrationManagerDB(
			failingEmailService as EmailServiceInterface,
		);

		const lesson: Lesson = {
			id: "lesson_3",
			date: "2024-03-17",
			title: "Test Lesson",
			dayOfWeek: "Wednesday",
			time: "10:00",
			location: "Test Location",
			ageGroup: "3-12 months",
			capacity: 10,
			enrolledCount: 0,
		};
		LessonDB.insert(lesson);

		const participant: Participant = {
			id: "p3",
			name: "Test User",
			email: "test@example.com",
			phone: "+420 123 456 789",
			ageGroup: "3-12 months",
		};

		// Act - should not throw
		const registration = registrationManager.registerParticipant(
			"lesson_3",
			participant,
		);

		// Wait for async email attempt
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Assert - registration should succeed despite email failure
		expect(registration).toBeDefined();
		expect(registration.status).toBe("confirmed");
		expect(registration.participantId).toBe("p3");

		// Verify registration was saved to database
		const savedRegistration = RegistrationDB.getById(registration.id);
		expect(savedRegistration).toBeDefined();
	});

	test("should not send emails when email service is not provided", () => {
		// Arrange - no email service
		const registrationManager = new RegistrationManagerDB();

		const lesson: Lesson = {
			id: "lesson_4",
			date: "2024-03-18",
			title: "No Email Lesson",
			dayOfWeek: "Thursday",
			time: "10:00",
			location: "Test Location",
			ageGroup: "3-12 months",
			capacity: 10,
			enrolledCount: 0,
		};
		LessonDB.insert(lesson);

		const participant: Participant = {
			id: "p4",
			name: "No Email User",
			email: "noemail@example.com",
			phone: "+420 123 456 789",
			ageGroup: "3-12 months",
		};

		// Act - should work fine without email service
		const registration = registrationManager.registerParticipant(
			"lesson_4",
			participant,
		);

		// Assert
		expect(registration).toBeDefined();
		expect(registration.status).toBe("confirmed");
	});

	test("should send emails for bulk registration", async () => {
		// Arrange
		const mockEmailService = createMockEmailService();
		const registrationManager = new RegistrationManagerDB(
			mockEmailService as EmailServiceInterface,
		);

		const lesson: Lesson = {
			id: "lesson_5",
			date: "2024-03-19",
			title: "Bulk Test",
			dayOfWeek: "Friday",
			time: "10:00",
			location: "Test Location",
			ageGroup: "3-12 months",
			capacity: 10,
			enrolledCount: 0,
		};
		LessonDB.insert(lesson);

		const participants: Participant[] = [
			{
				id: "p5",
				name: "User 1",
				email: "user1@example.com",
				phone: "+420 111 111 111",
				ageGroup: "3-12 months",
			},
			{
				id: "p6",
				name: "User 2",
				email: "user2@example.com",
				phone: "+420 222 222 222",
				ageGroup: "3-12 months",
			},
		];

		// Act
		const registrations = registrationManager.bulkRegisterParticipants(
			"lesson_5",
			participants,
		);

		// Wait for async email sending
		await new Promise((resolve) => setTimeout(resolve, 100));

		// Assert
		expect(registrations).toHaveLength(2);

		const calls = mockEmailService.getCalls();
		// 2 participants × 2 emails each (participant + admin) = 4 emails
		expect(calls).toHaveLength(4);
	});
});
