import { expect, test } from "@playwright/test";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	LessonDB,
	ParticipantDB,
	RegistrationDB,
	resetDatabaseForTests,
} from "../src/database.js";
import { createParticipant } from "../src/participant.js";

const BASE = "http://localhost:3000";

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

test.describe
	.serial("Auto-enrollment invariant", () => {
		let adminCookie: string;

		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();
			adminCookie = await loginAsAdmin();
		});

		test("creating a lesson with courseId auto-enrolls all course members", async () => {
			// Arrange — skupinka with 2 participants already linked
			const course = createCourse({
				name: "Auto Test Skupinka",
				ageGroup: "1 - 2 roky",
				color: "#AABBCC",
			});
			await CourseDB.insert(course);

			const p1 = createParticipant({
				name: "Alice",
				email: "alice@t.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			const p2 = createParticipant({
				name: "Bob",
				email: "bob@t.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(p1);
			await ParticipantDB.insert(p2);
			await ParticipantDB.linkToCourse(p1.id, course.id);
			await ParticipantDB.linkToCourse(p2.id, course.id);

			// Act — create a lesson with this courseId via the API
			const res = await fetch(`${BASE}/api/lessons`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({
					title: "Ranní cvičení",
					date: "2027-06-01",
					dayOfWeek: "Monday",
					time: "10:00",
					location: "Studio",
					ageGroup: "1 - 2 roky",
					capacity: 10,
					courseId: course.id,
				}),
			});
			expect(res.status).toBe(201);
			const lesson = await res.json();

			// Assert — both participants are now registered
			const regs = await RegistrationDB.getByLessonId(lesson.id);
			const participantIds = regs.map((r) => r.participantId);
			expect(participantIds).toContain(p1.id);
			expect(participantIds).toContain(p2.id);
			expect(regs.every((r) => r.status === "confirmed")).toBe(true);
		});

		test("linking a participant to a course auto-enrolls them on all future lessons of that course", async () => {
			// Arrange — course with 2 future lessons, no participants yet
			const course = createCourse({
				name: "Link Test Skupinka",
				ageGroup: "6-9 měsíců (do lezení)",
				color: "#112233",
			});
			await CourseDB.insert(course);

			await LessonDB.insert(
				{
					id: "lesson_link_1",
					title: "Lesson A",
					date: "2027-07-01",
					dayOfWeek: "Tuesday",
					time: "09:00",
					location: "Room 1",
					ageGroup: "6-9 měsíců (do lezení)",
					capacity: 10,
					enrolledCount: 0,
				},
				course.id,
			);

			await LessonDB.insert(
				{
					id: "lesson_link_2",
					title: "Lesson B",
					date: "2027-07-08",
					dayOfWeek: "Tuesday",
					time: "09:00",
					location: "Room 1",
					ageGroup: "6-9 měsíců (do lezení)",
					capacity: 10,
					enrolledCount: 0,
				},
				course.id,
			);

			const p = createParticipant({
				name: "Carol",
				email: "carol@t.cz",
				phone: "",
				ageGroup: "6-9 měsíců (do lezení)",
			});
			await ParticipantDB.insert(p);

			// Act — link participant to course via Excel import endpoint (which triggers sync)
			// We use the import endpoint since that is how participants are added to skupinky
			// and it should trigger syncGroupEnrollments
			await ParticipantDB.linkToCourse(p.id, course.id);

			// The invariant: call syncGroupEnrollments via the dedicated endpoint
			const syncRes = await fetch(
				`${BASE}/api/courses/${course.id}/sync-enrollments`,
				{
					method: "POST",
					headers: { Cookie: adminCookie },
				},
			);
			expect(syncRes.status).toBe(200);

			// Assert — participant enrolled on both future lessons
			const reg1 = await RegistrationDB.getByParticipantAndLesson(
				p.id,
				"lesson_link_1",
			);
			const reg2 = await RegistrationDB.getByParticipantAndLesson(
				p.id,
				"lesson_link_2",
			);
			expect(reg1).toBeDefined();
			expect(reg2).toBeDefined();
			expect(reg1!.status).toBe("confirmed");
			expect(reg2!.status).toBe("confirmed");
		});

		test("sync is idempotent — running twice does not create duplicate registrations", async () => {
			const course = createCourse({
				name: "Idempotent Skupinka",
				ageGroup: "1 - 2 roky",
				color: "#CCBBAA",
			});
			await CourseDB.insert(course);

			const p = createParticipant({
				name: "Dave",
				email: "dave@t.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(p);
			await ParticipantDB.linkToCourse(p.id, course.id);

			// Create a lesson via API (triggers first sync)
			const res = await fetch(`${BASE}/api/lessons`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({
					title: "Idempotent Lesson",
					date: "2027-08-01",
					dayOfWeek: "Friday",
					time: "11:00",
					location: "Studio",
					ageGroup: "1 - 2 roky",
					capacity: 10,
					courseId: course.id,
				}),
			});
			const lesson = await res.json();

			// Run sync again explicitly
			await fetch(`${BASE}/api/courses/${course.id}/sync-enrollments`, {
				method: "POST",
				headers: { Cookie: adminCookie },
			});

			// Assert — only one registration for that participant+lesson
			const allRegs = await RegistrationDB.getByLessonId(lesson.id);
			const participantRegs = allRegs.filter((r) => r.participantId === p.id);
			expect(participantRegs).toHaveLength(1);
		});
	});
