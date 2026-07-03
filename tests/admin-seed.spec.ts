import { expect, test } from "@playwright/test";
import {
	ensureAdminUser,
	initializeDatabase,
	resetDatabaseForTests,
	seedSampleData,
	UserDB,
} from "../src/database.js";
import { withEnv } from "./helpers/env.js";

test.describe("Admin seed account persistence", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
	});

	test("admin account should exist after seedSampleData", async () => {
		// Arrange
		await resetDatabaseForTests();

		// Act
		await seedSampleData();

		// Assert
		const admin = await UserDB.getByEmail("admin@centrumrubacek.cz");
		expect(admin).toBeDefined();
		expect(admin?.role).toBe("admin");
	});

	test("admin account should survive resetDatabaseForTests", async () => {
		// Arrange - seed first
		await resetDatabaseForTests();
		await seedSampleData();

		// Act - reset again (simulates what tests do)
		await resetDatabaseForTests();

		// Assert - admin should still be there
		const admin = await UserDB.getByEmail("admin@centrumrubacek.cz");
		expect(admin).toBeDefined();
		expect(admin?.role).toBe("admin");
	});

	test("admin account should exist even when lessons already exist", async () => {
		// Arrange - seed to create lessons, then delete only users
		await resetDatabaseForTests();
		await seedSampleData();

		// Simulate the bug: lessons exist but users got wiped
		await client_deleteOnlyUsers();

		// Act - seed again (lessons count > 0, so old code would skip admin creation)
		await seedSampleData();

		// Assert - admin should be created regardless of lesson count
		const admin = await UserDB.getByEmail("admin@centrumrubacek.cz");
		expect(admin).toBeDefined();
	});
});

test.describe("Admin seed production gate", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("production without seed env vars skips admin seeding", async () => {
		await withEnv(
			{
				NODE_ENV: "production",
				ADMIN_EMAIL_SEED: undefined,
				ADMIN_PASSWORD_SEED: undefined,
			},
			async () => {
				await client_deleteOnlyUsers();

				await ensureAdminUser();

				const admin = await UserDB.getByEmail("admin@centrumrubacek.cz");
				expect(admin).toBeUndefined();
			},
		);
	});

	test("production with both seed env vars set seeds the admin", async () => {
		await withEnv(
			{
				NODE_ENV: "production",
				ADMIN_EMAIL_SEED: "prod-admin@example.com",
				ADMIN_PASSWORD_SEED: "prod-secret",
			},
			async () => {
				await client_deleteOnlyUsers();

				await ensureAdminUser();

				const admin = await UserDB.getByEmail("prod-admin@example.com");
				expect(admin).toBeDefined();
				expect(admin?.role).toBe("admin");
			},
		);
	});

	test("non-production keeps falling back to default credentials", async () => {
		await withEnv(
			{ ADMIN_EMAIL_SEED: undefined, ADMIN_PASSWORD_SEED: undefined },
			async () => {
				await client_deleteOnlyUsers();

				await ensureAdminUser();

				const admin = await UserDB.getByEmail("admin@centrumrubacek.cz");
				expect(admin).toBeDefined();
			},
		);
	});
});

/** Helper: delete only users to simulate the partial-wipe scenario */
async function client_deleteOnlyUsers() {
	const { client } = await import("../src/database.js");
	await client.execute({ sql: "DELETE FROM users", args: [] });
}
