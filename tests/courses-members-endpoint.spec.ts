import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	ParticipantDB,
	resetDatabaseForTests,
	UserDB,
} from "../src/database.js";
import { createParticipant } from "../src/participant.js";

const BASE = "http://localhost:3000";

async function loginAs(email: string, password: string): Promise<string> {
	const res = await fetch(`${BASE}/api/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});
	return res.headers.get("set-cookie") ?? "";
}

test.describe
	.serial("GET /api/courses/:courseId/participants", () => {
		let courseId: string;
		let adminCookie: string;

		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();

			await UserDB.insert({
				id: "test_participant_member",
				email: "participant@members.cz",
				passwordHash: await bcrypt.hash("pass123", 10),
				name: "Test Participant",
				role: "participant",
			});

			adminCookie = await loginAs("admin@centrumrubacek.cz", "admin123");

			const course = createCourse({
				name: "Skupinka pro testy",
				ageGroup: "1 - 2 roky",
				color: "#FF6B6B",
			});
			await CourseDB.insert(course);
			courseId = course.id;
		});

		test("returns empty array when skupinka has no members", async () => {
			const res = await fetch(`${BASE}/api/courses/${courseId}/participants`, {
				credentials: "include",
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data).toEqual([]);
		});

		test("returns members after they are linked to the skupinka", async () => {
			const p1 = createParticipant({
				name: "Adéla Nováková",
				email: "adela@test.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			const p2 = createParticipant({
				name: "Bára Svobodová",
				email: "bara@test.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(p1);
			await ParticipantDB.insert(p2);
			await ParticipantDB.linkToCourse(p1.id, courseId);
			await ParticipantDB.linkToCourse(p2.id, courseId);

			const res = await fetch(`${BASE}/api/courses/${courseId}/participants`, {
				credentials: "include",
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data).toHaveLength(2);
			const emails = data.map((p: { email: string }) => p.email);
			expect(emails).toContain("adela@test.cz");
			expect(emails).toContain("bara@test.cz");
		});

		test("reflects a newly-added member immediately", async () => {
			// Add via API
			await fetch(`${BASE}/api/courses/${courseId}/participants`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({
					name: "Nová Maminka",
					email: "nova@skupinka.cz",
					phone: "",
				}),
			});

			const res = await fetch(`${BASE}/api/courses/${courseId}/participants`, {
				credentials: "include",
				headers: { Cookie: adminCookie },
			});
			expect(res.status).toBe(200);
			const data = await res.json();
			expect(
				data.some((p: { email: string }) => p.email === "nova@skupinka.cz"),
			).toBe(true);
		});

		test("returns 401 for unauthenticated requests", async () => {
			const res = await fetch(`${BASE}/api/courses/${courseId}/participants`);
			expect(res.status).toBe(401);
		});
	});
