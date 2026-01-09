import { expect, test } from "@playwright/test";
import { LessonCalendar } from "../src/calendar";
import type { Lesson } from "../src/lesson";

test.describe("Calendar Management - TDD Red Phase", () => {
	test("should add lessons to calendar", () => {
		// Arrange
		const calendar = new LessonCalendar();
		const lesson: Lesson = {
			id: "test_1",
			title: "Morning Class",
			dayOfWeek: "Monday",
			time: "10:00",
			location: "CVČ Vietnamská",
			ageGroup: "3-12 months",
			capacity: 10,
			enrolledCount: 0,
		};

		// Act
		calendar.addLesson(lesson);
		const lessons = calendar.getAllLessons();

		// Assert
		expect(lessons).toHaveLength(1);
		expect(lessons[0]).toEqual(lesson);
	});

	test("should get lessons by day of week", () => {
		// Arrange
		const calendar = new LessonCalendar();
		const mondayLesson: Lesson = {
			id: "test_1",
			title: "Monday Morning",
			dayOfWeek: "Monday",
			time: "10:00",
			location: "CVČ Vietnamská",
			ageGroup: "3-12 months",
			capacity: 10,
			enrolledCount: 0,
		};
		const tuesdayLesson: Lesson = {
			id: "test_2",
			title: "Tuesday Morning",
			dayOfWeek: "Tuesday",
			time: "10:00",
			location: "CVČ Jeremiáše",
			ageGroup: "1-2 years",
			capacity: 12,
			enrolledCount: 0,
		};

		// Act
		calendar.addLesson(mondayLesson);
		calendar.addLesson(tuesdayLesson);
		const mondayLessons = calendar.getLessonsByDay("Monday");

		// Assert
		expect(mondayLessons).toHaveLength(1);
		expect(mondayLessons[0].dayOfWeek).toBe("Monday");
	});

	test("should retrieve lesson by ID", () => {
		// Arrange
		const calendar = new LessonCalendar();
		const lesson: Lesson = {
			id: "test_123",
			title: "Test Class",
			dayOfWeek: "Wednesday",
			time: "14:00",
			location: "DK Poklad",
			ageGroup: "2-3 years",
			capacity: 8,
			enrolledCount: 0,
		};

		// Act
		calendar.addLesson(lesson);
		const retrieved = calendar.getLessonById("test_123");

		// Assert
		expect(retrieved).toBeDefined();
		expect(retrieved?.id).toBe("test_123");
		expect(retrieved?.title).toBe("Test Class");
	});
});
