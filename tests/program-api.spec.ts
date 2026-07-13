import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	ProgramDB,
	resetDatabaseForTests,
	UserDB,
} from "../src/database.js";
import { createProgram } from "../src/program.js";

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
	return { cookie: res.headers.get("set-cookie") ?? "" };
}

test.describe
	.serial("Program API — CRUD", () => {
		let adminCookie: string;
		let participantCookie: string;

		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();

			await UserDB.insert({
				id: "participant_test",
				email: "participant@example.com",
				passwordHash: await bcrypt.hash("pass123", 10),
				name: "Participant",
				role: "participant",
			});

			adminCookie = (await loginAs("admin@centrumrubacek.cz", "admin123"))
				.cookie;
			participantCookie = (await loginAs("participant@example.com", "pass123"))
				.cookie;
		});

		test("GET /api/programs returns empty array when none exist", async () => {
			const res = await fetch(`${BASE}/api/programs`, {
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data).toHaveLength(0);
		});

		test("GET /api/programs returns all programs", async () => {
			await ProgramDB.insert(
				createProgram({ name: "Alfa", ageGroup: "1 - 2 roky" }),
			);
			await ProgramDB.insert(
				createProgram({ name: "Beta", ageGroup: "1 - 2 roky" }),
			);

			const res = await fetch(`${BASE}/api/programs`, {
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data).toHaveLength(2);
		});

		test("GET /api/programs/:id returns a single program", async () => {
			const program = createProgram({ name: "Solo", ageGroup: "1 - 2 roky" });
			await ProgramDB.insert(program);

			const res = await fetch(`${BASE}/api/programs/${program.id}`, {
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.name).toBe("Solo");
		});

		test("GET /api/programs/:id returns 404 for unknown id", async () => {
			const res = await fetch(`${BASE}/api/programs/nope`, {
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(404);
		});

		test("POST /api/programs creates a program (admin)", async () => {
			const res = await fetch(`${BASE}/api/programs`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({
					name: "Nový kurz",
					ageGroup: "1 - 2 roky",
				}),
			});
			expect(res.status).toBe(201);
			const data = await res.json();
			expect(data.id).toMatch(/^program_/);
			expect(data.name).toBe("Nový kurz");
			expect(data.color).toMatch(/^#/);
		});

		test("POST /api/programs returns 400 for an empty name", async () => {
			const res = await fetch(`${BASE}/api/programs`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({ name: "", ageGroup: "1 - 2 roky" }),
			});
			expect(res.status).toBe(400);
		});

		test("POST /api/programs returns 400 for an invalid age group", async () => {
			const res = await fetch(`${BASE}/api/programs`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({ name: "X", ageGroup: "not-a-real-age" }),
			});
			expect(res.status).toBe(400);
		});

		test("POST /api/programs returns 403 for a participant", async () => {
			const res = await fetch(`${BASE}/api/programs`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: participantCookie,
				},
				body: JSON.stringify({ name: "Nope", ageGroup: "1 - 2 roky" }),
			});
			expect(res.status).toBe(403);
		});

		test("PUT /api/programs/:id updates a program (admin)", async () => {
			const program = createProgram({ name: "Před", ageGroup: "1 - 2 roky" });
			await ProgramDB.insert(program);

			const res = await fetch(`${BASE}/api/programs/${program.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({ name: "Po" }),
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.name).toBe("Po");
		});

		test("PUT /api/programs/:id returns 404 for unknown id", async () => {
			const res = await fetch(`${BASE}/api/programs/nope`, {
				method: "PUT",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({ name: "X" }),
			});
			expect(res.status).toBe(404);
		});

		test("DELETE /api/programs/:id deletes a program (admin)", async () => {
			const program = createProgram({ name: "Smazat", ageGroup: "1 - 2 roky" });
			await ProgramDB.insert(program);

			const res = await fetch(`${BASE}/api/programs/${program.id}`, {
				method: "DELETE",
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(200);

			const check = await fetch(`${BASE}/api/programs/${program.id}`, {
				headers: { Cookie: adminCookie },
			});
			expect(check.status).toBe(404);
		});

		test("DELETE /api/programs/:id returns 403 for a participant", async () => {
			const program = createProgram({
				name: "Chráněný",
				ageGroup: "1 - 2 roky",
			});
			await ProgramDB.insert(program);

			const res = await fetch(`${BASE}/api/programs/${program.id}`, {
				method: "DELETE",
				headers: { Cookie: participantCookie },
			});
			expect(res.status).toBe(403);
		});

		test("POST /api/courses accepts a programId and links the course", async () => {
			const program = createProgram({ name: "Rodič", ageGroup: "1 - 2 roky" });
			await ProgramDB.insert(program);

			const res = await fetch(`${BASE}/api/courses`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({
					name: "Skupinka v kurzu",
					ageGroup: "1 - 2 roky",
					location: "Studio",
					programId: program.id,
				}),
			});
			expect(res.status).toBe(201);

			const linked = await CourseDB.getByProgram(program.id);
			expect(linked).toHaveLength(1);
		});

		test("PUT /api/courses/:id can reassign a course's programId", async () => {
			const program = createProgram({ name: "Cíl", ageGroup: "1 - 2 roky" });
			await ProgramDB.insert(program);
			const course = createCourse({
				name: "Přesouvaná",
				ageGroup: "1 - 2 roky",
			});
			await CourseDB.insert(course);

			const res = await fetch(`${BASE}/api/courses/${course.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({ programId: program.id }),
			});
			expect(res.status).toBe(200);

			const linked = await CourseDB.getByProgram(program.id);
			expect(linked).toHaveLength(1);
			expect(linked[0]?.id).toBe(course.id);
		});

		test("PUT /api/courses/:id with programId null un-assigns the course", async () => {
			const program = createProgram({
				name: "Odebrat",
				ageGroup: "1 - 2 roky",
			});
			await ProgramDB.insert(program);
			const course = createCourse({
				name: "Osamostatnělá",
				ageGroup: "1 - 2 roky",
				programId: program.id,
			});
			await CourseDB.insert(course);

			const res = await fetch(`${BASE}/api/courses/${course.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({ programId: null }),
			});
			expect(res.status).toBe(200);

			const retrieved = await CourseDB.getById(course.id);
			expect(retrieved?.programId).toBeNull();
			expect(await CourseDB.getByProgram(program.id)).toHaveLength(0);
		});
	});
