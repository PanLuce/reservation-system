import { expect, test } from "@playwright/test";
import { LessonCalendarDB } from "../src/calendar-db.js";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	LessonDB,
	resetDatabaseForTests,
} from "../src/database.js";
import { createLesson } from "../src/lesson.js";

test.describe("Course location — Stage 4b", () => {
	test.beforeEach(async () => {
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("lesson inherits location from its course via DB join", async () => {
		// Arrange
		const course = createCourse({
			name: "Vietnamská skupinka",
			ageGroup: "1 - 2 roky",
			location: "CVČ Vietnamská",
		});
		await CourseDB.insert(course);

		const lesson = createLesson({
			title: "Lekce pondělí",
			date: "2024-05-06",
			dayOfWeek: "Monday",
			time: "10:00",
			ageGroup: "1 - 2 roky",
			capacity: 10,
		});
		await LessonDB.insertWithCourse(lesson, course.id);

		// Act
		const lessonsForCourse = await LessonDB.getByCourse(course.id);

		// Assert
		expect(lessonsForCourse).toHaveLength(1);
		const fetchedLesson = lessonsForCourse[0] as Record<string, unknown>;
		expect(fetchedLesson.location).toBe("CVČ Vietnamská");
	});

	test("two courses with different locations produce lessons with correct locations", async () => {
		// Arrange
		const courseA = createCourse({
			name: "Skupina Vietnamská",
			ageGroup: "1 - 2 roky",
			location: "CVČ Vietnamská",
		});
		const courseB = createCourse({
			name: "Skupina Jeremiáše",
			ageGroup: "2 - 3 roky",
			location: "O.Jeremiáše",
		});
		await CourseDB.insert(courseA);
		await CourseDB.insert(courseB);

		const lessonA = createLesson({
			title: "Lekce A",
			date: "2024-05-06",
			dayOfWeek: "Monday",
			time: "10:00",
			ageGroup: "1 - 2 roky",
			capacity: 8,
		});
		const lessonB = createLesson({
			title: "Lekce B",
			date: "2024-05-07",
			dayOfWeek: "Tuesday",
			time: "11:00",
			ageGroup: "2 - 3 roky",
			capacity: 8,
		});
		await LessonDB.insertWithCourse(lessonA, courseA.id);
		await LessonDB.insertWithCourse(lessonB, courseB.id);

		// Act
		const all = await LessonDB.getAll();

		// Assert
		const a = all.find(
			(l) => (l as Record<string, unknown>).title === "Lekce A",
		) as Record<string, unknown>;
		const b = all.find(
			(l) => (l as Record<string, unknown>).title === "Lekce B",
		) as Record<string, unknown>;
		expect(a?.location).toBe("CVČ Vietnamská");
		expect(b?.location).toBe("O.Jeremiáše");
	});

	test("lesson without a course has empty location", async () => {
		// Arrange
		const lesson = createLesson({
			title: "Orphan Lesson",
			date: "2024-05-08",
			dayOfWeek: "Wednesday",
			time: "09:00",
			ageGroup: "1 - 2 roky",
			capacity: 5,
		});
		await LessonDB.insert(lesson);

		// Act
		const fetched = await LessonDB.getById(lesson.id);

		// Assert
		expect((fetched as Record<string, unknown>)?.location).toBe("");
	});

	test("bulk-created lessons inherit course location", async () => {
		// Arrange
		const course = createCourse({
			name: "DK Poklad skupinka",
			ageGroup: "lezoucí děti",
			location: "DK Poklad",
		});
		await CourseDB.insert(course);

		const calendar = new LessonCalendarDB();

		// Act
		await calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Lekce DK Poklad",
			time: "09:00",
			dayOfWeek: "Thursday",
			capacity: 10,
			dates: ["2024-05-09", "2024-05-16"],
		});

		// Assert
		const lessons = await calendar.getLessonsByCourse(course.id);
		expect(lessons).toHaveLength(2);
		for (const lesson of lessons) {
			expect((lesson as unknown as Record<string, unknown>).location).toBe(
				"DK Poklad",
			);
		}
	});
});
