import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	resetDatabaseForTests,
	UserDB,
} from "../src/database.js";

const BASE = "http://localhost:3000";

async function loginAs(
	email: string,
	password: string,
): Promise<{ cookie: string }> {
	const res = await fetch(`${BASE}/api/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});
	const setCookie = res.headers.get("set-cookie") ?? "";
	return { cookie: setCookie };
}

test.describe
	.serial("Lesson creation — skupinka required", () => {
		let adminCookie: string;

		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();

			await UserDB.insert({
				id: "participant_2a",
				email: "participant2a@example.com",
				passwordHash: await bcrypt.hash("pass123", 10),
				name: "Participant",
				role: "participant",
			});

			const login = await loginAs("admin@centrumrubacek.cz", "admin123");
			adminCookie = login.cookie;
		});

		test("POST /api/lessons without courseId returns 400", async () => {
			const res = await fetch(`${BASE}/api/lessons`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: adminCookie,
				},
				body: JSON.stringify({
					title: "No Skupinka",
					date: "2026-06-01",
					dayOfWeek: "Monday",
					time: "10:00",
					location: "Studio",
					ageGroup: "1-2 years",
					capacity: 10,
					// courseId intentionally omitted
				}),
			});
			expect(res.status).toBe(400);
		});

		test("POST /api/lessons with courseId creates lesson and returns 201 with courseId", async () => {
			const course = createCourse({
				name: "3-6 měsíců, Vietnamská",
				ageGroup: "3-12 months",
				color: "#FF6B6B",
			});
			await CourseDB.insert(course);

			const res = await fetch(`${BASE}/api/lessons`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: adminCookie,
				},
				body: JSON.stringify({
					title: "Ranní cvičení",
					date: "2026-06-01",
					dayOfWeek: "Monday",
					time: "10:00",
					location: "Studio",
					ageGroup: "3-12 months",
					capacity: 10,
					courseId: course.id,
				}),
			});
			expect(res.status).toBe(201);
			const data = await res.json();
			expect(data.courseId).toBe(course.id);
		});
	});
