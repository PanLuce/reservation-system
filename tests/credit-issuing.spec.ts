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

test.describe
	.serial("Credit issuing", () => {
		let participantId: string;
		let participantCookie: string;
		let adminCookie: string;

		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();

			const course = createCourse({
				name: "Credit Test",
				ageGroup: "1-2 years",
				color: "#AABBCC",
			});
			await CourseDB.insert(course);

			const p = createParticipant({
				name: "Eve",
				email: "eve@credit.cz",
				phone: "",
				ageGroup: "1-2 years",
			});
			await ParticipantDB.insert(p);
			participantId = p.id;
			await ParticipantDB.linkToCourse(participantId, course.id);

			await LessonDB.insert(
				{
					id: "lesson_credit_1",
					title: "Credit Lesson",
					date: "2030-05-01",
					dayOfWeek: "Thursday",
					time: "10:00",
					location: "Studio",
					ageGroup: "1-2 years",
					capacity: 10,
					enrolledCount: 1,
				},
				course.id,
			);

			await LessonDB.insert(
				{
					id: "lesson_credit_2",
					title: "Late Lesson",
					date: "2030-12-31",
					dayOfWeek: "Monday",
					time: "10:00",
					location: "Studio",
					ageGroup: "1-2 years",
					capacity: 10,
					enrolledCount: 0,
				},
				course.id,
			);

			await RegistrationDB.insert({
				id: "reg_credit_1",
				lessonId: "lesson_credit_1",
				participantId,
				status: "confirmed",
			});

			await UserDB.insert({
				id: "user_eve_credit",
				email: "eve@credit.cz",
				passwordHash: await bcrypt.hash("pass", 10),
				name: "Eve",
				role: "participant",
				participantId,
			});

			adminCookie = await loginAs("admin@centrumrubacek.cz", "admin123");
			participantCookie = await loginAs("eve@credit.cz", "pass");
		});

		test("self-cancel before cutoff issues one credit", async () => {
			const cancelRes = await fetch(
				`${BASE}/api/participants/${participantId}/cancel-registration`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Cookie: participantCookie,
					},
					body: JSON.stringify({ registrationId: "reg_credit_1" }),
				},
			);
			expect(cancelRes.status).toBe(200);

			const creditsRes = await fetch(
				`${BASE}/api/participants/${participantId}/credits`,
				{ headers: { Cookie: participantCookie } },
			);
			expect(creditsRes.status).toBe(200);
			const data = await creditsRes.json();
			expect(data.count).toBe(1);
			expect(data.credits).toHaveLength(1);
			expect(data.credits[0].participantId).toBe(participantId);
		});

		test("credit expiresAt is at most 3 months from now", async () => {
			await fetch(
				`${BASE}/api/participants/${participantId}/cancel-registration`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Cookie: participantCookie,
					},
					body: JSON.stringify({ registrationId: "reg_credit_1" }),
				},
			);

			const data = await (
				await fetch(`${BASE}/api/participants/${participantId}/credits`, {
					headers: { Cookie: participantCookie },
				})
			).json();

			const expiresAt = new Date(data.credits[0].expiresAt);
			const maxAllowed = new Date();
			maxAllowed.setMonth(maxAllowed.getMonth() + 3);
			maxAllowed.setDate(maxAllowed.getDate() + 1); // 1-day buffer for test timing

			expect(expiresAt <= maxAllowed).toBe(true);
		});

		test("admin cancel with excused=true issues credit", async () => {
			const cancelRes = await fetch(`${BASE}/api/admin/cancel-registration`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({
					registrationId: "reg_credit_1",
					excused: true,
				}),
			});
			expect(cancelRes.status).toBe(200);

			const data = await (
				await fetch(`${BASE}/api/participants/${participantId}/credits`, {
					headers: { Cookie: adminCookie },
				})
			).json();
			expect(data.count).toBe(1);
		});

		test("admin cancel without excused=true does not issue credit", async () => {
			await fetch(`${BASE}/api/admin/cancel-registration`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({ registrationId: "reg_credit_1" }),
			});

			const data = await (
				await fetch(`${BASE}/api/participants/${participantId}/credits`, {
					headers: { Cookie: adminCookie },
				})
			).json();
			expect(data.count).toBe(0);
		});
	});
