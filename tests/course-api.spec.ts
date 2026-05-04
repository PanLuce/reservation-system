import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	LessonDB,
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
	.serial("Course API — CRUD", () => {
		let adminCookie: string;
		let participantCookie: string;

		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();

			// resetDatabaseForTests seeds admin@centrumrubacek.cz via ensureAdminUser().
			// Add a participant user for permission tests.
			await UserDB.insert({
				id: "participant_test",
				email: "participant@example.com",
				passwordHash: await bcrypt.hash("pass123", 10),
				name: "Participant",
				role: "participant",
			});

			const adminLogin = await loginAs("admin@centrumrubacek.cz", "admin123");
			adminCookie = adminLogin.cookie;

			const participantLogin = await loginAs(
				"participant@example.com",
				"pass123",
			);
			participantCookie = participantLogin.cookie;
		});

		test("GET /api/courses returns empty array when none exist", async () => {
			const res = await fetch(`${BASE}/api/courses`, {
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data).toHaveLength(0);
		});

		test("GET /api/courses returns all courses", async () => {
			const c1 = createCourse({
				name: "Bravo",
				ageGroup: "1 - 2 roky",
				color: "#FF0000",
			});
			const c2 = createCourse({
				name: "Alpha",
				ageGroup: "2 - 3 roky",
				color: "#00FF00",
			});
			await CourseDB.insert(c1);
			await CourseDB.insert(c2);

			const res = await fetch(`${BASE}/api/courses`, {
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data).toHaveLength(2);
		});

		test("GET /api/courses/:id returns 404 for unknown id", async () => {
			const res = await fetch(`${BASE}/api/courses/nonexistent-id`, {
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(404);
		});

		test("GET /api/courses/:id returns course", async () => {
			const course = createCourse({
				name: "Test Course",
				ageGroup: "1 - 2 roky",
				color: "#FF0000",
			});
			await CourseDB.insert(course);

			const res = await fetch(`${BASE}/api/courses/${course.id}`, {
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.id).toBe(course.id);
			expect(data.name).toBe("Test Course");
		});

		test("POST /api/courses as admin creates course and returns 201", async () => {
			const res = await fetch(`${BASE}/api/courses`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: adminCookie,
				},
				body: JSON.stringify({
					name: "3-6 měsíců, Vietnamská",
					ageGroup: "6-9 měsíců (do lezení)",
					color: "#FF6B6B",
					description: "Středa 10:00",
				}),
			});
			expect(res.status).toBe(201);
			const data = await res.json();
			expect(data.name).toBe("3-6 měsíců, Vietnamská");
			expect(data.id).toBeDefined();
		});

		test("POST /api/courses as participant returns 403", async () => {
			const res = await fetch(`${BASE}/api/courses`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: participantCookie,
				},
				body: JSON.stringify({
					name: "Sneaky Course",
					ageGroup: "1 - 2 roky",
					color: "#FF0000",
				}),
			});
			expect(res.status).toBe(403);
		});

		test("POST /api/courses with invalid color derives color from ageGroup", async () => {
			const res = await fetch(`${BASE}/api/courses`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: adminCookie,
				},
				body: JSON.stringify({
					name: "Auto Color Course",
					ageGroup: "1 - 2 roky",
					color: "not-a-color",
				}),
			});
			expect(res.status).toBe(201);
			const data = await res.json();
			expect(data.color).toMatch(/^#/);
		});

		test("POST /api/courses with empty name returns 400", async () => {
			const res = await fetch(`${BASE}/api/courses`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: adminCookie,
				},
				body: JSON.stringify({
					name: "",
					ageGroup: "1 - 2 roky",
					color: "#FF0000",
				}),
			});
			expect(res.status).toBe(400);
		});

		test("PUT /api/courses/:id updates fields selectively", async () => {
			const course = createCourse({
				name: "Original",
				ageGroup: "1 - 2 roky",
				color: "#FF0000",
			});
			await CourseDB.insert(course);

			const res = await fetch(`${BASE}/api/courses/${course.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Cookie: adminCookie,
				},
				body: JSON.stringify({ name: "Updated", color: "#00FF00" }),
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.name).toBe("Updated");
			expect(data.color).toBe("#00FF00");
			expect(data.ageGroup).toBe("1 - 2 roky");
		});

		test("PUT /api/courses/:id as participant returns 403", async () => {
			const course = createCourse({
				name: "Protected",
				ageGroup: "1 - 2 roky",
				color: "#FF0000",
			});
			await CourseDB.insert(course);

			const res = await fetch(`${BASE}/api/courses/${course.id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Cookie: participantCookie,
				},
				body: JSON.stringify({ name: "Hacked" }),
			});
			expect(res.status).toBe(403);
		});

		test("DELETE /api/courses/:id removes the course", async () => {
			const course = createCourse({
				name: "To Delete",
				ageGroup: "1 - 2 roky",
				color: "#FF0000",
			});
			await CourseDB.insert(course);

			const res = await fetch(`${BASE}/api/courses/${course.id}`, {
				method: "DELETE",
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(200);

			const gone = await CourseDB.getById(course.id);
			expect(gone).toBeUndefined();
		});

		test("DELETE /api/courses/:id sets lessons.courseId to NULL (cascade)", async () => {
			const course = createCourse({
				name: "With Lessons",
				ageGroup: "1 - 2 roky",
				color: "#FF0000",
			});
			await CourseDB.insert(course);

			await LessonDB.insert({
				id: "lesson_cascade_test",
				title: "Cascade Test Lesson",
				date: "2025-06-01",
				dayOfWeek: "Monday",
				time: "10:00",
				location: "Studio",
				ageGroup: "1 - 2 roky",
				capacity: 10,
				enrolledCount: 0,
			});
			await LessonDB.update("lesson_cascade_test", { courseId: course.id });

			await fetch(`${BASE}/api/courses/${course.id}`, {
				method: "DELETE",
				headers: { Cookie: adminCookie },
			});

			const lesson = await LessonDB.getById("lesson_cascade_test");
			expect(lesson).toBeDefined();
			expect(lesson!.courseId).toBeNull();
		});

		test("GET /api/courses/age-group/:ageGroup returns filtered courses", async () => {
			const c1 = createCourse({
				name: "Babies A",
				ageGroup: "6-9 měsíců (do lezení)",
				color: "#FF0000",
			});
			const c2 = createCourse({
				name: "Toddlers A",
				ageGroup: "1 - 2 roky",
				color: "#00FF00",
			});
			await CourseDB.insert(c1);
			await CourseDB.insert(c2);

			const res = await fetch(
				`${BASE}/api/courses/age-group/6-9 měsíců (do lezení)`,
				{
					headers: { Cookie: adminCookie },
				},
			);
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data).toHaveLength(1);
			expect(data[0].ageGroup).toBe("6-9 měsíců (do lezení)");
		});
	});
