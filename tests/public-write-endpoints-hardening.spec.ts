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

async function seedLesson(): Promise<string> {
	const course = createCourse({
		name: "Test skupinka hardening",
		ageGroup: "1 - 2 roky",
	});
	await CourseDB.insert(course);

	const today = new Date();
	const future = new Date(today);
	future.setDate(today.getDate() + 7);
	const lesson = createLesson({
		title: "Hardening test lekce",
		date: future.toISOString().slice(0, 10),
		dayOfWeek: "Monday",
		time: "10:00",
		ageGroup: "1 - 2 roky",
		capacity: 10,
	});
	await LessonDB.insertWithCourse(lesson, course.id);
	return lesson.id;
}

test.describe("Input validation on public write endpoints", () => {
	let lessonId: string;

	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();
		lessonId = await seedLesson();
	});

	test("POST /api/registrations rejects a malformed email with 400", async () => {
		const res = await fetch(`${BASE}/api/registrations`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				lessonId,
				participant: {
					name: "Test Maminka",
					email: "not-an-email",
					phone: "",
					ageGroup: "1 - 2 roky",
				},
			}),
		});
		expect(res.status).toBe(400);
	});

	test("POST /api/registrations rejects a missing name with 400", async () => {
		const res = await fetch(`${BASE}/api/registrations`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				lessonId,
				participant: {
					name: "",
					email: "valid@test.cz",
					phone: "",
					ageGroup: "1 - 2 roky",
				},
			}),
		});
		expect(res.status).toBe(400);
	});

	test("POST /api/registrations accepts a valid payload", async () => {
		const res = await fetch(`${BASE}/api/registrations`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				lessonId,
				participant: {
					name: "Test Maminka",
					email: "valid@test.cz",
					phone: "",
					ageGroup: "1 - 2 roky",
				},
			}),
		});
		expect(res.status).toBe(201);
	});

	test("POST /api/substitutions rejects a malformed email with 400", async () => {
		const res = await fetch(`${BASE}/api/substitutions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				lessonId,
				missedLessonId: lessonId,
				participant: {
					name: "Test Maminka",
					email: "also-not-an-email",
					phone: "",
					ageGroup: "1 - 2 roky",
				},
			}),
		});
		expect(res.status).toBe(400);
	});
});

test.describe("Rate limiting on public write endpoints", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("POST /api/registrations returns 429 after exceeding the per-IP limit", async () => {
		const lessonId = await seedLesson();
		let last429: Response | undefined;

		for (let i = 0; i < 15; i++) {
			const res = await fetch(`${BASE}/api/registrations`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Forwarded-For": "203.0.113.5",
				},
				body: JSON.stringify({
					lessonId,
					participant: {
						name: `Rate Limit Test ${i}`,
						email: `rate-limit-${i}@test.cz`,
						phone: "",
						ageGroup: "1 - 2 roky",
					},
				}),
			});
			if (res.status === 429) {
				last429 = res;
				break;
			}
		}

		expect(last429?.status).toBe(429);
	});
});
