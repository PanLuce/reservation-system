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
	.serial("Self-service midnight cutoff", () => {
		let adminCookie: string;
		let participantCookie: string;
		let participantId: string;

		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();

			const p = createParticipant({
				name: "Eve",
				email: "eve@t.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(p);
			participantId = p.id;

			await UserDB.insert({
				id: "user_eve",
				email: "eve@t.cz",
				passwordHash: await bcrypt.hash("pass123", 10),
				name: "Eve",
				role: "participant",
				participantId: p.id,
			});

			adminCookie = await loginAs("admin@centrumrubacek.cz", "admin123");
			participantCookie = await loginAs("eve@t.cz", "pass123");
		});

		test("participant can cancel a registration for a lesson in the future (before midnight)", async () => {
			const course = createCourse({
				name: "Cutoff Test",
				ageGroup: "1 - 2 roky",
				color: "#123456",
			});
			await CourseDB.insert(course);

			// Lesson far in the future — well before midnight cutoff
			await LessonDB.insert(
				{
					id: "lesson_future",
					title: "Future Lesson",
					date: "2030-01-15",
					dayOfWeek: "Monday",
					time: "10:00",
					location: "Studio",
					ageGroup: "1 - 2 roky",
					capacity: 10,
					enrolledCount: 1,
				},
				course.id,
			);

			const reg = {
				id: "reg_future",
				lessonId: "lesson_future",
				participantId,
				status: "confirmed",
			};
			await RegistrationDB.insert(reg);

			const res = await fetch(
				`${BASE}/api/participants/${participantId}/cancel-registration`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Cookie: participantCookie,
					},
					body: JSON.stringify({ registrationId: "reg_future" }),
				},
			);
			expect(res.status).toBe(200);
		});

		test("participant cannot cancel a registration for a lesson that starts today or in the past", async () => {
			const course = createCourse({
				name: "Past Cutoff Test",
				ageGroup: "1 - 2 roky",
				color: "#654321",
			});
			await CourseDB.insert(course);

			// Lesson TODAY — past midnight cutoff
			const today = new Date();
			const todayStr = today.toISOString().slice(0, 10);

			await LessonDB.insert(
				{
					id: "lesson_today",
					title: "Today Lesson",
					date: todayStr,
					dayOfWeek: "Monday",
					time: "10:00",
					location: "Studio",
					ageGroup: "1 - 2 roky",
					capacity: 10,
					enrolledCount: 1,
				},
				course.id,
			);

			const reg = {
				id: "reg_today",
				lessonId: "lesson_today",
				participantId,
				status: "confirmed",
			};
			await RegistrationDB.insert(reg);

			const res = await fetch(
				`${BASE}/api/participants/${participantId}/cancel-registration`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Cookie: participantCookie,
					},
					body: JSON.stringify({ registrationId: "reg_today" }),
				},
			);
			expect(res.status).toBe(403);
		});

		test("admin can cancel a registration regardless of the lesson date", async () => {
			const course = createCourse({
				name: "Admin Override Cutoff",
				ageGroup: "1 - 2 roky",
				color: "#ABCDEF",
			});
			await CourseDB.insert(course);

			const today = new Date();
			const todayStr = today.toISOString().slice(0, 10);

			await LessonDB.insert(
				{
					id: "lesson_admin_override",
					title: "Today Admin Lesson",
					date: todayStr,
					dayOfWeek: "Monday",
					time: "10:00",
					location: "Studio",
					ageGroup: "1 - 2 roky",
					capacity: 10,
					enrolledCount: 1,
				},
				course.id,
			);

			const reg = {
				id: "reg_admin_override",
				lessonId: "lesson_admin_override",
				participantId,
				status: "confirmed",
			};
			await RegistrationDB.insert(reg);

			const res = await fetch(`${BASE}/api/admin/cancel-registration`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({
					registrationId: "reg_admin_override",
					participantId,
				}),
			});
			expect(res.status).toBe(200);
		});
	});
