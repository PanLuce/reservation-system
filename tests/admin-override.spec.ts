import { expect, test } from "@playwright/test";
import { RegistrationManagerDB } from "../src/registration-db.js";
import { LessonCalendarDB } from "../src/calendar-db.js";
import { createParticipant } from "../src/participant.js";
import { createCourse } from "../src/course.js";
import {
	initializeDatabase,
	CourseDB,
	ParticipantDB,
} from "../src/database.js";

test.describe("Admin Override - TDD", () => {
	test.beforeEach(() => {
		initializeDatabase();
	});

	test("should allow admin to register participant with different age group", () => {
		// Arrange
		const course = createCourse({
			name: "Baby Class",
			ageGroup: "3-12 months",
			color: "#FF5733",
		});
		CourseDB.insert(course);

		const calendar = new LessonCalendarDB();
		const lessons = calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Baby Yoga",
			location: "Studio A",
			time: "09:00",
			dayOfWeek: "Monday",
			capacity: 10,
			dates: ["2024-06-10"],
		});

		// Participant with DIFFERENT age group
		const participant = createParticipant({
			name: "Alice",
			email: "alice@example.com",
			phone: "111",
			ageGroup: "3-4 years", // Different from lesson's "3-12 months"
		});
		ParticipantDB.insert(participant);

		const registrationManager = new RegistrationManagerDB();

		// Act - admin forces registration despite age group mismatch
		const result = registrationManager.adminRegisterParticipant(
			lessons[0].id,
			participant.id,
		);

		// Assert
		expect(result.success).toBe(true);
		expect(result.registration).toBeDefined();
		expect(result.registration?.status).toBe("confirmed");
	});

	test("should allow admin to unregister any participant from any lesson", () => {
		// Arrange
		const course = createCourse({
			name: "Dance Class",
			ageGroup: "2-3 years",
			color: "#33FF57",
		});
		CourseDB.insert(course);

		const calendar = new LessonCalendarDB();
		const lessons = calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Dance",
			location: "Studio B",
			time: "15:00",
			dayOfWeek: "Wednesday",
			capacity: 10,
			dates: ["2024-06-12"],
		});

		const participant = createParticipant({
			name: "Bob",
			email: "bob@example.com",
			phone: "222",
			ageGroup: "2-3 years",
		});
		ParticipantDB.insert(participant);

		const registrationManager = new RegistrationManagerDB();
		const registration = registrationManager.registerParticipant(
			lessons[0].id,
			participant,
		);

		// Act - admin cancels any participant's registration
		const result = registrationManager.adminCancelRegistration(registration.id);

		// Assert
		expect(result.success).toBe(true);
		expect(result.message).toContain("cancelled");

		// Verify lesson enrolled count decreased
		const updatedLesson = calendar.getLessonById(lessons[0].id);
		expect(updatedLesson?.enrolledCount).toBe(0);
	});

	test("should allow admin to cancel registration past deadline", () => {
		// Arrange
		const course = createCourse({
			name: "Art Class",
			ageGroup: "3-4 years",
			color: "#5733FF",
		});
		CourseDB.insert(course);

		const calendar = new LessonCalendarDB();

		// Create lesson in the past (deadline has passed)
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const yesterdayStr = yesterday.toISOString().split('T')[0];

		const lessons = calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Art Workshop",
			location: "Art Room",
			time: "14:00",
			dayOfWeek: "Thursday",
			capacity: 10,
			dates: [yesterdayStr],
		});

		const participant = createParticipant({
			name: "Charlie",
			email: "charlie@example.com",
			phone: "333",
			ageGroup: "3-4 years",
		});
		ParticipantDB.insert(participant);

		const registrationManager = new RegistrationManagerDB();
		const registration = registrationManager.registerParticipant(
			lessons[0].id,
			participant,
		);

		// Act - admin cancels past deadline
		const result = registrationManager.adminCancelRegistration(registration.id);

		// Assert - should succeed (admin override)
		expect(result.success).toBe(true);
	});

	test("should allow admin to force register even when lesson is full", () => {
		// Arrange
		const course = createCourse({
			name: "Small Class",
			ageGroup: "1-2 years",
			color: "#FF3357",
		});
		CourseDB.insert(course);

		const calendar = new LessonCalendarDB();
		const lessons = calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Small Group",
			location: "Room 1",
			time: "10:00",
			dayOfWeek: "Friday",
			capacity: 2, // Very small capacity
			dates: ["2024-06-14"],
		});

		// Fill the lesson to capacity
		const participant1 = createParticipant({
			name: "David",
			email: "david@example.com",
			phone: "444",
			ageGroup: "1-2 years",
		});
		const participant2 = createParticipant({
			name: "Emma",
			email: "emma@example.com",
			phone: "555",
			ageGroup: "1-2 years",
		});
		const participant3 = createParticipant({
			name: "Frank",
			email: "frank@example.com",
			phone: "666",
			ageGroup: "1-2 years",
		});

		ParticipantDB.insert(participant1);
		ParticipantDB.insert(participant2);
		ParticipantDB.insert(participant3);

		const registrationManager = new RegistrationManagerDB();

		// Fill to capacity
		registrationManager.registerParticipant(lessons[0].id, participant1);
		registrationManager.registerParticipant(lessons[0].id, participant2);

		// Verify it's full
		const lessonBeforeForce = calendar.getLessonById(lessons[0].id);
		expect(lessonBeforeForce?.enrolledCount).toBe(2);
		expect(lessonBeforeForce?.capacity).toBe(2);

		// Act - admin forces registration even though full
		const result = registrationManager.adminRegisterParticipant(
			lessons[0].id,
			participant3.id,
			{ forceCapacity: true },
		);

		// Assert - should be confirmed, not waitlisted
		expect(result.success).toBe(true);
		expect(result.registration?.status).toBe("confirmed");

		// Verify enrolled count increased beyond capacity
		const lessonAfterForce = calendar.getLessonById(lessons[0].id);
		expect(lessonAfterForce?.enrolledCount).toBe(3); // Over capacity!
	});

	test("should allow admin to register participant to multiple lessons at once", () => {
		// Arrange
		const course = createCourse({
			name: "Fitness Course",
			ageGroup: "3-12 months",
			color: "#3357FF",
		});
		CourseDB.insert(course);

		const calendar = new LessonCalendarDB();
		const lessons = calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Baby Fitness",
			location: "Gym",
			time: "16:00",
			dayOfWeek: "Tuesday",
			capacity: 10,
			dates: ["2024-06-18", "2024-06-25", "2024-07-02"],
		});

		const participant = createParticipant({
			name: "Grace",
			email: "grace@example.com",
			phone: "777",
			ageGroup: "3-12 months",
		});
		ParticipantDB.insert(participant);

		const registrationManager = new RegistrationManagerDB();

		// Act - admin registers participant to all 3 lessons
		const result = registrationManager.adminBulkRegisterParticipant(
			participant.id,
			lessons.map((l) => l.id),
		);

		// Assert
		expect(result.success).toBe(true);
		expect(result.registrations).toHaveLength(3);
		expect(result.successful).toBe(3);
	});

	test("should provide admin with override reasons in response", () => {
		// Arrange
		const course = createCourse({
			name: "Test Class",
			ageGroup: "1-2 years",
			color: "#FF5733",
		});
		CourseDB.insert(course);

		const calendar = new LessonCalendarDB();
		const lessons = calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Test Lesson",
			location: "Room 1",
			time: "11:00",
			dayOfWeek: "Saturday",
			capacity: 10,
			dates: ["2024-06-15"],
		});

		const participant = createParticipant({
			name: "Henry",
			email: "henry@example.com",
			phone: "888",
			ageGroup: "3-4 years", // Wrong age group
		});
		ParticipantDB.insert(participant);

		const registrationManager = new RegistrationManagerDB();

		// Act
		const result = registrationManager.adminRegisterParticipant(
			lessons[0].id,
			participant.id,
		);

		// Assert
		expect(result.success).toBe(true);
		expect(result.adminOverride).toBeDefined();
		expect(result.adminOverride?.reason.toLowerCase()).toContain("age group");
	});
});
