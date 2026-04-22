import { expect, test } from "@playwright/test";
import { LessonCalendarDB } from "../src/calendar-db.js";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	CreditDB,
	initializeDatabase,
	LessonDB,
	ParticipantDB,
	RegistrationDB,
	resetDatabaseForTests,
} from "../src/database.js";
import { issueCredit } from "../src/credit.js";
import { createParticipant } from "../src/participant.js";
import { RegistrationManagerDB } from "../src/registration-db.js";
import { toDateString } from "../src/types.js";

// Admin happy-path flow: onboard a skupinka from scratch, manage registrations,
// issue credits, extend validity.

test.describe.serial("Admin flow", () => {
	let registrationManager: RegistrationManagerDB;

	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();
		registrationManager = new RegistrationManagerDB();
	});

	test("1. creates skupinka", async () => {
		const course = createCourse({
			name: "1-2 roky, Vietnamská",
			ageGroup: "1 - 2 roky",
			color: "#FF6B6B",
		});
		await CourseDB.insert(course);

		const saved = await CourseDB.getByName("1-2 roky, Vietnamská");
		expect(saved).toBeDefined();
		expect(saved?.ageGroup).toBe("1 - 2 roky");
	});

	test("2. bulk-creates 3 future lessons and auto-enrolls linked participants", async () => {
		const course = createCourse({
			name: "Bulk Flow Course",
			ageGroup: "1 - 2 roky",
			color: "#AABBCC",
		});
		await CourseDB.insert(course);

		const p1 = createParticipant({ name: "Alice", email: "alice@flow.cz", phone: "", ageGroup: "1 - 2 roky" });
		const p2 = createParticipant({ name: "Bob", email: "bob@flow.cz", phone: "", ageGroup: "1 - 2 roky" });
		await ParticipantDB.insert(p1);
		await ParticipantDB.insert(p2);
		await ParticipantDB.linkToCourse(p1.id, course.id);
		await ParticipantDB.linkToCourse(p2.id, course.id);

		const today = new Date();
		const dates = [1, 2, 3].map((n) => {
			const d = new Date(today);
			d.setDate(today.getDate() + 7 * n);
			return toDateString(d);
		});

		const calendar = new LessonCalendarDB();
		await calendar.bulkCreateLessons({
			courseId: course.id,
			title: "Weekly Class",
			location: "Studio",
			time: "10:00",
			dayOfWeek: "Monday",
			capacity: 10,
			dates,
		});

		await registrationManager.syncGroupEnrollments(course.id);

		const lessons = await LessonDB.getByCourse(course.id);
		expect(lessons).toHaveLength(3);

		for (const lesson of lessons) {
			const regs = await RegistrationDB.getByLessonId(lesson.id as string);
			const confirmed = regs.filter((r) => r.status === "confirmed");
			expect(confirmed).toHaveLength(2);
		}
	});

	test("3. admin cancels a registration (excused) → credit is issued", async () => {
		const course = createCourse({ name: "Credit Flow", ageGroup: "1 - 2 roky", color: "#112233" });
		await CourseDB.insert(course);

		const p = createParticipant({ name: "Carol", email: "carol@flow.cz", phone: "", ageGroup: "1 - 2 roky" });
		await ParticipantDB.insert(p);
		await ParticipantDB.linkToCourse(p.id, course.id);

		const today = new Date();
		const futureDate = new Date(today);
		futureDate.setDate(today.getDate() + 14);

		await LessonDB.insert({
			id: "lesson_admin_flow_cancel",
			title: "Admin Cancel Lesson",
			date: toDateString(futureDate),
			dayOfWeek: "Monday",
			time: "10:00",
			location: "Studio",
			ageGroup: "1 - 2 roky",
			capacity: 10,
			enrolledCount: 1,
			courseId: course.id,
		});
		await RegistrationDB.insert({
			id: "reg_admin_flow_cancel",
			lessonId: "lesson_admin_flow_cancel",
			participantId: p.id,
			status: "confirmed",
		});

		await registrationManager.adminCancelRegistration("reg_admin_flow_cancel");

		// Admin issues credit manually (simulating excused=true path from HTTP layer)
		await issueCredit(p.id, "reg_admin_flow_cancel", course.id);

		const credits = await CreditDB.getActiveByParticipant(p.id);
		expect(credits).toHaveLength(1);
	});

	test("4. deleted lesson cascades registrations", async () => {
		const course = createCourse({ name: "Cascade Flow", ageGroup: "1 - 2 roky", color: "#CCDDEE" });
		await CourseDB.insert(course);

		const p = createParticipant({ name: "Dave", email: "dave@flow.cz", phone: "", ageGroup: "1 - 2 roky" });
		await ParticipantDB.insert(p);

		const today = new Date();
		const futureDate = new Date(today);
		futureDate.setDate(today.getDate() + 7);

		await LessonDB.insert({
			id: "lesson_cascade",
			title: "Cascade Lesson",
			date: toDateString(futureDate),
			dayOfWeek: "Tuesday",
			time: "10:00",
			location: "Studio",
			ageGroup: "1 - 2 roky",
			capacity: 10,
			enrolledCount: 1,
			courseId: course.id,
		});
		await RegistrationDB.insert({
			id: "reg_cascade",
			lessonId: "lesson_cascade",
			participantId: p.id,
			status: "confirmed",
		});

		await LessonDB.delete("lesson_cascade");

		// Registration should be gone (CASCADE DELETE on lessonId FK)
		const reg = await RegistrationDB.getById("reg_cascade");
		expect(reg).toBeUndefined();
	});

	test("5. admin extends credit validity", async () => {
		const course = createCourse({ name: "Extend Flow", ageGroup: "1 - 2 roky", color: "#EEDDCC" });
		await CourseDB.insert(course);

		const p = createParticipant({ name: "Eve", email: "eve@flow.cz", phone: "", ageGroup: "1 - 2 roky" });
		await ParticipantDB.insert(p);

		await LessonDB.insert({
			id: "lesson_extend_base",
			title: "Base Lesson",
			date: "2030-10-01",
			dayOfWeek: "Tuesday",
			time: "10:00",
			location: "Studio",
			ageGroup: "1 - 2 roky",
			capacity: 10,
			enrolledCount: 1,
			courseId: course.id,
		});
		await RegistrationDB.insert({
			id: "reg_extend_base",
			lessonId: "lesson_extend_base",
			participantId: p.id,
			status: "confirmed",
		});

		await issueCredit(p.id, "reg_extend_base", course.id);

		const credits = await CreditDB.getActiveByParticipant(p.id);
		expect(credits).toHaveLength(1);

		const creditId = credits[0]!.id as string;
		const newExpiry = "2031-12-31T00:00:00.000Z";
		await CreditDB.updateExpiry(creditId, newExpiry);

		const updated = await CreditDB.getById(creditId);
		expect(updated?.expiresAt).toBe(newExpiry);
	});
});
