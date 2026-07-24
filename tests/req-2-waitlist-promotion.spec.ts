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
import { createLesson } from "../src/lesson.js";
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

async function createLessonWithCapacity(capacity: number): Promise<string> {
	const course = createCourse({
		name: `Waitlist Test ${Math.random().toString(36).slice(2)}`,
		ageGroup: "1 - 2 roky",
	});
	await CourseDB.insert(course);

	const lesson = createLesson({
		title: "Waitlist Lekce",
		date: "2027-09-06",
		dayOfWeek: "Monday",
		time: "10:00",
		ageGroup: "1 - 2 roky",
		capacity,
		courseId: course.id,
	});
	await LessonDB.insert(lesson);
	return lesson.id;
}

async function createUnlinkedParticipant(name: string): Promise<string> {
	const p = createParticipant({
		name,
		email: `${name.toLowerCase()}-${Math.random().toString(36).slice(2)}@t.cz`,
		phone: "",
		ageGroup: "1 - 2 roky",
	});
	await ParticipantDB.insert(p);
	return p.id;
}

async function registerParticipant(
	cookie: string,
	lessonId: string,
	participantId: string,
): Promise<{ status: string; registrationId: string }> {
	const res = await fetch(`${BASE}/api/admin/register-participant`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Cookie: cookie },
		body: JSON.stringify({ lessonId, participantId }),
	});
	const data = (await res.json()) as {
		registration: { id: string; status: string };
	};
	return {
		status: data.registration.status,
		registrationId: data.registration.id,
	};
}

async function cancelRegistration(
	cookie: string,
	registrationId: string,
): Promise<void> {
	const res = await fetch(`${BASE}/api/admin/cancel-registration`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Cookie: cookie },
		body: JSON.stringify({ registrationId }),
	});
	expect(res.status).toBe(200);
}

async function statusFor(
	lessonId: string,
	participantId: string,
): Promise<string | undefined> {
	const regs = await RegistrationDB.getByLessonId(lessonId);
	return regs.find((r) => r.participantId === participantId)?.status as string;
}

async function declineTokenFor(
	lessonId: string,
	participantId: string,
): Promise<string | undefined> {
	const regs = await RegistrationDB.getByLessonId(lessonId);
	return regs.find((r) => r.participantId === participantId)?.declineToken as
		| string
		| undefined;
}

test.describe
	.serial("REQ-2: Waitlist auto-promotion", () => {
		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();
		});

		test("cancelling a confirmed registration promotes the first waitlisted participant", async () => {
			const cookie = await loginAsAdmin();
			const lessonId = await createLessonWithCapacity(1);
			const alena = await createUnlinkedParticipant("Alena");
			const bedrich = await createUnlinkedParticipant("Bedrich");

			const regA = await registerParticipant(cookie, lessonId, alena);
			expect(regA.status).toBe("confirmed");
			const regB = await registerParticipant(cookie, lessonId, bedrich);
			expect(regB.status).toBe("waitlist");

			await cancelRegistration(cookie, regA.registrationId);

			expect(await statusFor(lessonId, alena)).toBe("cancelled");
			expect(await statusFor(lessonId, bedrich)).toBe("confirmed");

			const lesson = await LessonDB.getById(lessonId);
			expect(lesson?.enrolledCount).toBe(1);
		});

		test("promotion respects waitlist order — first registered is promoted first", async () => {
			const cookie = await loginAsAdmin();
			const lessonId = await createLessonWithCapacity(1);
			const alena = await createUnlinkedParticipant("Alena");
			const bedrich = await createUnlinkedParticipant("Bedrich");
			const cyril = await createUnlinkedParticipant("Cyril");

			const regA = await registerParticipant(cookie, lessonId, alena);
			await registerParticipant(cookie, lessonId, bedrich);
			await registerParticipant(cookie, lessonId, cyril);

			await cancelRegistration(cookie, regA.registrationId);

			expect(await statusFor(lessonId, bedrich)).toBe("confirmed");
			expect(await statusFor(lessonId, cyril)).toBe("waitlist");
		});

		test("raising lesson capacity promotes multiple waitlisted participants in order", async () => {
			const cookie = await loginAsAdmin();
			const lessonId = await createLessonWithCapacity(1);
			const alena = await createUnlinkedParticipant("Alena");
			const bedrich = await createUnlinkedParticipant("Bedrich");
			const cyril = await createUnlinkedParticipant("Cyril");

			await registerParticipant(cookie, lessonId, alena);
			await registerParticipant(cookie, lessonId, bedrich);
			await registerParticipant(cookie, lessonId, cyril);

			const res = await fetch(`${BASE}/api/lessons/${lessonId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json", Cookie: cookie },
				body: JSON.stringify({ capacity: 3 }),
			});
			expect(res.status).toBe(200);

			expect(await statusFor(lessonId, alena)).toBe("confirmed");
			expect(await statusFor(lessonId, bedrich)).toBe("confirmed");
			expect(await statusFor(lessonId, cyril)).toBe("confirmed");

			const lesson = await LessonDB.getById(lessonId);
			expect(lesson?.enrolledCount).toBe(3);
		});

		test("cancelling with an empty waitlist is a no-op beyond freeing the seat", async () => {
			const cookie = await loginAsAdmin();
			const lessonId = await createLessonWithCapacity(1);
			const alena = await createUnlinkedParticipant("Alena");

			const regA = await registerParticipant(cookie, lessonId, alena);
			await cancelRegistration(cookie, regA.registrationId);

			expect(await statusFor(lessonId, alena)).toBe("cancelled");
			const lesson = await LessonDB.getById(lessonId);
			expect(lesson?.enrolledCount).toBe(0);
		});

		test("cancelling a waitlisted registration does not promote anyone else", async () => {
			const cookie = await loginAsAdmin();
			const lessonId = await createLessonWithCapacity(1);
			const alena = await createUnlinkedParticipant("Alena");
			const bedrich = await createUnlinkedParticipant("Bedrich");
			const cyril = await createUnlinkedParticipant("Cyril");

			await registerParticipant(cookie, lessonId, alena);
			const regB = await registerParticipant(cookie, lessonId, bedrich);
			await registerParticipant(cookie, lessonId, cyril);

			await cancelRegistration(cookie, regB.registrationId);

			expect(await statusFor(lessonId, alena)).toBe("confirmed");
			expect(await statusFor(lessonId, bedrich)).toBe("cancelled");
			expect(await statusFor(lessonId, cyril)).toBe("waitlist");

			const lesson = await LessonDB.getById(lessonId);
			expect(lesson?.enrolledCount).toBe(1);
		});

		test("promoting a waitlisted participant mints a decline token resolvable via getByDeclineToken", async () => {
			const cookie = await loginAsAdmin();
			const lessonId = await createLessonWithCapacity(1);
			const alena = await createUnlinkedParticipant("Alena");
			const bedrich = await createUnlinkedParticipant("Bedrich");

			const regA = await registerParticipant(cookie, lessonId, alena);
			await registerParticipant(cookie, lessonId, bedrich);

			await cancelRegistration(cookie, regA.registrationId);

			const regs = await RegistrationDB.getByLessonId(lessonId);
			const promoted = regs.find((r) => r.participantId === bedrich);
			expect(promoted?.status).toBe("confirmed");
			const token = promoted?.declineToken as string;
			expect(token).toBeTruthy();

			const found = await RegistrationDB.getByDeclineToken(token);
			expect(found?.id).toBe(promoted?.id);
		});

		test("a registration that was never promoted has no decline token", async () => {
			const cookie = await loginAsAdmin();
			const lessonId = await createLessonWithCapacity(1);
			const alena = await createUnlinkedParticipant("Alena");

			await registerParticipant(cookie, lessonId, alena);

			const regs = await RegistrationDB.getByLessonId(lessonId);
			const reg = regs.find((r) => r.participantId === alena);
			expect(reg?.status).toBe("confirmed");
			expect(reg?.declineToken).toBeFalsy();
		});

		test("declining via the public link cancels the seat and cascades to the next waitlisted participant", async () => {
			const cookie = await loginAsAdmin();
			const lessonId = await createLessonWithCapacity(1);
			const alena = await createUnlinkedParticipant("Alena");
			const bedrich = await createUnlinkedParticipant("Bedrich");
			const cyril = await createUnlinkedParticipant("Cyril");

			const regA = await registerParticipant(cookie, lessonId, alena);
			await registerParticipant(cookie, lessonId, bedrich);
			await registerParticipant(cookie, lessonId, cyril);

			await cancelRegistration(cookie, regA.registrationId);
			expect(await statusFor(lessonId, bedrich)).toBe("confirmed");

			const token = await declineTokenFor(lessonId, bedrich);
			expect(token).toBeTruthy();

			const infoRes = await fetch(`${BASE}/api/decline/${token}`);
			expect(infoRes.status).toBe(200);
			const info = (await infoRes.json()) as {
				participant: { name: string };
				lesson: { title: string };
			};
			expect(info.participant.name).toBe("Bedrich");

			const declineRes = await fetch(`${BASE}/api/decline/${token}`, {
				method: "POST",
			});
			expect(declineRes.status).toBe(200);
			const declineData = (await declineRes.json()) as { declined?: boolean };
			expect(declineData.declined).toBe(true);

			expect(await statusFor(lessonId, bedrich)).toBe("cancelled");
			expect(await statusFor(lessonId, cyril)).toBe("confirmed");

			const lesson = await LessonDB.getById(lessonId);
			expect(lesson?.enrolledCount).toBe(1);
		});

		test("declining twice reports the second attempt as already declined", async () => {
			const cookie = await loginAsAdmin();
			const lessonId = await createLessonWithCapacity(1);
			const alena = await createUnlinkedParticipant("Alena");
			const bedrich = await createUnlinkedParticipant("Bedrich");

			const regA = await registerParticipant(cookie, lessonId, alena);
			await registerParticipant(cookie, lessonId, bedrich);
			await cancelRegistration(cookie, regA.registrationId);

			const token = await declineTokenFor(lessonId, bedrich);

			const first = await fetch(`${BASE}/api/decline/${token}`, {
				method: "POST",
			});
			expect((await first.json()).declined).toBe(true);

			const second = await fetch(`${BASE}/api/decline/${token}`, {
				method: "POST",
			});
			expect(second.status).toBe(200);
			expect((await second.json()).alreadyDeclined).toBe(true);
		});

		test("GET and POST decline for an unknown token both 404", async () => {
			const infoRes = await fetch(`${BASE}/api/decline/not-a-real-token`);
			expect(infoRes.status).toBe(404);

			const declineRes = await fetch(`${BASE}/api/decline/not-a-real-token`, {
				method: "POST",
			});
			expect(declineRes.status).toBe(404);
		});

		test("promotion sends a waitlist promotion email with a working decline link", async () => {
			const lessonId = await createLessonWithCapacity(1);

			const calls: Array<{ participantEmail: string; declineUrl: string }> = [];
			const mockEmailService: EmailServiceInterface = {
				sendParticipantConfirmation: async () => {},
				sendAdminNotification: async () => {},
				sendWaitlistPromotion: async (participant, _lesson, declineUrl) => {
					calls.push({ participantEmail: participant.email, declineUrl });
				},
			};
			const manager = new RegistrationManagerDB(
				mockEmailService,
				"https://test.example",
			);

			const alena = {
				id: `p_${Math.random().toString(36).slice(2)}`,
				name: "Alena",
				email: "alena@t.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			};
			const bedrich = {
				id: `p_${Math.random().toString(36).slice(2)}`,
				name: "Bedrich",
				email: "bedrich@t.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			};

			const regA = await manager.registerParticipant(lessonId, alena, {
				sendEmails: false,
			});
			await manager.registerParticipant(lessonId, bedrich, {
				sendEmails: false,
			});

			await manager.cancelRegistration(regA.id);

			// promoteWaitlistForLesson fires the promotion email fire-and-forget
			// (same pattern as registerParticipant's confirmation emails) — give it
			// a tick to land, matching tests/registration-email.spec.ts.
			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(calls).toHaveLength(1);
			expect(calls[0]?.participantEmail).toBe("bedrich@t.cz");
			expect(calls[0]?.declineUrl).toMatch(
				/^https:\/\/test\.example\/decline\.html\?token=[\w-]+$/,
			);
		});
	});
