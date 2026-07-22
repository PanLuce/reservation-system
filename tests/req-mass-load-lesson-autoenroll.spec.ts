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
import type { EmailServiceInterface } from "../src/email-factory.js";
import { createParticipant } from "../src/participant.js";
import { RegistrationManagerDB } from "../src/registration-db.js";

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

test.describe
	.serial("Mass-load: bulk-lessons auto-enrolls the roster", () => {
		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();
		});

		test("creating lessons via bulk-lessons auto-enrolls the course's existing roster", async () => {
			const adminCookie = await loginAsAdmin();

			const course = createCourse({
				name: "Mass Load Skupinka",
				ageGroup: "1 - 2 roky",
				color: "#AABBCC",
			});
			await CourseDB.insert(course);

			const p1 = createParticipant({
				name: "Emil",
				email: "emil@t.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			const p2 = createParticipant({
				name: "Filip",
				email: "filip@t.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(p1);
			await ParticipantDB.insert(p2);
			await ParticipantDB.linkToCourse(p1.id, course.id);
			await ParticipantDB.linkToCourse(p2.id, course.id);

			const res = await fetch(`${BASE}/api/courses/${course.id}/bulk-lessons`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({
					title: "Hromadná lekce",
					time: "10:00",
					dayOfWeek: "Monday",
					capacity: 10,
					startDate: "2027-09-06",
					endDate: "2027-09-20",
				}),
			});

			expect(res.status).toBe(201);
			const data = (await res.json()) as {
				lessons: { id: string }[];
				enrolled: number;
				skipped: number;
			};
			expect(data.lessons.length).toBeGreaterThan(0);
			expect(data.enrolled).toBe(data.lessons.length * 2);
			expect(data.skipped).toBe(0);

			for (const lesson of data.lessons) {
				const regs = await RegistrationDB.getByLessonId(lesson.id);
				const participantIds = regs.map((r) => r.participantId);
				expect(participantIds).toContain(p1.id);
				expect(participantIds).toContain(p2.id);
				expect(regs.every((r) => r.status === "confirmed")).toBe(true);
			}
		});
	});

test.describe("syncGroupEnrollments — sendEmails option", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	function createSpyEmailService(): EmailServiceInterface & { calls: number } {
		return {
			calls: 0,
			async sendParticipantConfirmation() {
				this.calls++;
			},
			async sendAdminNotification() {
				this.calls++;
			},
		};
	}

	test("sendEmails: false suppresses confirmation/admin emails", async () => {
		const course = createCourse({
			name: "Silent Sync Skupinka",
			ageGroup: "1 - 2 roky",
			color: "#112233",
		});
		await CourseDB.insert(course);
		const p = createParticipant({
			name: "Gita",
			email: "gita@t.cz",
			phone: "",
			ageGroup: "1 - 2 roky",
		});
		await ParticipantDB.insert(p);
		await ParticipantDB.linkToCourse(p.id, course.id);

		await LessonDB.insert(
			{
				id: "silent_lesson_1",
				title: "Silent Lesson",
				date: "2027-10-01",
				dayOfWeek: "Friday",
				time: "10:00",
				location: "Studio",
				ageGroup: "1 - 2 roky",
				capacity: 10,
				enrolledCount: 0,
			},
			course.id,
		);

		const spy = createSpyEmailService();
		const manager = new RegistrationManagerDB(spy);

		const result = await manager.syncGroupEnrollments(course.id, {
			sendEmails: false,
		});
		expect(result.enrolled).toBe(1);

		// sendRegistrationEmails is fire-and-forget; give it a tick to (not) run.
		await new Promise((r) => setTimeout(r, 50));
		expect(spy.calls).toBe(0);
	});

	test("default (no options) still sends emails, as before", async () => {
		const course = createCourse({
			name: "Loud Sync Skupinka",
			ageGroup: "1 - 2 roky",
			color: "#445566",
		});
		await CourseDB.insert(course);
		const p = createParticipant({
			name: "Hana",
			email: "hana@t.cz",
			phone: "",
			ageGroup: "1 - 2 roky",
		});
		await ParticipantDB.insert(p);
		await ParticipantDB.linkToCourse(p.id, course.id);

		await LessonDB.insert(
			{
				id: "loud_lesson_1",
				title: "Loud Lesson",
				date: "2027-10-08",
				dayOfWeek: "Friday",
				time: "10:00",
				location: "Studio",
				ageGroup: "1 - 2 roky",
				capacity: 10,
				enrolledCount: 0,
			},
			course.id,
		);

		const spy = createSpyEmailService();
		const manager = new RegistrationManagerDB(spy);

		const result = await manager.syncGroupEnrollments(course.id);
		expect(result.enrolled).toBe(1);

		await new Promise((r) => setTimeout(r, 50));
		expect(spy.calls).toBeGreaterThan(0);
	});
});
