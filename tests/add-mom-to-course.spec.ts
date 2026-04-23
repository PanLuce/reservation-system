import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";
import {
	CourseDB,
	LessonDB,
	ParticipantDB,
	RegistrationDB,
	UserDB,
	initializeDatabase,
	resetDatabaseForTests,
} from "../src/database.js";
import { createCourse } from "../src/course.js";
import { createLesson } from "../src/lesson.js";

const BASE = "http://localhost:3000";

async function loginAs(email: string, password: string): Promise<string> {
	const res = await fetch(`${BASE}/api/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});
	return res.headers.get("set-cookie") ?? "";
}

test.describe.serial("POST /api/courses/:id/participants", () => {
	let courseId: string;
	let adminCookie: string;
	let participantCookie: string;

	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();

		// Create a participant user for role-guard tests
		await UserDB.insert({
			id: "test_participant_user",
			email: "participant@addmom.cz",
			passwordHash: await bcrypt.hash("pass123", 10),
			name: "Test Participant",
			role: "participant",
		});

		adminCookie = await loginAs("admin@centrumrubacek.cz", "admin123");
		participantCookie = await loginAs("participant@addmom.cz", "pass123");

		const course = createCourse({
			name: "Test skupinka",
			ageGroup: "1 - 2 roky",
			location: "Studio",
		});
		await CourseDB.insert(course);
		courseId = course.id;

		const today = new Date();
		for (let i = 1; i <= 2; i++) {
			const d = new Date(today);
			d.setDate(today.getDate() + i * 7);
			const lesson = createLesson({
				title: `Lekce ${i}`,
				date: d.toISOString().slice(0, 10),
				dayOfWeek: "Monday",
				time: "10:00",
				ageGroup: "1 - 2 roky",
				capacity: 10,
			});
			await LessonDB.insertWithCourse(lesson, courseId);
		}
	});

	test("creates new participant and links to course, auto-enrolls in future lessons", async () => {
		const cookie = adminCookie;
		const res = await fetch(`${BASE}/api/courses/${courseId}/participants`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Cookie: cookie },
			body: JSON.stringify({ name: "Nová Maminka", email: "nova@test.cz", phone: "777000111" }),
		});

		expect(res.status).toBe(201);
		const data = await res.json() as { participant: { id: string }; created: boolean };
		expect(data.created).toBe(true);
		expect(data.participant.id).toBeTruthy();

		// Verify participant exists
		const p = await ParticipantDB.getByEmail("nova@test.cz");
		expect(p).toBeDefined();

		// Verify linked to course
		const courses = await ParticipantDB.getCoursesForParticipant(data.participant.id);
		expect(courses.some((c) => (c as Record<string, unknown>).id === courseId)).toBe(true);

		// Verify auto-enrolled in future lessons
		const regs = await RegistrationDB.getByParticipantId(data.participant.id);
		const confirmed = regs.filter((r) => r.status === "confirmed");
		expect(confirmed).toHaveLength(2);
	});

	test("existing participant (same email) is reused — no duplicate", async () => {
		const cookie = adminCookie;

		// Add once
		await fetch(`${BASE}/api/courses/${courseId}/participants`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Cookie: cookie },
			body: JSON.stringify({ name: "Nová Maminka", email: "nova@test.cz" }),
		});

		// Add again with same email
		const res2 = await fetch(`${BASE}/api/courses/${courseId}/participants`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Cookie: cookie },
			body: JSON.stringify({ name: "Nová Maminka", email: "nova@test.cz" }),
		});

		expect(res2.status).toBe(200);
		const data2 = await res2.json() as { created: boolean };
		expect(data2.created).toBe(false);

		// No duplicate participants
		const all = await ParticipantDB.getAll();
		const matching = all.filter((p) => (p as Record<string, unknown>).email === "nova@test.cz");
		expect(matching).toHaveLength(1);
	});

	test("duplicate link (already in course) returns 200 idempotent — no duplicate registrations", async () => {
		const cookie = adminCookie;

		await fetch(`${BASE}/api/courses/${courseId}/participants`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Cookie: cookie },
			body: JSON.stringify({ name: "Nová Maminka", email: "nova@test.cz" }),
		});

		// Add same participant to same course again
		const res2 = await fetch(`${BASE}/api/courses/${courseId}/participants`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Cookie: cookie },
			body: JSON.stringify({ name: "Nová Maminka", email: "nova@test.cz" }),
		});

		expect(res2.status).toBe(200);

		// Still only 2 registrations (not 4)
		const p = await ParticipantDB.getByEmail("nova@test.cz") as Record<string, unknown>;
		const regs = await RegistrationDB.getByParticipantId(p.id as string);
		const confirmed = regs.filter((r) => r.status === "confirmed");
		expect(confirmed).toHaveLength(2);
	});

	test("participant role is blocked — returns 403", async () => {
		const cookie = participantCookie;
		const res = await fetch(`${BASE}/api/courses/${courseId}/participants`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Cookie: cookie },
			body: JSON.stringify({ name: "Hacker", email: "hack@test.cz" }),
		});
		expect(res.status).toBe(403);
	});

	test("missing email returns 400", async () => {
		const cookie = adminCookie;
		const res = await fetch(`${BASE}/api/courses/${courseId}/participants`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Cookie: cookie },
			body: JSON.stringify({ name: "Bez emailu" }),
		});
		expect(res.status).toBe(400);
	});

	test("nonexistent course returns 404", async () => {
		const cookie = adminCookie;
		const res = await fetch(`${BASE}/api/courses/does-not-exist/participants`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Cookie: cookie },
			body: JSON.stringify({ name: "Nová Maminka", email: "nova@test.cz" }),
		});
		expect(res.status).toBe(404);
	});
});
