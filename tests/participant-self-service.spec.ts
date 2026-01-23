import { expect, test } from "@playwright/test";
import { RegistrationManagerDB } from "../src/registration-db.js";
import { LessonCalendarDB } from "../src/calendar-db.js";
import { createParticipant } from "../src/participant.js";
import { createCourse } from "../src/course.js";
import {
	initializeDatabase,
	CourseDB,
	ParticipantDB,
	LessonDB,
} from "../src/database.js";

test.describe("Participant Self-Service - TDD", () => {
	test.beforeEach(() => {
		initializeDatabase();
	});

	test("should allow participant to cancel their own registration", () => {
		// Arrange
		const course = createCourse({
			name: "Yoga Class",
			ageGroup: "3-12 months",
			color: "#FF5733",
		});
		CourseDB.insert(course);

		const calendar = new LessonCalendarDB();
		const lessons = calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Morning Yoga",
			location: "Studio A",
			time: "09:00",
			dayOfWeek: "Monday",
			capacity: 10,
			dates: ["2024-05-20"], // Future date
		});

		const participant = createParticipant({
			name: "Alice",
			email: "alice@example.com",
			phone: "111",
			ageGroup: "3-12 months",
		});
		ParticipantDB.insert(participant);

		const registrationManager = new RegistrationManagerDB();
		const registration = registrationManager.registerParticipant(
			lessons[0].id,
			participant,
		);

		// Act
		const result = registrationManager.participantCancelRegistration(
			registration.id,
			participant.id,
		);

		// Assert
		expect(result.success).toBe(true);
		expect(result.message).toContain("cancelled");

		// Verify lesson enrolled count decreased
		const updatedLesson = calendar.getLessonById(lessons[0].id);
		expect(updatedLesson?.enrolledCount).toBe(0);
	});

	test("should prevent participant from cancelling other participant's registration", () => {
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
			dates: ["2024-05-22"],
		});

		const participant1 = createParticipant({
			name: "Bob",
			email: "bob@example.com",
			phone: "222",
			ageGroup: "2-3 years",
		});
		const participant2 = createParticipant({
			name: "Charlie",
			email: "charlie@example.com",
			phone: "333",
			ageGroup: "2-3 years",
		});
		ParticipantDB.insert(participant1);
		ParticipantDB.insert(participant2);

		const registrationManager = new RegistrationManagerDB();
		const registration = registrationManager.registerParticipant(
			lessons[0].id,
			participant1,
		);

		// Act - participant2 tries to cancel participant1's registration
		const result = registrationManager.participantCancelRegistration(
			registration.id,
			participant2.id,
		);

		// Assert
		expect(result.success).toBe(false);
		expect(result.error).toContain("not authorized");
	});

	test("should allow participant to register for available lesson", () => {
		// Arrange
		const course = createCourse({
			name: "Art Class",
			ageGroup: "3-4 years",
			color: "#5733FF",
		});
		CourseDB.insert(course);

		const calendar = new LessonCalendarDB();
		const lessons = calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Painting",
			location: "Art Room",
			time: "14:00",
			dayOfWeek: "Thursday",
			capacity: 10,
			dates: ["2024-05-23"],
		});

		const participant = createParticipant({
			name: "David",
			email: "david@example.com",
			phone: "444",
			ageGroup: "3-4 years",
		});
		ParticipantDB.insert(participant);

		const registrationManager = new RegistrationManagerDB();

		// Act
		const result = registrationManager.participantSelfRegister(
			lessons[0].id,
			participant.id,
		);

		// Assert
		expect(result.success).toBe(true);
		expect(result.registration).toBeDefined();
		expect(result.registration?.status).toBe("confirmed");

		// Verify lesson enrolled count increased
		const updatedLesson = calendar.getLessonById(lessons[0].id);
		expect(updatedLesson?.enrolledCount).toBe(1);
	});

	test("should prevent participant from registering to lesson with different age group", () => {
		// Arrange
		const course = createCourse({
			name: "Baby Music",
			ageGroup: "3-12 months",
			color: "#FF3357",
		});
		CourseDB.insert(course);

		const calendar = new LessonCalendarDB();
		const lessons = calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Music Time",
			location: "Music Room",
			time: "10:00",
			dayOfWeek: "Friday",
			capacity: 10,
			dates: ["2024-05-24"],
		});

		const participant = createParticipant({
			name: "Emma",
			email: "emma@example.com",
			phone: "555",
			ageGroup: "3-4 years", // Different age group!
		});
		ParticipantDB.insert(participant);

		const registrationManager = new RegistrationManagerDB();

		// Act
		const result = registrationManager.participantSelfRegister(
			lessons[0].id,
			participant.id,
		);

		// Assert
		expect(result.success).toBe(false);
		expect(result.error).toContain("age group");
	});

	test("should allow participant to transfer from one lesson to another", () => {
		// Arrange
		const course = createCourse({
			name: "Fitness Class",
			ageGroup: "1-2 years",
			color: "#3357FF",
		});
		CourseDB.insert(course);

		const calendar = new LessonCalendarDB();
		const lessons = calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Kids Fitness",
			location: "Gym",
			time: "16:00",
			dayOfWeek: "Tuesday",
			capacity: 10,
			dates: ["2024-05-21", "2024-05-28"],
		});

		const participant = createParticipant({
			name: "Frank",
			email: "frank@example.com",
			phone: "666",
			ageGroup: "1-2 years",
		});
		ParticipantDB.insert(participant);

		const registrationManager = new RegistrationManagerDB();

		// Register to first lesson
		const firstReg = registrationManager.registerParticipant(
			lessons[0].id,
			participant,
		);

		// Act - transfer to second lesson
		const result = registrationManager.participantTransferLesson(
			firstReg.id,
			lessons[1].id,
			participant.id,
		);

		// Assert
		expect(result.success).toBe(true);
		expect(result.newRegistration).toBeDefined();

		// Verify first lesson count decreased
		const lesson1 = calendar.getLessonById(lessons[0].id);
		expect(lesson1?.enrolledCount).toBe(0);

		// Verify second lesson count increased
		const lesson2 = calendar.getLessonById(lessons[1].id);
		expect(lesson2?.enrolledCount).toBe(1);
	});

	test("should get available lessons filtered by participant age group", () => {
		// Arrange
		const course1 = createCourse({
			name: "Baby Class",
			ageGroup: "3-12 months",
			color: "#FF5733",
		});
		const course2 = createCourse({
			name: "Toddler Class",
			ageGroup: "1-2 years",
			color: "#33FF57",
		});
		CourseDB.insert(course1);
		CourseDB.insert(course2);

		const calendar = new LessonCalendarDB();

		// Create lessons for different age groups (future dates)
		const futureDate = new Date();
		futureDate.setDate(futureDate.getDate() + 7); // 1 week from now
		const futureDateStr = futureDate.toISOString().split('T')[0];

		calendar.bulkCreateLessons({
			courseId: course1.id,
			title: "Baby Yoga",
			location: "Studio A",
			time: "09:00",
			dayOfWeek: "Monday",
			capacity: 10,
			dates: [futureDateStr],
		});

		calendar.bulkCreateLessons({
			courseId: course2.id,
			title: "Toddler Dance",
			location: "Studio B",
			time: "10:00",
			dayOfWeek: "Monday",
			capacity: 10,
			dates: [futureDateStr],
		});

		const participant = createParticipant({
			name: "Grace",
			email: "grace@example.com",
			phone: "777",
			ageGroup: "3-12 months",
		});
		ParticipantDB.insert(participant);

		const registrationManager = new RegistrationManagerDB();

		// Act
		const availableLessons = registrationManager.getAvailableLessonsForParticipant(
			participant.id,
		);

		// Assert
		expect(availableLessons.length).toBe(1);
		expect(availableLessons[0].title).toBe("Baby Yoga");
		expect(availableLessons[0].ageGroup).toBe("3-12 months");
	});

	test("should prevent double registration to same lesson", () => {
		// Arrange
		const course = createCourse({
			name: "Test Class",
			ageGroup: "2-3 years",
			color: "#5733FF",
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
			dates: ["2024-05-25"],
		});

		const participant = createParticipant({
			name: "Henry",
			email: "henry@example.com",
			phone: "888",
			ageGroup: "2-3 years",
		});
		ParticipantDB.insert(participant);

		const registrationManager = new RegistrationManagerDB();

		// First registration
		registrationManager.participantSelfRegister(lessons[0].id, participant.id);

		// Act - try to register again
		const result = registrationManager.participantSelfRegister(
			lessons[0].id,
			participant.id,
		);

		// Assert
		expect(result.success).toBe(false);
		expect(result.error).toContain("already registered");
	});
});
