import { expect, test } from "@playwright/test";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	LessonDB,
	resetDatabaseForTests,
} from "../src/database.js";

const BASE = "http://localhost:3000";

test.describe
	.serial("GET /api/lessons includes courseColor and courseName", () => {
		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();
		});

		test("lesson with courseId includes courseColor and courseName from the linked course", async () => {
			const course = createCourse({
				name: "Color Test Course",
				ageGroup: "1 - 2 roky",
				color: "#AABBCC",
			});
			await CourseDB.insert(course);

			await LessonDB.insert({
				id: "lesson_color_test",
				title: "Color Test Lesson",
				date: "2030-06-01",
				dayOfWeek: "Sunday",
				time: "10:00",
				location: "Studio",
				ageGroup: "1 - 2 roky",
				capacity: 10,
				enrolledCount: 0,
				courseId: course.id,
			});

			const res = await fetch(`${BASE}/api/lessons`);
			expect(res.status).toBe(200);
			const lessons = await res.json();

			const lesson = lessons.find(
				(l: { id: string }) => l.id === "lesson_color_test",
			);
			expect(lesson).toBeDefined();
			expect(lesson.courseColor).toBe("#AABBCC");
			expect(lesson.courseName).toBe("Color Test Course");
		});

		test("lesson without courseId has courseColor and courseName as null", async () => {
			await LessonDB.insert({
				id: "lesson_no_course",
				title: "No Course Lesson",
				date: "2030-06-02",
				dayOfWeek: "Monday",
				time: "10:00",
				location: "Studio",
				ageGroup: "1 - 2 roky",
				capacity: 10,
				enrolledCount: 0,
			});

			const res = await fetch(`${BASE}/api/lessons`);
			const lessons = await res.json();

			const lesson = lessons.find(
				(l: { id: string }) => l.id === "lesson_no_course",
			);
			expect(lesson).toBeDefined();
			expect(lesson.courseColor).toBeNull();
			expect(lesson.courseName).toBeNull();
		});
	});
