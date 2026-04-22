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
	.serial("Substitution candidates", () => {
		let pId: string;
		let cookie: string;
		let sameColorCourseId: string;
		let diffColorCourseId: string;

		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();

			// Two courses, same color (same substitution group), one different color
			const courseA = createCourse({
				name: "3-6 měsíců, Vietnamská",
				ageGroup: "3-12 months",
				color: "#FF6B6B",
			});
			const courseB = createCourse({
				name: "3-6 měsíců, Poklad",
				ageGroup: "3-12 months",
				color: "#FF6B6B",
			}); // same color
			const courseC = createCourse({
				name: "1-2 roky, Jeremiáš",
				ageGroup: "1-2 years",
				color: "#4CAF50",
			}); // different color
			await CourseDB.insert(courseA);
			await CourseDB.insert(courseB);
			await CourseDB.insert(courseC);
			sameColorCourseId = courseB.id;
			diffColorCourseId = courseC.id;

			const p = createParticipant({
				name: "Participant",
				email: "sub@t.cz",
				phone: "",
				ageGroup: "3-12 months",
			});
			await ParticipantDB.insert(p);
			pId = p.id;

			// Participant is in courseA
			await ParticipantDB.linkToCourse(pId, courseA.id);

			await UserDB.insert({
				id: "user_sub",
				email: "sub@t.cz",
				passwordHash: await bcrypt.hash("pass", 10),
				name: "Sub",
				role: "participant",
				participantId: pId,
			});

			// Lesson participant is already registered on (same color course)
			await LessonDB.insert(
				{
					id: "lesson_registered",
					title: "My Lesson",
					date: "2030-04-01",
					dayOfWeek: "Tuesday",
					time: "09:00",
					location: "Studio",
					ageGroup: "3-12 months",
					capacity: 10,
					enrolledCount: 1,
				},
				courseA.id,
			);
			await RegistrationDB.insert({
				id: "reg_mine",
				lessonId: "lesson_registered",
				participantId: pId,
				status: "confirmed",
			});

			// Lesson on same-color course with space — should appear as substitution candidate
			await LessonDB.insert(
				{
					id: "lesson_sub_avail",
					title: "Sub Lesson",
					date: "2030-04-08",
					dayOfWeek: "Tuesday",
					time: "09:00",
					location: "Studio",
					ageGroup: "3-12 months",
					capacity: 10,
					enrolledCount: 2,
				},
				courseB.id,
			);

			// Lesson on same-color course but FULL — should NOT appear
			await LessonDB.insert(
				{
					id: "lesson_sub_full",
					title: "Full Lesson",
					date: "2030-04-15",
					dayOfWeek: "Tuesday",
					time: "09:00",
					location: "Studio",
					ageGroup: "3-12 months",
					capacity: 2,
					enrolledCount: 2,
				},
				courseB.id,
			);

			// Lesson on different-color course — should NOT appear
			await LessonDB.insert(
				{
					id: "lesson_diff_color",
					title: "Wrong Color",
					date: "2030-04-08",
					dayOfWeek: "Tuesday",
					time: "10:00",
					location: "Studio",
					ageGroup: "1-2 years",
					capacity: 10,
					enrolledCount: 0,
				},
				diffColorCourseId,
			);

			// Past lesson on same-color course — should NOT appear
			await LessonDB.insert(
				{
					id: "lesson_past",
					title: "Past Lesson",
					date: "2020-01-01",
					dayOfWeek: "Monday",
					time: "09:00",
					location: "Studio",
					ageGroup: "3-12 months",
					capacity: 10,
					enrolledCount: 0,
				},
				courseB.id,
			);

			cookie = await loginAs("sub@t.cz", "pass");
		});

		test("returns only future, available, same-color lessons the participant is not already on", async () => {
			const res = await fetch(
				`${BASE}/api/participants/${pId}/substitution-candidates`,
				{
					headers: { Cookie: cookie },
				},
			);
			expect(res.status).toBe(200);
			const data = await res.json();
			const ids = data.map((l: { id: string }) => l.id);

			expect(ids).toContain("lesson_sub_avail");
			expect(ids).not.toContain("lesson_registered"); // already on it
			expect(ids).not.toContain("lesson_sub_full"); // full
			expect(ids).not.toContain("lesson_diff_color"); // wrong color
			expect(ids).not.toContain("lesson_past"); // past
		});

		test("participant B cannot access participant A's substitution candidates", async () => {
			const p2 = createParticipant({
				name: "Outsider",
				email: "out@t.cz",
				phone: "",
				ageGroup: "3-12 months",
			});
			await ParticipantDB.insert(p2);
			await UserDB.insert({
				id: "user_out",
				email: "out@t.cz",
				passwordHash: await bcrypt.hash("pass2", 10),
				name: "Out",
				role: "participant",
				participantId: p2.id,
			});
			const cookie2 = await loginAs("out@t.cz", "pass2");

			const res = await fetch(
				`${BASE}/api/participants/${pId}/substitution-candidates`,
				{
					headers: { Cookie: cookie2 },
				},
			);
			expect(res.status).toBe(403);
		});
	});
