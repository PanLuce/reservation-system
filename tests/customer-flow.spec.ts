import { expect, test } from "@playwright/test";
import { createCourse } from "../src/course.js";
import { countActiveCredits } from "../src/credit.js";
import {
	CourseDB,
	CreditDB,
	initializeDatabase,
	LessonDB,
	ParticipantDB,
	RegistrationDB,
	resetDatabaseForTests,
} from "../src/database.js";
import { createParticipant } from "../src/participant.js";
import { RegistrationManagerDB } from "../src/registration-db.js";
import { toDateString } from "../src/types.js";

// Customer happy-path flow: mom cancels, rebooks as substitution, hits guardrails.

test.describe
	.serial("Customer flow", () => {
		let registrationManager: RegistrationManagerDB;
		let momId: string;
		let ownCourseId: string;
		let sisterCourseId: string;

		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();
			registrationManager = new RegistrationManagerDB();

			// Mom's own skupinka
			const ownCourse = createCourse({
				name: "Customer Flow Own",
				ageGroup: "1 - 2 roky",
				color: "#AABBCC",
			});
			// Sister skupinka — same ageGroup, different course
			const sisterCourse = createCourse({
				name: "Customer Flow Sister",
				ageGroup: "1 - 2 roky",
				color: "#DDEEFF",
			});

			await CourseDB.insert(ownCourse);
			await CourseDB.insert(sisterCourse);
			ownCourseId = ownCourse.id;
			sisterCourseId = sisterCourse.id;

			const mom = createParticipant({
				name: "Maminka",
				email: "mom@flow.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(mom);
			momId = mom.id;
			await ParticipantDB.linkToCourse(momId, ownCourseId);

			const today = new Date();
			const futureDate1 = new Date(today);
			futureDate1.setDate(today.getDate() + 14);
			const futureDate2 = new Date(today);
			futureDate2.setDate(today.getDate() + 21);

			// Lesson on own course — mom will cancel this one
			await LessonDB.insert({
				id: "lesson_own_1",
				title: "Own Lesson 1",
				date: toDateString(futureDate1),
				dayOfWeek: "Monday",
				time: "10:00",
				location: "Studio",
				ageGroup: "1 - 2 roky",
				capacity: 10,
				enrolledCount: 1,
				courseId: ownCourseId,
			});
			await RegistrationDB.insert({
				id: "reg_own_1",
				lessonId: "lesson_own_1",
				participantId: momId,
				status: "confirmed",
			});

			// Lesson on sister course — mom will use as substitution
			await LessonDB.insert({
				id: "lesson_sister_1",
				title: "Sister Lesson 1",
				date: toDateString(futureDate2),
				dayOfWeek: "Monday",
				time: "10:00",
				location: "Studio",
				ageGroup: "1 - 2 roky",
				capacity: 10,
				enrolledCount: 0,
				courseId: sisterCourseId,
			});

			// Second sister lesson — mom will attempt substitution without credit
			await LessonDB.insert({
				id: "lesson_sister_2",
				title: "Sister Lesson 2",
				date: toDateString(futureDate2),
				dayOfWeek: "Monday",
				time: "11:00",
				location: "Studio",
				ageGroup: "1 - 2 roky",
				capacity: 10,
				enrolledCount: 0,
				courseId: sisterCourseId,
			});

			// Past lesson — mom will attempt to cancel (should be blocked)
			await LessonDB.insert({
				id: "lesson_past",
				title: "Past Lesson",
				date: "2020-01-01",
				dayOfWeek: "Wednesday",
				time: "10:00",
				location: "Studio",
				ageGroup: "1 - 2 roky",
				capacity: 10,
				enrolledCount: 1,
				courseId: ownCourseId,
			});
			await RegistrationDB.insert({
				id: "reg_past",
				lessonId: "lesson_past",
				participantId: momId,
				status: "confirmed",
			});
		});

		test("1. mom cancels a future lesson → credit is issued", async () => {
			const result = await registrationManager.participantCancelRegistration(
				"reg_own_1",
				momId,
			);

			expect(result.success).toBe(true);

			const credits = await countActiveCredits(momId);
			expect(credits).toBe(1);
		});

		test("2. after cancel, mom sees sister skupinka lessons as substitution candidates", async () => {
			await registrationManager.participantCancelRegistration(
				"reg_own_1",
				momId,
			);

			// Replicate substitution-candidates DB logic (same as server.ts endpoint)
			const participantCourses =
				await ParticipantDB.getCoursesForParticipant(momId);
			const ownCourseIds = new Set(
				participantCourses.map((c) => c.id as string),
			);
			const participantAgeGroups = new Set(
				participantCourses.map((c) => c.ageGroup as string),
			);

			const allCourses = await CourseDB.getAll();
			const sameAgeGroupCourseIds = new Set(
				allCourses
					.filter(
						(c) =>
							participantAgeGroups.has(c.ageGroup as string) &&
							!ownCourseIds.has(c.id as string),
					)
					.map((c) => c.id as string),
			);

			const existingRegs = await RegistrationDB.getByParticipantId(momId);
			const registeredLessonIds = new Set(
				existingRegs.map((r) => r.lessonId as string),
			);

			const today = toDateString(new Date());
			const allLessons = await LessonDB.getAll();
			const candidates = allLessons.filter(
				(l) =>
					sameAgeGroupCourseIds.has(l.courseId as string) &&
					(l.date as string) >= today &&
					(l.enrolledCount as number) < (l.capacity as number) &&
					!registeredLessonIds.has(l.id as string),
			);

			const candidateIds = candidates.map((l) => l.id as string);
			expect(candidateIds).toContain("lesson_sister_1");
			expect(candidateIds).toContain("lesson_sister_2");
			expect(candidateIds).not.toContain("lesson_own_1"); // own course
			expect(candidateIds).not.toContain("lesson_past"); // past
		});

		test("3. mom self-registers for substitution lesson → credit is consumed", async () => {
			// Issue credit first (simulating previous cancel)
			await registrationManager.participantCancelRegistration(
				"reg_own_1",
				momId,
			);

			const creditsBefore = await countActiveCredits(momId);
			expect(creditsBefore).toBe(1);

			const result = await registrationManager.participantSelfRegister(
				"lesson_sister_1",
				momId,
			);

			expect(result.success).toBe(true);

			const creditsAfter = await countActiveCredits(momId);
			expect(creditsAfter).toBe(0);

			const reg = await RegistrationDB.getByParticipantAndLesson(
				momId,
				"lesson_sister_1",
			);
			expect(reg).toBeDefined();
		});

		test("4. mom cannot cancel a past lesson (after midnight cutoff)", async () => {
			const result = await registrationManager.participantCancelRegistration(
				"reg_past",
				momId,
			);

			expect(result.success).toBe(false);
			expect(result.error).toMatch(/midnight/i);

			// Credit must NOT have been issued
			const credits = await countActiveCredits(momId);
			expect(credits).toBe(0);
		});

		test("5. mom cannot self-register for substitution without credit", async () => {
			// No cancel, so credit count = 0
			const credits = await countActiveCredits(momId);
			expect(credits).toBe(0);

			const result = await registrationManager.participantSelfRegister(
				"lesson_sister_1",
				momId,
			);

			expect(result.success).toBe(false);
			const resultWithFlag = result as {
				success: false;
				error: string;
				noCredit?: boolean;
			};
			expect(resultWithFlag.noCredit).toBe(true);

			// Verify no confirmed registration exists (rollback cancelled it)
			const regs = await RegistrationDB.getByLessonId("lesson_sister_1");
			const confirmed = regs.filter(
				(r) => r.participantId === momId && r.status === "confirmed",
			);
			expect(confirmed).toHaveLength(0);
		});
	});
