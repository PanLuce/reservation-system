import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	LessonDB,
	ParticipantDB,
	RegistrationDB,
	UserDB,
	initializeDatabase,
	resetDatabaseForTests,
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

test.describe.serial("My reservations — participant scope", () => {
	let p1Id: string;
	let p2Id: string;
	let cookie1: string;
	let cookie2: string;

	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();

		const course = createCourse({ name: "Moje Lekce Test", ageGroup: "1-2 years", color: "#AABBCC" });
		await CourseDB.insert(course);

		const p1 = createParticipant({ name: "Alice", email: "alice@mr.cz", phone: "", ageGroup: "1-2 years" });
		const p2 = createParticipant({ name: "Bob", email: "bob@mr.cz", phone: "", ageGroup: "1-2 years" });
		await ParticipantDB.insert(p1);
		await ParticipantDB.insert(p2);
		p1Id = p1.id;
		p2Id = p2.id;

		await UserDB.insert({ id: "user_alice", email: "alice@mr.cz", passwordHash: await bcrypt.hash("pass1", 10), name: "Alice", role: "participant", participantId: p1.id });
		await UserDB.insert({ id: "user_bob", email: "bob@mr.cz", passwordHash: await bcrypt.hash("pass2", 10), name: "Bob", role: "participant", participantId: p2.id });

		await LessonDB.insert({ id: "lesson_mr_1", title: "Lesson A", date: "2030-03-01", dayOfWeek: "Monday", time: "10:00", location: "Studio", ageGroup: "1-2 years", capacity: 10, enrolledCount: 1 }, course.id);
		await RegistrationDB.insert({ id: "reg_alice_1", lessonId: "lesson_mr_1", participantId: p1.id, status: "confirmed" });

		cookie1 = await loginAs("alice@mr.cz", "pass1");
		cookie2 = await loginAs("bob@mr.cz", "pass2");
	});

	test("participant sees only their own registrations", async () => {
		const res = await fetch(`${BASE}/api/participants/${p1Id}/registrations`, {
			headers: { Cookie: cookie1 },
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toHaveLength(1);
		expect(data[0].participantId).toBe(p1Id);
	});

	test("participant cannot access another participant's registrations", async () => {
		const res = await fetch(`${BASE}/api/participants/${p1Id}/registrations`, {
			headers: { Cookie: cookie2 },
		});
		expect(res.status).toBe(403);
	});

	test("participant can cancel their own future registration (before midnight)", async () => {
		const res = await fetch(`${BASE}/api/participants/${p1Id}/cancel-registration`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Cookie: cookie1 },
			body: JSON.stringify({ registrationId: "reg_alice_1" }),
		});
		expect(res.status).toBe(200);
	});

	test("participant cannot cancel another participant's registration", async () => {
		const res = await fetch(`${BASE}/api/participants/${p2Id}/cancel-registration`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Cookie: cookie1 },
			body: JSON.stringify({ registrationId: "reg_alice_1" }),
		});
		expect(res.status).toBe(403);
	});
});
