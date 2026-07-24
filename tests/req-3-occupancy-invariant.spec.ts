import { expect, test } from "@playwright/test";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	client,
	initializeDatabase,
	LessonDB,
	ParticipantDB,
	resetDatabaseForTests,
} from "../src/database.js";
import { createLesson } from "../src/lesson.js";
import { createParticipant } from "../src/participant.js";

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

async function createLessonWithCapacity(capacity: number): Promise<string> {
	const course = createCourse({
		name: `Occupancy Test ${Math.random().toString(36).slice(2)}`,
		ageGroup: "1 - 2 roky",
	});
	await CourseDB.insert(course);

	const lesson = createLesson({
		title: "Obsazenost Lekce",
		date: "2027-09-06",
		dayOfWeek: "Monday",
		time: "10:00",
		ageGroup: "1 - 2 roky",
		capacity,
		courseId: course.id,
	});
	await LessonDB.insert(lesson);
	return lesson.id;
}

async function createUnlinkedParticipant(name: string): Promise<string> {
	const p = createParticipant({
		name,
		email: `${name.toLowerCase()}-${Math.random().toString(36).slice(2)}@t.cz`,
		phone: "",
		ageGroup: "1 - 2 roky",
	});
	await ParticipantDB.insert(p);
	return p.id;
}

async function registerParticipant(
	cookie: string,
	lessonId: string,
	participantId: string,
): Promise<{ status: string; registrationId: string }> {
	const res = await fetch(`${BASE}/api/admin/register-participant`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Cookie: cookie },
		body: JSON.stringify({ lessonId, participantId }),
	});
	const data = (await res.json()) as {
		registration: { id: string; status: string };
	};
	return {
		status: data.registration.status,
		registrationId: data.registration.id,
	};
}

async function deleteParticipantDirectly(participantId: string): Promise<void> {
	// Simulates any cascade-triggering deletion of a participant (there is no
	// admin "delete participant" endpoint yet, but registrations.participantId
	// is ON DELETE CASCADE, so this is a reachable future/manual-admin path).
	await client.execute({
		sql: "DELETE FROM participants WHERE id = ?",
		args: [participantId],
	});
}

async function fetchLesson(
	lessonId: string,
): Promise<{ enrolledCount: number; capacity: number }> {
	const res = await fetch(`${BASE}/api/lessons/${lessonId}`);
	return res.json();
}

async function fetchLessonParticipants(
	cookie: string,
	lessonId: string,
): Promise<Array<{ id: string; name: string }>> {
	const res = await fetch(`${BASE}/api/lessons/${lessonId}/participants`, {
		headers: { Cookie: cookie },
	});
	return res.json();
}

test.describe
	.serial("REQ-3: Lesson occupancy is derived from confirmed registrations", () => {
		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();
		});

		test("enrolledCount counts confirmed registrations, not waitlisted ones", async () => {
			const cookie = await loginAsAdmin();
			const lessonId = await createLessonWithCapacity(2);
			const alena = await createUnlinkedParticipant("Alena");
			const bedrich = await createUnlinkedParticipant("Bedrich");
			const cyril = await createUnlinkedParticipant("Cyril");

			await registerParticipant(cookie, lessonId, alena);
			await registerParticipant(cookie, lessonId, bedrich);
			const regC = await registerParticipant(cookie, lessonId, cyril);
			expect(regC.status).toBe("waitlist");

			const lesson = await fetchLesson(lessonId);
			expect(lesson.enrolledCount).toBe(2);
		});

		test("enrolledCount and the participant list stay in lockstep after a participant row is deleted", async () => {
			const cookie = await loginAsAdmin();
			const lessonId = await createLessonWithCapacity(3);
			const alena = await createUnlinkedParticipant("Alena");
			const bedrich = await createUnlinkedParticipant("Bedrich");

			await registerParticipant(cookie, lessonId, alena);
			await registerParticipant(cookie, lessonId, bedrich);

			await deleteParticipantDirectly(alena);

			const lesson = await fetchLesson(lessonId);
			const participants = await fetchLessonParticipants(cookie, lessonId);

			expect(lesson.enrolledCount).toBe(1);
			expect(participants).toHaveLength(1);
			expect(participants[0]?.name).toBe("Bedrich");
		});

		test("a seat freed by deleting a participant directly is immediately available to a new registration", async () => {
			const cookie = await loginAsAdmin();
			const lessonId = await createLessonWithCapacity(1);
			const alena = await createUnlinkedParticipant("Alena");
			const bedrich = await createUnlinkedParticipant("Bedrich");

			const regA = await registerParticipant(cookie, lessonId, alena);
			expect(regA.status).toBe("confirmed");

			await deleteParticipantDirectly(alena);

			const regB = await registerParticipant(cookie, lessonId, bedrich);
			expect(regB.status).toBe("confirmed");

			const lesson = await fetchLesson(lessonId);
			expect(lesson.enrolledCount).toBe(1);
		});

		test("the lesson detail list shows only confirmed participants, matching enrolledCount", async () => {
			const cookie = await loginAsAdmin();
			const lessonId = await createLessonWithCapacity(1);
			const alena = await createUnlinkedParticipant("Alena");
			const bedrich = await createUnlinkedParticipant("Bedrich");

			await registerParticipant(cookie, lessonId, alena);
			const regB = await registerParticipant(cookie, lessonId, bedrich);
			expect(regB.status).toBe("waitlist");

			const lesson = await fetchLesson(lessonId);
			const participants = await fetchLessonParticipants(cookie, lessonId);

			expect(participants).toHaveLength(lesson.enrolledCount);
			expect(participants.map((p) => p.name)).toEqual(["Alena"]);
		});
	});
