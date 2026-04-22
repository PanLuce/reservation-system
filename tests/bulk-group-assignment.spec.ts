import { expect, test } from "@playwright/test";
import { LessonCalendarDB } from "../src/calendar-db.js";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	ParticipantDB,
	resetDatabaseForTests,
} from "../src/database.js";
import { createParticipant } from "../src/participant.js";
import { RegistrationManagerDB } from "../src/registration-db.js";

test.describe("Bulk Group Assignment - TDD", () => {
	test.beforeEach(async () => {
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("should assign all course participants to multiple lessons", async () => {
		// Arrange
		const course = createCourse({
			name: "Baby Yoga Course",
			ageGroup: "6-9 měsíců (do lezení)",
			color: "#FF5733",
		});
		await CourseDB.insert(course);

		// Create 3 participants linked to course
		const participants = [
			createParticipant({
				name: "Alice",
				email: "alice@example.com",
				phone: "111",
				ageGroup: "6-9 měsíců (do lezení)",
			}),
			createParticipant({
				name: "Bob",
				email: "bob@example.com",
				phone: "222",
				ageGroup: "6-9 měsíců (do lezení)",
			}),
			createParticipant({
				name: "Charlie",
				email: "charlie@example.com",
				phone: "333",
				ageGroup: "6-9 měsíců (do lezení)",
			}),
		];

		for (const p of participants) {
			await ParticipantDB.insert(p);
		}

		// Create 2 lessons from course
		const calendar = new LessonCalendarDB();
		const lessons = await calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Morning Yoga",
			time: "09:00",
			dayOfWeek: "Monday",
			capacity: 10,
			dates: ["2024-03-04", "2024-03-11"],
		});

		const registrationManager = new RegistrationManagerDB();

		// Act
		const result = await registrationManager.bulkAssignGroupToLessons({
			participantIds: participants.map((p) => p.id),
			lessonIds: lessons.map((l) => l.id),
		});

		// Assert
		expect(result.totalRegistrations).toBe(6); // 3 participants x 2 lessons
		expect(result.successful).toBe(6);
		expect(result.skipped).toBe(0);
		expect(result.waitlisted).toBe(0);

		// Verify registrations in database
		for (const lesson of lessons) {
			const regs = await registrationManager.getRegistrationsForLesson(
				lesson.id,
			);
			expect(regs).toHaveLength(3);
		}
	});

	test("should skip participants already registered to lesson", async () => {
		// Arrange
		const course = createCourse({
			name: "Toddler Dance",
			ageGroup: "2 - 3 roky",
			color: "#33FF57",
		});
		await CourseDB.insert(course);

		const participants = [
			createParticipant({
				name: "David",
				email: "david@example.com",
				phone: "444",
				ageGroup: "2 - 3 roky",
			}),
			createParticipant({
				name: "Emma",
				email: "emma@example.com",
				phone: "555",
				ageGroup: "2 - 3 roky",
			}),
		];

		for (const p of participants) {
			await ParticipantDB.insert(p);
		}

		const calendar = new LessonCalendarDB();
		const lessons = await calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Dance Class",
			time: "15:00",
			dayOfWeek: "Wednesday",
			capacity: 10,
			dates: ["2024-03-06"],
		});

		const registrationManager = new RegistrationManagerDB();

		// Pre-register David to the lesson
		await registrationManager.registerParticipant(
			lessons[0]!.id,
			participants[0]!,
		);

		// Act - try to register both participants
		const result = await registrationManager.bulkAssignGroupToLessons({
			participantIds: participants.map((p) => p.id),
			lessonIds: lessons.map((l) => l.id),
		});

		// Assert
		expect(result.totalRegistrations).toBe(2); // 2 participants x 1 lesson
		expect(result.successful).toBe(1); // Only Emma registered
		expect(result.skipped).toBe(1); // David skipped (already registered)

		// Verify only 2 registrations total (not 3)
		const regs = await registrationManager.getRegistrationsForLesson(
			lessons[0]!.id,
		);
		expect(regs).toHaveLength(2);
	});

	test("should handle capacity limits with waitlist", async () => {
		// Arrange
		const course = createCourse({
			name: "Small Class",
			ageGroup: "1 - 2 roky",
			color: "#5733FF",
		});
		await CourseDB.insert(course);

		// Create 5 participants
		const participants = [];
		for (let i = 0; i < 5; i++) {
			const p = createParticipant({
				name: `Participant ${i}`,
				email: `p${i}@example.com`,
				phone: `${i}${i}${i}`,
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(p);
			participants.push(p);
		}

		// Create lesson with capacity of 3
		const calendar = new LessonCalendarDB();
		const lessons = await calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Small Group",
			time: "10:00",
			dayOfWeek: "Friday",
			capacity: 3,
			dates: ["2024-03-08"],
		});

		const registrationManager = new RegistrationManagerDB();

		// Act
		const result = await registrationManager.bulkAssignGroupToLessons({
			participantIds: participants.map((p) => p.id),
			lessonIds: lessons.map((l) => l.id),
		});

		// Assert
		expect(result.totalRegistrations).toBe(5);
		expect(result.successful).toBe(3); // First 3 confirmed
		expect(result.waitlisted).toBe(2); // Last 2 waitlisted
		expect(result.skipped).toBe(0);

		// Verify registrations
		const regs = await registrationManager.getRegistrationsForLesson(
			lessons[0]!.id,
		);
		expect(regs).toHaveLength(5);

		const confirmed = regs.filter(
			(r: { status: string }) => r.status === "confirmed",
		);
		const waitlisted = regs.filter(
			(r: { status: string }) => r.status === "waitlist",
		);

		expect(confirmed).toHaveLength(3);
		expect(waitlisted).toHaveLength(2);
	});

	test("should work with course-participant linking", async () => {
		// Arrange
		const course = createCourse({
			name: "Art Class",
			ageGroup: "2,5 - 4 roky",
			color: "#FF3357",
		});
		await CourseDB.insert(course);

		// Create participants and link to course
		const participants = [];
		for (let i = 0; i < 3; i++) {
			const p = createParticipant({
				name: `Artist ${i}`,
				email: `artist${i}@example.com`,
				phone: `7${i}7`,
				ageGroup: "2,5 - 4 roky",
			});
			await ParticipantDB.insert(p);
			await ParticipantDB.linkToCourse(p.id, course.id);
			participants.push(p);
		}

		// Create lessons
		const calendar = new LessonCalendarDB();
		const lessons = await calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Art Workshop",
			time: "14:00",
			dayOfWeek: "Thursday",
			capacity: 10,
			dates: ["2024-03-07", "2024-03-14"],
		});

		const registrationManager = new RegistrationManagerDB();

		// Act - get participants by course and register them
		const courseParticipants = await ParticipantDB.getByCourse(course.id);
		const result = await registrationManager.bulkAssignGroupToLessons({
			participantIds: courseParticipants.map((p) => String(p.id)),
			lessonIds: lessons.map((l) => l.id),
		});

		// Assert
		expect(result.totalRegistrations).toBe(6); // 3 participants x 2 lessons
		expect(result.successful).toBe(6);
	});

	test("should provide detailed error information", async () => {
		// Arrange
		const registrationManager = new RegistrationManagerDB();

		// Act - try with invalid data
		const result = await registrationManager.bulkAssignGroupToLessons({
			participantIds: ["invalid_p1", "invalid_p2"],
			lessonIds: ["invalid_l1"],
		});

		// Assert
		expect(result.errors).toBeDefined();
		expect(result.errors.length).toBeGreaterThan(0);
		expect(result.successful).toBe(0);
	});
});
