import { expect, test } from "@playwright/test";
import { LessonCalendarDB } from "../src/calendar-db.js";
import { CourseDB, initializeDatabase } from "../src/database.js";
import { createCourse } from "../src/course.js";

test.describe("Bulk Lesson Creation - TDD", () => {
	test.beforeEach(() => {
		initializeDatabase();
	});

	test("should create multiple lessons from course template", () => {
		// Arrange
		const course = createCourse({
			name: "Baby Yoga",
			ageGroup: "3-12 months",
			color: "#FF5733",
			description: "Yoga for babies",
		});
		CourseDB.insert(course);

		const calendar = new LessonCalendarDB();
		const bulkConfig = {
			courseId: course.id,
			title: "Morning Baby Yoga",
			location: "Studio A",
			time: "09:00",
			dayOfWeek: "Monday",
			capacity: 8,
			dates: ["2024-03-04", "2024-03-11", "2024-03-18", "2024-03-25"],
		};

		// Act
		const createdLessons = calendar.bulkCreateLessons(bulkConfig);

		// Assert
		expect(createdLessons).toHaveLength(4);

		// Verify all lessons have correct properties
		for (const lesson of createdLessons) {
			expect(lesson.title).toBe("Morning Baby Yoga");
			expect(lesson.location).toBe("Studio A");
			expect(lesson.time).toBe("09:00");
			expect(lesson.dayOfWeek).toBe("Monday");
			expect(lesson.capacity).toBe(8);
			expect(lesson.ageGroup).toBe("3-12 months");
			expect(lesson.enrolledCount).toBe(0);
		}

		// Verify dates are correct
		const lessonDates = createdLessons.map((l) => l.date).sort();
		expect(lessonDates).toEqual([
			"2024-03-04",
			"2024-03-11",
			"2024-03-18",
			"2024-03-25",
		]);
	});

	test("should link created lessons to course", () => {
		// Arrange
		const course = createCourse({
			name: "Toddler Dance",
			ageGroup: "2-3 years",
			color: "#33FF57",
		});
		CourseDB.insert(course);

		const calendar = new LessonCalendarDB();
		const bulkConfig = {
			courseId: course.id,
			title: "Dance Party",
			location: "Main Hall",
			time: "15:00",
			dayOfWeek: "Wednesday",
			capacity: 12,
			dates: ["2024-03-06", "2024-03-13"],
		};

		// Act
		const createdLessons = calendar.bulkCreateLessons(bulkConfig);

		// Assert
		expect(createdLessons).toHaveLength(2);

		// Verify course linkage through database
		const allLessons = calendar.getAllLessons();
		const courseLessons = allLessons.filter(
			(l: { courseId?: string }) => l.courseId === course.id,
		);
		expect(courseLessons).toHaveLength(2);
	});

	test("should create lessons with recurring weekly pattern", () => {
		// Arrange
		const course = createCourse({
			name: "Kids Fitness",
			ageGroup: "3-4 years",
			color: "#5733FF",
		});
		CourseDB.insert(course);

		const calendar = new LessonCalendarDB();
		const startDate = new Date("2024-03-01"); // Friday
		const weeksCount = 4;

		const bulkConfig = {
			courseId: course.id,
			title: "Friday Fitness",
			location: "Gym",
			time: "16:00",
			dayOfWeek: "Friday",
			capacity: 15,
			startDate: "2024-03-01",
			weeksCount: 4,
		};

		// Act
		const createdLessons = calendar.bulkCreateLessonsRecurring(bulkConfig);

		// Assert
		expect(createdLessons).toHaveLength(4);

		// Verify weekly pattern
		const dates = createdLessons.map((l) => l.date).sort();
		expect(dates).toEqual([
			"2024-03-01",
			"2024-03-08",
			"2024-03-15",
			"2024-03-22",
		]);
	});

	test("should reject bulk creation with empty dates array", () => {
		// Arrange
		const course = createCourse({
			name: "Test Course",
			ageGroup: "1-2 years",
			color: "#FF5733",
		});
		CourseDB.insert(course);

		const calendar = new LessonCalendarDB();
		const bulkConfig = {
			courseId: course.id,
			title: "Test Lesson",
			location: "Studio",
			time: "10:00",
			dayOfWeek: "Tuesday",
			capacity: 10,
			dates: [],
		};

		// Act & Assert
		expect(() => calendar.bulkCreateLessons(bulkConfig)).toThrow(
			"At least one date is required",
		);
	});

	test("should retrieve all lessons for a specific course", () => {
		// Arrange
		const course = createCourse({
			name: "Art Class",
			ageGroup: "3-4 years",
			color: "#FF3357",
		});
		CourseDB.insert(course);

		const calendar = new LessonCalendarDB();
		calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Creative Art",
			location: "Art Room",
			time: "14:00",
			dayOfWeek: "Thursday",
			capacity: 10,
			dates: ["2024-03-07", "2024-03-14", "2024-03-21"],
		});

		// Act
		const courseLessons = calendar.getLessonsByCourse(course.id);

		// Assert
		expect(courseLessons).toHaveLength(3);
		for (const lesson of courseLessons) {
			expect(lesson.title).toBe("Creative Art");
		}
	});
});
