import { expect, test } from "@playwright/test";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	LessonDB,
	resetDatabaseForTests,
} from "../src/database.js";
import { createLesson } from "../src/lesson.js";

import { BASE } from "./helpers/base.js";

async function loginAsAdmin(): Promise<string> {
	const res = await fetch(`${BASE}/api/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			email: "admin@centrumrubacek.cz",
			password: "admin123",
		}),
	});
	return res.headers.get("set-cookie") ?? "";
}

test.describe("PUT /api/lessons/:id column whitelist", () => {
	let lessonId: string;
	let otherCourseId: string;
	let adminCookie: string;

	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();

		const course = createCourse({
			name: "Test skupinka whitelist",
			ageGroup: "1 - 2 roky",
		});
		await CourseDB.insert(course);

		const otherCourse = createCourse({
			name: "Jina skupinka",
			ageGroup: "1 - 2 roky",
		});
		await CourseDB.insert(otherCourse);
		otherCourseId = otherCourse.id;

		const today = new Date();
		const future = new Date(today);
		future.setDate(today.getDate() + 7);
		const lesson = createLesson({
			title: "Lekce k upravě",
			date: future.toISOString().slice(0, 10),
			dayOfWeek: "Monday",
			time: "10:00",
			ageGroup: "1 - 2 roky",
			capacity: 10,
		});
		await LessonDB.insertWithCourse(lesson, course.id);
		lessonId = lesson.id;

		adminCookie = await loginAsAdmin();
	});

	test("allows updating title, time and capacity", async () => {
		const res = await fetch(`${BASE}/api/lessons/${lessonId}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", Cookie: adminCookie },
			body: JSON.stringify({
				title: "Upravená lekce",
				time: "11:00",
				capacity: 5,
			}),
		});
		expect(res.status).toBe(200);
		const updated = await res.json();
		expect(updated.title).toBe("Upravená lekce");
		expect(updated.time).toBe("11:00");
		expect(updated.capacity).toBe(5);
	});

	test("silently ignores enrolledCount in the request body — cannot be mass-assigned", async () => {
		const before = await LessonDB.getById(lessonId);
		const beforeEnrolled = (before as Record<string, unknown>).enrolledCount;

		const res = await fetch(`${BASE}/api/lessons/${lessonId}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", Cookie: adminCookie },
			body: JSON.stringify({ title: "Ok titulek", enrolledCount: 9999 }),
		});
		expect(res.status).toBe(200);

		const after = await LessonDB.getById(lessonId);
		expect((after as Record<string, unknown>).enrolledCount).toBe(
			beforeEnrolled,
		);
	});

	test("silently ignores courseId in the request body — cannot reassign the lesson's course", async () => {
		const res = await fetch(`${BASE}/api/lessons/${lessonId}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", Cookie: adminCookie },
			body: JSON.stringify({ title: "Ok titulek 2", courseId: otherCourseId }),
		});
		expect(res.status).toBe(200);

		const after = await LessonDB.getById(lessonId);
		expect((after as Record<string, unknown>).courseId).not.toBe(otherCourseId);
	});

	test("rejects a body with no whitelisted fields at all", async () => {
		const res = await fetch(`${BASE}/api/lessons/${lessonId}`, {
			method: "PUT",
			headers: { "Content-Type": "application/json", Cookie: adminCookie },
			body: JSON.stringify({ enrolledCount: 9999, courseId: otherCourseId }),
		});
		expect(res.status).toBe(400);
	});
});
