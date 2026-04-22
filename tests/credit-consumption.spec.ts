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
	.serial("Credit consumption", () => {
		let participantId: string;
		let participantCookie: string;
		let substitutionLessonId: string;

		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();

			const course = createCourse({
				name: "Consume Test Course",
				ageGroup: "1-2 years",
				color: "#112233",
			});
			await CourseDB.insert(course);

			const courseB = createCourse({
				name: "Consume Test Course B",
				ageGroup: "1-2 years",
				color: "#112233", // same color
			});
			await CourseDB.insert(courseB);

			const p = createParticipant({
				name: "Frank",
				email: "frank@consume.cz",
				phone: "",
				ageGroup: "1-2 years",
			});
			await ParticipantDB.insert(p);
			participantId = p.id;
			await ParticipantDB.linkToCourse(participantId, course.id);

			// Lesson the participant is on (will cancel to get credit)
			await LessonDB.insert(
				{
					id: "lesson_consume_own",
					title: "Own Lesson",
					date: "2030-06-01",
					dayOfWeek: "Sunday",
					time: "10:00",
					location: "Studio",
					ageGroup: "1-2 years",
					capacity: 10,
					enrolledCount: 1,
				},
				course.id,
			);
			await RegistrationDB.insert({
				id: "reg_consume_own",
				lessonId: "lesson_consume_own",
				participantId,
				status: "confirmed",
			});

			// Substitution lesson on same-color course (participant not enrolled)
			substitutionLessonId = "lesson_consume_sub";
			await LessonDB.insert(
				{
					id: substitutionLessonId,
					title: "Sub Slot",
					date: "2030-06-08",
					dayOfWeek: "Sunday",
					time: "10:00",
					location: "Studio",
					ageGroup: "1-2 years",
					capacity: 10,
					enrolledCount: 0,
				},
				courseB.id,
			);

			await UserDB.insert({
				id: "user_frank",
				email: "frank@consume.cz",
				passwordHash: await bcrypt.hash("pass", 10),
				name: "Frank",
				role: "participant",
				participantId,
			});

			participantCookie = await loginAs("frank@consume.cz", "pass");
		});

		test("substitution register consumes one credit, leaving zero", async () => {
			// First: cancel to earn credit
			await fetch(
				`${BASE}/api/participants/${participantId}/cancel-registration`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Cookie: participantCookie,
					},
					body: JSON.stringify({ registrationId: "reg_consume_own" }),
				},
			);

			// Verify 1 credit
			let data = await (
				await fetch(`${BASE}/api/participants/${participantId}/credits`, {
					headers: { Cookie: participantCookie },
				})
			).json();
			expect(data.count).toBe(1);

			// Register for substitution (consumes credit)
			const regRes = await fetch(
				`${BASE}/api/participants/${participantId}/register-lesson`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Cookie: participantCookie,
					},
					body: JSON.stringify({ lessonId: substitutionLessonId }),
				},
			);
			expect(regRes.status).toBe(201);

			// Credit consumed
			data = await (
				await fetch(`${BASE}/api/participants/${participantId}/credits`, {
					headers: { Cookie: participantCookie },
				})
			).json();
			expect(data.count).toBe(0);
		});

		test("substitution register without credit returns 402", async () => {
			// No cancel — no credit
			const regRes = await fetch(
				`${BASE}/api/participants/${participantId}/register-lesson`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Cookie: participantCookie,
					},
					body: JSON.stringify({ lessonId: substitutionLessonId }),
				},
			);
			expect(regRes.status).toBe(402);
		});
	});
