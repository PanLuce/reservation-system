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

async function cancelAndGetCredit(
	participantId: string,
	registrationId: string,
	cookie: string,
): Promise<{ id: string; expiresAt: string }> {
	await fetch(`${BASE}/api/participants/${participantId}/cancel-registration`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Cookie: cookie },
		body: JSON.stringify({ registrationId }),
	});
	const data = await (
		await fetch(`${BASE}/api/participants/${participantId}/credits`, {
			headers: { Cookie: cookie },
		})
	).json();
	return data.credits[0];
}

test.describe
	.serial("Credit admin validity", () => {
		let participantId: string;
		let participantCookie: string;
		let adminCookie: string;

		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();

			const course = createCourse({
				name: "Validity Test",
				ageGroup: "1 - 2 roky",
				color: "#CCDDEE",
			});
			await CourseDB.insert(course);

			const p = createParticipant({
				name: "Grace",
				email: "grace@validity.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(p);
			participantId = p.id;
			await ParticipantDB.linkToCourse(participantId, course.id);

			await LessonDB.insert(
				{
					id: "lesson_validity_1",
					title: "Validity Lesson",
					date: "2030-07-01",
					dayOfWeek: "Tuesday",
					time: "10:00",
					location: "Studio",
					ageGroup: "1 - 2 roky",
					capacity: 10,
					enrolledCount: 1,
				},
				course.id,
			);
			await RegistrationDB.insert({
				id: "reg_validity_1",
				lessonId: "lesson_validity_1",
				participantId,
				status: "confirmed",
			});

			await UserDB.insert({
				id: "user_grace",
				email: "grace@validity.cz",
				passwordHash: await bcrypt.hash("pass", 10),
				name: "Grace",
				role: "participant",
				participantId,
			});

			adminCookie = await loginAs("admin@centrumrubacek.cz", "admin123");
			participantCookie = await loginAs("grace@validity.cz", "pass");
		});

		test("admin can extend credit validity", async () => {
			const credit = await cancelAndGetCredit(
				participantId,
				"reg_validity_1",
				participantCookie,
			);

			const newExpiry = "2031-01-01T00:00:00.000Z";
			const res = await fetch(
				`${BASE}/api/admin/participants/${participantId}/credits/${credit.id}/extend`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json", Cookie: adminCookie },
					body: JSON.stringify({ newExpiresAt: newExpiry }),
				},
			);
			expect(res.status).toBe(200);

			const data = await (
				await fetch(`${BASE}/api/participants/${participantId}/credits`, {
					headers: { Cookie: adminCookie },
				})
			).json();
			expect(data.credits[0].expiresAt).toBe(newExpiry);
		});

		test("admin can shorten credit validity", async () => {
			const credit = await cancelAndGetCredit(
				participantId,
				"reg_validity_1",
				participantCookie,
			);

			const newExpiry = "2026-06-01T00:00:00.000Z";
			const res = await fetch(
				`${BASE}/api/admin/participants/${participantId}/credits/${credit.id}/shorten`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json", Cookie: adminCookie },
					body: JSON.stringify({ newExpiresAt: newExpiry }),
				},
			);
			expect(res.status).toBe(200);

			const data = await (
				await fetch(`${BASE}/api/participants/${participantId}/credits`, {
					headers: { Cookie: adminCookie },
				})
			).json();
			expect(data.credits[0].expiresAt).toBe(newExpiry);
		});

		test("participant cannot access admin credit endpoints", async () => {
			const credit = await cancelAndGetCredit(
				participantId,
				"reg_validity_1",
				participantCookie,
			);

			const res = await fetch(
				`${BASE}/api/admin/participants/${participantId}/credits/${credit.id}/extend`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Cookie: participantCookie,
					},
					body: JSON.stringify({ newExpiresAt: "2031-01-01T00:00:00.000Z" }),
				},
			);
			expect(res.status).toBe(403);
		});
	});
