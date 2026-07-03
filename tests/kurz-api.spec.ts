import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	KurzDB,
	resetDatabaseForTests,
	UserDB,
} from "../src/database.js";
import { createKurz } from "../src/kurz.js";

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
	.serial("Kurz API — CRUD", () => {
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

		test("GET /api/kurzy returns empty array when none exist", async () => {
			const res = await fetch(`${BASE}/api/kurzy`, {
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(Array.isArray(data)).toBe(true);
			expect(data).toHaveLength(0);
		});

		test("GET /api/kurzy returns all kurzy", async () => {
			await KurzDB.insert(createKurz({ name: "Alfa", ageGroup: "1 - 2 roky" }));
			await KurzDB.insert(createKurz({ name: "Beta", ageGroup: "1 - 2 roky" }));

			const res = await fetch(`${BASE}/api/kurzy`, {
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data).toHaveLength(2);
		});

		test("GET /api/kurzy/:id returns a single kurz", async () => {
			const kurz = createKurz({ name: "Solo", ageGroup: "1 - 2 roky" });
			await KurzDB.insert(kurz);

			const res = await fetch(`${BASE}/api/kurzy/${kurz.id}`, {
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.name).toBe("Solo");
		});

		test("GET /api/kurzy/:id returns 404 for unknown id", async () => {
			const res = await fetch(`${BASE}/api/kurzy/nope`, {
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(404);
		});

		test("POST /api/kurzy creates a kurz (admin)", async () => {
			const res = await fetch(`${BASE}/api/kurzy`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({
					name: "Nový kurz",
					ageGroup: "1 - 2 roky",
				}),
			});
			expect(res.status).toBe(201);
			const data = await res.json();
			expect(data.id).toMatch(/^kurz_/);
			expect(data.name).toBe("Nový kurz");
			expect(data.color).toMatch(/^#/);
		});

		test("POST /api/kurzy returns 400 for an empty name", async () => {
			const res = await fetch(`${BASE}/api/kurzy`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({ name: "", ageGroup: "1 - 2 roky" }),
			});
			expect(res.status).toBe(400);
		});

		test("POST /api/kurzy returns 400 for an invalid age group", async () => {
			const res = await fetch(`${BASE}/api/kurzy`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({ name: "X", ageGroup: "not-a-real-age" }),
			});
			expect(res.status).toBe(400);
		});

		test("POST /api/kurzy returns 403 for a participant", async () => {
			const res = await fetch(`${BASE}/api/kurzy`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: participantCookie,
				},
				body: JSON.stringify({ name: "Nope", ageGroup: "1 - 2 roky" }),
			});
			expect(res.status).toBe(403);
		});

		test("PUT /api/kurzy/:id updates a kurz (admin)", async () => {
			const kurz = createKurz({ name: "Před", ageGroup: "1 - 2 roky" });
			await KurzDB.insert(kurz);

			const res = await fetch(`${BASE}/api/kurzy/${kurz.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({ name: "Po" }),
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.name).toBe("Po");
		});

		test("PUT /api/kurzy/:id returns 404 for unknown id", async () => {
			const res = await fetch(`${BASE}/api/kurzy/nope`, {
				method: "PUT",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({ name: "X" }),
			});
			expect(res.status).toBe(404);
		});

		test("DELETE /api/kurzy/:id deletes a kurz (admin)", async () => {
			const kurz = createKurz({ name: "Smazat", ageGroup: "1 - 2 roky" });
			await KurzDB.insert(kurz);

			const res = await fetch(`${BASE}/api/kurzy/${kurz.id}`, {
				method: "DELETE",
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(200);

			const check = await fetch(`${BASE}/api/kurzy/${kurz.id}`, {
				headers: { Cookie: adminCookie },
			});
			expect(check.status).toBe(404);
		});

		test("DELETE /api/kurzy/:id returns 403 for a participant", async () => {
			const kurz = createKurz({ name: "Chráněný", ageGroup: "1 - 2 roky" });
			await KurzDB.insert(kurz);

			const res = await fetch(`${BASE}/api/kurzy/${kurz.id}`, {
				method: "DELETE",
				headers: { Cookie: participantCookie },
			});
			expect(res.status).toBe(403);
		});

		test("POST /api/courses accepts a kurzId and links the course", async () => {
			const kurz = createKurz({ name: "Rodič", ageGroup: "1 - 2 roky" });
			await KurzDB.insert(kurz);

			const res = await fetch(`${BASE}/api/courses`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({
					name: "Skupinka v kurzu",
					ageGroup: "1 - 2 roky",
					location: "Studio",
					kurzId: kurz.id,
				}),
			});
			expect(res.status).toBe(201);

			const linked = await CourseDB.getByKurz(kurz.id);
			expect(linked).toHaveLength(1);
		});

		test("PUT /api/courses/:id can reassign a course's kurzId", async () => {
			const kurz = createKurz({ name: "Cíl", ageGroup: "1 - 2 roky" });
			await KurzDB.insert(kurz);
			const course = createCourse({
				name: "Přesouvaná",
				ageGroup: "1 - 2 roky",
			});
			await CourseDB.insert(course);

			const res = await fetch(`${BASE}/api/courses/${course.id}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({ kurzId: kurz.id }),
			});
			expect(res.status).toBe(200);

			const linked = await CourseDB.getByKurz(kurz.id);
			expect(linked).toHaveLength(1);
			expect(linked[0]?.id).toBe(course.id);
		});
	});
