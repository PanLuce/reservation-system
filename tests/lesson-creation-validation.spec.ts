import { expect, test } from "@playwright/test";
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

test.describe
	.serial("POST /api/lessons — input validation", () => {
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

		const validPayload = () => ({
			title: "Ranní lekce",
			date: "2026-09-01",
			dayOfWeek: "Monday",
			time: "10:00",
			ageGroup: "6-9 měsíců (do lezení)",
			capacity: 10,
			courseId,
		});

		test("should return 400 when date is missing", async () => {
			const { date: _omit, ...payload } = validPayload();
			const res = await fetch(`${BASE}/api/lessons`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify(payload),
			});
			expect(res.status).toBe(400);
			const body = await res.json();
			expect(body.error).toMatch(/date/i);
		});

		test("should return 400 when title is missing", async () => {
			const { title: _omit, ...payload } = validPayload();
			const res = await fetch(`${BASE}/api/lessons`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify(payload),
			});
			expect(res.status).toBe(400);
		});

		test("should return 400 when time is missing", async () => {
			const { time: _omit, ...payload } = validPayload();
			const res = await fetch(`${BASE}/api/lessons`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify(payload),
			});
			expect(res.status).toBe(400);
		});

		test("should return 400 when dayOfWeek is missing", async () => {
			const { dayOfWeek: _omit, ...payload } = validPayload();
			const res = await fetch(`${BASE}/api/lessons`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify(payload),
			});
			expect(res.status).toBe(400);
		});

		test("should return 400 when capacity is missing", async () => {
			const { capacity: _omit, ...payload } = validPayload();
			const res = await fetch(`${BASE}/api/lessons`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify(payload),
			});
			expect(res.status).toBe(400);
		});

		test("should return 201 with all required fields present", async () => {
			const res = await fetch(`${BASE}/api/lessons`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify(validPayload()),
			});
			expect(res.status).toBe(201);
		});
	});
