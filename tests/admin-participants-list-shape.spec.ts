import { expect, test } from "@playwright/test";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	LessonDB,
	ParticipantDB,
	resetDatabaseForTests,
} from "../src/database.js";
import { createLesson } from "../src/lesson.js";
import { createParticipant } from "../src/participant.js";
import { RegistrationManagerDB } from "../src/registration-db.js";

import { BASE } from "./helpers/base.js";

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

test.describe("GET /api/admin/participants — batched course summaries", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("returns each participant with their courses and correct remaining-lesson counts", async () => {
		const courseA = createCourse({
			name: "Skupinka A",
			ageGroup: "1 - 2 roky",
		});
		const courseB = createCourse({
			name: "Skupinka B",
			ageGroup: "1 - 2 roky",
		});
		await CourseDB.insert(courseA);
		await CourseDB.insert(courseB);

		const participant = createParticipant({
			name: "Testovací Dítě",
			email: "dite@test.cz",
			phone: "",
			ageGroup: "1 - 2 roky",
		});
		await ParticipantDB.insert(participant);
		await ParticipantDB.linkToCourse(participant.id, courseA.id);
		await ParticipantDB.linkToCourse(participant.id, courseB.id);

		const today = new Date();
		const rm = new RegistrationManagerDB();

		// 2 future lessons in courseA, participant registered on both
		for (let i = 1; i <= 2; i++) {
			const d = new Date(today);
			d.setDate(today.getDate() + i * 7);
			const lesson = createLesson({
				title: `A Lekce ${i}`,
				date: d.toISOString().slice(0, 10),
				dayOfWeek: "Monday",
				time: "10:00",
				ageGroup: "1 - 2 roky",
				capacity: 10,
			});
			await LessonDB.insertWithCourse(lesson, courseA.id);
			await rm.registerParticipant(lesson.id, participant);
		}

		// 1 future lesson in courseB, participant NOT registered
		const dB = new Date(today);
		dB.setDate(today.getDate() + 7);
		const lessonB = createLesson({
			title: "B Lekce 1",
			date: dB.toISOString().slice(0, 10),
			dayOfWeek: "Monday",
			time: "11:00",
			ageGroup: "1 - 2 roky",
			capacity: 10,
		});
		await LessonDB.insertWithCourse(lessonB, courseB.id);

		const adminCookie = await loginAsAdmin();
		const res = await fetch(`${BASE}/api/admin/participants`, {
			headers: { Cookie: adminCookie },
		});
		expect(res.status).toBe(200);
		const data = await res.json();

		expect(data).toHaveLength(1);
		const p = data[0];
		expect(p.id).toBe(participant.id);
		expect(p.name).toBe("Testovací Dítě");
		expect(p.email).toBe("dite@test.cz");
		expect(p.courses).toHaveLength(2);

		const cA = p.courses.find((c: { id: string }) => c.id === courseA.id);
		const cB = p.courses.find((c: { id: string }) => c.id === courseB.id);
		expect(cA).toBeDefined();
		expect(cA.remainingLessons).toBe(2);
		expect(cB).toBeDefined();
		expect(cB.remainingLessons).toBe(0);
	});

	test("returns an empty courses array for a participant linked to no course", async () => {
		const participant = createParticipant({
			name: "Bez Skupinky",
			email: "solo@test.cz",
			phone: "",
			ageGroup: "1 - 2 roky",
		});
		await ParticipantDB.insert(participant);

		const adminCookie = await loginAsAdmin();
		const res = await fetch(`${BASE}/api/admin/participants`, {
			headers: { Cookie: adminCookie },
		});
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data).toHaveLength(1);
		expect(data[0].courses).toEqual([]);
	});

	test("returns 401 for unauthenticated requests", async () => {
		const res = await fetch(`${BASE}/api/admin/participants`);
		expect(res.status).toBe(401);
	});
});
