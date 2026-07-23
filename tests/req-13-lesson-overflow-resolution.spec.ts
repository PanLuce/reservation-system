import { expect, test } from "@playwright/test";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	ParticipantDB,
	RegistrationDB,
	resetDatabaseForTests,
} from "../src/database.js";
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

async function createCourseWithRoster(
	names: string[],
	ageGroup = "1 - 2 roky",
): Promise<{ courseId: string; participantIds: Record<string, string> }> {
	const course = createCourse({
		name: `Overflow Test ${Math.random().toString(36).slice(2)}`,
		ageGroup,
	});
	await CourseDB.insert(course);

	const participantIds: Record<string, string> = {};
	for (const name of names) {
		const p = createParticipant({
			name,
			email: `${name.toLowerCase()}-${course.id}@t.cz`,
			phone: "",
			ageGroup,
		});
		await ParticipantDB.insert(p);
		await ParticipantDB.linkToCourse(p.id, course.id);
		participantIds[name] = p.id;
	}

	return { courseId: course.id, participantIds };
}

test.describe
	.serial("REQ-13: Lesson overflow resolution", () => {
		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();
		});

		test("roster bigger than capacity: bulk-lessons defers enrollment and reports needsResolution", async () => {
			const cookie = await loginAsAdmin();
			const { courseId, participantIds } = await createCourseWithRoster([
				"Alena",
				"Bedrich",
				"Cyril",
			]);

			const res = await fetch(`${BASE}/api/courses/${courseId}/bulk-lessons`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: JSON.stringify({
					title: "Overflow Lekce",
					time: "10:00",
					dayOfWeek: "Monday",
					capacity: 2,
					startDate: "2027-09-06",
					endDate: "2027-09-13",
				}),
			});

			expect(res.status).toBe(201);
			const data = (await res.json()) as {
				lessons: { id: string }[];
				needsResolution: boolean;
				capacity: number;
				roster: { id: string; name: string }[];
			};
			expect(data.needsResolution).toBe(true);
			expect(data.capacity).toBe(2);
			expect(data.roster.map((r) => r.name).sort()).toEqual([
				"Alena",
				"Bedrich",
				"Cyril",
			]);
			expect(data.lessons.length).toBeGreaterThan(0);

			// No registrations were auto-created — resolution is deferred.
			for (const lesson of data.lessons) {
				const regs = await RegistrationDB.getByLessonId(lesson.id);
				expect(regs).toHaveLength(0);
			}
			void participantIds;
		});

		test("roster fits capacity: bulk-lessons auto-enrolls exactly as before, no needsResolution", async () => {
			const cookie = await loginAsAdmin();
			const { courseId } = await createCourseWithRoster(["Dana", "Emil"]);

			const res = await fetch(`${BASE}/api/courses/${courseId}/bulk-lessons`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: JSON.stringify({
					title: "Fits Lekce",
					time: "10:00",
					dayOfWeek: "Monday",
					capacity: 10,
					startDate: "2027-09-06",
					endDate: "2027-09-06",
				}),
			});

			expect(res.status).toBe(201);
			const data = (await res.json()) as {
				lessons: { id: string }[];
				needsResolution?: boolean;
				enrolled: number;
				skipped: number;
			};
			expect(data.needsResolution).toBeFalsy();
			expect(data.enrolled).toBe(2);

			const firstLesson = data.lessons[0];
			if (!firstLesson) throw new Error("expected at least one created lesson");
			const regs = await RegistrationDB.getByLessonId(firstLesson.id);
			expect(regs.every((r) => r.status === "confirmed")).toBe(true);
			expect(regs).toHaveLength(2);
		});

		test("resolve-lesson-overflow: selected kids confirmed, rest waitlisted, applied to every lesson in the batch", async () => {
			const cookie = await loginAsAdmin();
			const { courseId, participantIds } = await createCourseWithRoster([
				"Filip",
				"Gita",
				"Hynek",
			]);

			const createRes = await fetch(
				`${BASE}/api/courses/${courseId}/bulk-lessons`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json", Cookie: cookie },
					body: JSON.stringify({
						title: "Resolve Lekce",
						time: "10:00",
						dayOfWeek: "Monday",
						capacity: 2,
						startDate: "2027-10-04",
						endDate: "2027-10-11",
					}),
				},
			);
			const created = (await createRes.json()) as {
				lessons: { id: string }[];
			};
			expect(created.lessons.length).toBe(2);
			const lessonIds = created.lessons.map((l) => l.id);

			const resolveRes = await fetch(
				`${BASE}/api/courses/${courseId}/resolve-lesson-overflow`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json", Cookie: cookie },
					body: JSON.stringify({
						lessonIds,
						confirmedParticipantIds: [
							participantIds.Filip,
							participantIds.Gita,
						],
					}),
				},
			);
			expect(resolveRes.status).toBe(201);

			for (const lessonId of lessonIds) {
				const regs = await RegistrationDB.getByLessonId(lessonId);
				const byParticipant = new Map(regs.map((r) => [r.participantId, r]));
				expect(byParticipant.get(participantIds.Filip)?.status).toBe(
					"confirmed",
				);
				expect(byParticipant.get(participantIds.Gita)?.status).toBe(
					"confirmed",
				);
				expect(byParticipant.get(participantIds.Hynek)?.status).toBe(
					"waitlist",
				);
			}
		});

		test("resolve-lesson-overflow is idempotent — calling it again reports the pairs as skipped", async () => {
			const cookie = await loginAsAdmin();
			const { courseId, participantIds } = await createCourseWithRoster([
				"Iva",
				"Jarda",
			]);

			const createRes = await fetch(
				`${BASE}/api/courses/${courseId}/bulk-lessons`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json", Cookie: cookie },
					body: JSON.stringify({
						title: "Idempotent Lekce",
						time: "10:00",
						dayOfWeek: "Monday",
						capacity: 1,
						startDate: "2027-11-01",
						endDate: "2027-11-01",
					}),
				},
			);
			const created = (await createRes.json()) as { lessons: { id: string }[] };
			const lessonIds = created.lessons.map((l) => l.id);

			const body = JSON.stringify({
				lessonIds,
				confirmedParticipantIds: [participantIds.Iva],
			});

			await fetch(`${BASE}/api/courses/${courseId}/resolve-lesson-overflow`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body,
			});

			const secondRes = await fetch(
				`${BASE}/api/courses/${courseId}/resolve-lesson-overflow`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json", Cookie: cookie },
					body,
				},
			);
			expect(secondRes.status).toBe(201);
			const secondData = (await secondRes.json()) as {
				successful: number;
				waitlisted: number;
				skipped: number;
			};
			expect(secondData.successful).toBe(0);
			expect(secondData.waitlisted).toBe(0);
			expect(secondData.skipped).toBe(2);

			const firstLessonId = lessonIds[0];
			if (!firstLessonId)
				throw new Error("expected at least one created lesson");
			const regs = await RegistrationDB.getByLessonId(firstLessonId);
			expect(regs).toHaveLength(2);
		});
	});
