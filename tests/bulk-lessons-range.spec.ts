import { expect, test } from "@playwright/test";
import { LessonCalendarDB } from "../src/calendar-db.js";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	resetDatabaseForTests,
} from "../src/database.js";

const BASE = "http://localhost:3000";

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

test.describe("LessonCalendarDB.bulkCreateLessonsRange", () => {
	test.beforeEach(async () => {
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("should create one lesson per matching weekday between startDate and endDate", async () => {
		const course = createCourse({
			name: "Baby Yoga",
			ageGroup: "6-9 měsíců (do lezení)",
			color: "#FF6B6B",
		});
		await CourseDB.insert(course);
		const calendar = new LessonCalendarDB();

		// 2026-09-01 is Tuesday; first Monday on or after is 2026-09-07
		// Mondays through 2026-12-21: 7,14,21,28 Sep; 5,12,19,26 Oct; 2,9,16,23,30 Nov; 7,14,21 Dec = 16
		const lessons = await calendar.bulkCreateLessonsRange({
			courseId: course.id,
			title: "Ranní lekce",
			time: "10:00",
			dayOfWeek: "Monday",
			capacity: 10,
			startDate: "2026-09-01",
			endDate: "2026-12-21",
		});

		expect(lessons.length).toBe(16);
		for (const lesson of lessons) {
			const d = new Date(lesson.date);
			expect(d.getUTCDay()).toBe(1); // 1 = Monday
		}
		// First lesson should be on the first Monday on or after startDate
		expect(lessons.at(0)?.date).toBe("2026-09-07");
		// Last lesson should be on or before endDate
		expect(lessons.at(-1)?.date).toBe("2026-12-21");
	});

	test("should reject when endDate is before startDate", async () => {
		const course = createCourse({
			name: "Test",
			ageGroup: "1 - 2 roky",
			color: "#000000",
		});
		await CourseDB.insert(course);
		const calendar = new LessonCalendarDB();

		await expect(
			calendar.bulkCreateLessonsRange({
				courseId: course.id,
				title: "Test",
				time: "10:00",
				dayOfWeek: "Monday",
				capacity: 5,
				startDate: "2026-12-01",
				endDate: "2026-09-01",
			}),
		).rejects.toThrow(/endDate must be/i);
	});

	test("should reject when range would produce more than 52 lessons", async () => {
		const course = createCourse({
			name: "Test",
			ageGroup: "1 - 2 roky",
			color: "#000000",
		});
		await CourseDB.insert(course);
		const calendar = new LessonCalendarDB();

		// ~2 years of Mondays = 104 → over 52 cap
		await expect(
			calendar.bulkCreateLessonsRange({
				courseId: course.id,
				title: "Test",
				time: "10:00",
				dayOfWeek: "Monday",
				capacity: 5,
				startDate: "2026-01-01",
				endDate: "2028-01-01",
			}),
		).rejects.toThrow(/too many/i);
	});
});

test.describe
	.serial("POST /api/courses/:courseId/bulk-lessons — startDate+endDate branch", () => {
		let adminCookie: string;
		let courseId: string;

		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();

			const course = createCourse({
				name: "Baby Yoga",
				ageGroup: "6-9 měsíců (do lezení)",
				color: "#FF6B6B",
			});
			await CourseDB.insert(course);
			courseId = course.id;

			adminCookie = await loginAsAdmin();
		});

		test("should create recurring lessons from startDate to endDate", async () => {
			const res = await fetch(`${BASE}/api/courses/${courseId}/bulk-lessons`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({
					title: "Ranní lekce",
					time: "10:00",
					dayOfWeek: "Monday",
					capacity: 10,
					startDate: "2026-09-07",
					endDate: "2026-09-28",
				}),
			});
			expect(res.status).toBe(201);
			const data = await res.json();
			expect(data.lessons).toHaveLength(4);
			for (const lesson of data.lessons) {
				expect(new Date(lesson.date).getUTCDay()).toBe(1);
			}
		});

		test("should return 400 when endDate is before startDate", async () => {
			const res = await fetch(`${BASE}/api/courses/${courseId}/bulk-lessons`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({
					title: "Test",
					time: "10:00",
					dayOfWeek: "Monday",
					capacity: 10,
					startDate: "2026-12-01",
					endDate: "2026-09-01",
				}),
			});
			expect(res.status).toBe(400);
		});
	});
