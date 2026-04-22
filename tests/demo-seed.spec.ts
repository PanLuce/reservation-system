import { expect, test } from "@playwright/test";
import {
	ensureDemoParticipant,
	initializeDatabase,
	resetDatabaseForTests,
	ParticipantDB,
	UserDB,
	CreditDB,
	RegistrationDB,
} from "../src/database.js";

test.describe.serial("Demo participant seed", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		process.env.PARTICIPANT_EMAIL_SEED = "maminka@test.cz";
		process.env.PARTICIPANT_PASSWORD_SEED = "test123";
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("seeds participant account with correct email and role", async () => {
		await ensureDemoParticipant();

		const user = await UserDB.getByEmail("maminka@test.cz");
		expect(user).toBeDefined();
		expect(user?.role).toBe("participant");
		expect(user?.participantId).toBeTruthy();
	});

	test("seeds participant linked to a course", async () => {
		await ensureDemoParticipant();

		const user = await UserDB.getByEmail("maminka@test.cz");
		const courses = await ParticipantDB.getCoursesForParticipant(
			user?.participantId as string,
		);
		expect(courses.length).toBeGreaterThanOrEqual(1);
	});

	test("seeds 3 confirmed registrations for the participant", async () => {
		await ensureDemoParticipant();

		const user = await UserDB.getByEmail("maminka@test.cz");
		const registrations = await RegistrationDB.getByParticipantId(
			user?.participantId as string,
		);
		const confirmed = registrations.filter((r) => r.status === "confirmed");
		expect(confirmed).toHaveLength(3);
	});

	test("seeds 1 active substitution credit", async () => {
		await ensureDemoParticipant();

		const user = await UserDB.getByEmail("maminka@test.cz");
		const credits = await CreditDB.getActiveByParticipant(
			user?.participantId as string,
		);
		expect(credits).toHaveLength(1);
	});

	test("seed is idempotent — calling twice does not duplicate data", async () => {
		await ensureDemoParticipant();
		await ensureDemoParticipant();

		const participants = await ParticipantDB.getAll();
		const moms = participants.filter(
			(p) => p.email === "maminka@test.cz",
		);
		expect(moms).toHaveLength(1);

		const user = await UserDB.getByEmail("maminka@test.cz");
		const credits = await CreditDB.getActiveByParticipant(
			user?.participantId as string,
		);
		expect(credits).toHaveLength(1);
	});
});
