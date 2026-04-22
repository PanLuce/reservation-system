import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	LessonDB,
	ParticipantDB,
	RegistrationDB,
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

test.describe.serial("Substitution candidates — ageGroup filter", () => {
	let pId: string;
	let cookie: string;

	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();

		// Participant's own course: 1-2 years, color A
		const ownCourse = createCourse({
			name: "1-2 roky, Vietnamská",
			ageGroup: "1-2 years",
			color: "#FF0000",
		});
		// Sister course: same ageGroup, different color — SHOULD appear
		const sisterCourse = createCourse({
			name: "1-2 roky, Poklad",
			ageGroup: "1-2 years",
			color: "#00FF00",
		});
		// Different ageGroup course — MUST NOT appear
		const wrongAgeCourse = createCourse({
			name: "2-3 roky, Vietnamská",
			ageGroup: "2-3 years",
			color: "#FF0000", // same color as ownCourse — proves filter is ageGroup not color
		});

		await CourseDB.insert(ownCourse);
		await CourseDB.insert(sisterCourse);
		await CourseDB.insert(wrongAgeCourse);

		const p = createParticipant({
			name: "Maminka",
			email: "agefilter@t.cz",
			phone: "",
			ageGroup: "1-2 years",
		});
		await ParticipantDB.insert(p);
		pId = p.id;
		await ParticipantDB.linkToCourse(pId, ownCourse.id);

		await UserDB.insert({
			id: "user_agefilter",
			email: "agefilter@t.cz",
			passwordHash: await bcrypt.hash("pass", 10),
			name: "Maminka",
			role: "participant",
			participantId: pId,
		});

		// Lesson on sister course (same ageGroup, different color) — SHOULD appear
		await LessonDB.insert(
			{
				id: "lesson_sister",
				title: "Sister Lesson",
				date: "2030-09-01",
				dayOfWeek: "Monday",
				time: "10:00",
				location: "Studio",
				ageGroup: "1-2 years",
				capacity: 10,
				enrolledCount: 0,
			},
			sisterCourse.id,
		);

		// Lesson on wrong-age course (same color, different ageGroup) — MUST NOT appear
		await LessonDB.insert(
			{
				id: "lesson_wrongage",
				title: "Wrong Age Lesson",
				date: "2030-09-01",
				dayOfWeek: "Monday",
				time: "11:00",
				location: "Studio",
				ageGroup: "2-3 years",
				capacity: 10,
				enrolledCount: 0,
			},
			wrongAgeCourse.id,
		);

		// Full lesson on sister course — MUST NOT appear
		await LessonDB.insert(
			{
				id: "lesson_sister_full",
				title: "Full Sister",
				date: "2030-09-08",
				dayOfWeek: "Monday",
				time: "10:00",
				location: "Studio",
				ageGroup: "1-2 years",
				capacity: 2,
				enrolledCount: 2,
			},
			sisterCourse.id,
		);

		// Past lesson on sister course — MUST NOT appear
		await LessonDB.insert(
			{
				id: "lesson_sister_past",
				title: "Past Sister",
				date: "2020-01-01",
				dayOfWeek: "Wednesday",
				time: "10:00",
				location: "Studio",
				ageGroup: "1-2 years",
				capacity: 10,
				enrolledCount: 0,
			},
			sisterCourse.id,
		);

		// Lesson on own course — MUST NOT appear
		await LessonDB.insert(
			{
				id: "lesson_own",
				title: "Own Lesson",
				date: "2030-09-01",
				dayOfWeek: "Monday",
				time: "09:00",
				location: "Studio",
				ageGroup: "1-2 years",
				capacity: 10,
				enrolledCount: 1,
			},
			ownCourse.id,
		);
		await RegistrationDB.insert({
			id: "reg_own",
			lessonId: "lesson_own",
			participantId: pId,
			status: "confirmed",
		});

		cookie = await loginAs("agefilter@t.cz", "pass");
	});

	test("shows future available lessons from same-ageGroup courses the participant is NOT on", async () => {
		const res = await fetch(
			`${BASE}/api/participants/${pId}/substitution-candidates`,
			{ headers: { Cookie: cookie } },
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		const ids = data.map((l: { id: string }) => l.id);

		expect(ids).toContain("lesson_sister");
	});

	test("does not show lessons from different-ageGroup courses even when color matches", async () => {
		const res = await fetch(
			`${BASE}/api/participants/${pId}/substitution-candidates`,
			{ headers: { Cookie: cookie } },
		);
		const data = await res.json();
		const ids = data.map((l: { id: string }) => l.id);

		expect(ids).not.toContain("lesson_wrongage");
	});

	test("does not show full lessons", async () => {
		const res = await fetch(
			`${BASE}/api/participants/${pId}/substitution-candidates`,
			{ headers: { Cookie: cookie } },
		);
		const data = await res.json();
		const ids = data.map((l: { id: string }) => l.id);

		expect(ids).not.toContain("lesson_sister_full");
	});

	test("does not show past lessons", async () => {
		const res = await fetch(
			`${BASE}/api/participants/${pId}/substitution-candidates`,
			{ headers: { Cookie: cookie } },
		);
		const data = await res.json();
		const ids = data.map((l: { id: string }) => l.id);

		expect(ids).not.toContain("lesson_sister_past");
	});

	test("does not show lessons the participant is already registered on", async () => {
		const res = await fetch(
			`${BASE}/api/participants/${pId}/substitution-candidates`,
			{ headers: { Cookie: cookie } },
		);
		const data = await res.json();
		const ids = data.map((l: { id: string }) => l.id);

		expect(ids).not.toContain("lesson_own");
	});

	test("participant A cannot access participant B substitution candidates", async () => {
		const p2 = createParticipant({
			name: "Outsider",
			email: "outsider@t.cz",
			phone: "",
			ageGroup: "1-2 years",
		});
		await ParticipantDB.insert(p2);
		await UserDB.insert({
			id: "user_outsider",
			email: "outsider@t.cz",
			passwordHash: await bcrypt.hash("pass2", 10),
			name: "Outsider",
			role: "participant",
			participantId: p2.id,
		});
		const cookie2 = await loginAs("outsider@t.cz", "pass2");

		const res = await fetch(
			`${BASE}/api/participants/${pId}/substitution-candidates`,
			{ headers: { Cookie: cookie2 } },
		);
		expect(res.status).toBe(403);
	});
});
