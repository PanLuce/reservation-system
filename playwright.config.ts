import { defineConfig, devices } from "@playwright/test";

// Force a dedicated test database no matter what the shell has exported —
// specs import src/database.js directly in this process and would otherwise
// wipe the dev DB (or production, if a Turso URL leaked into the shell).
const TEST_DATABASE_URL = "file:./data/test.db";
process.env.TURSO_DATABASE_URL = TEST_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: 1,
	reporter: "html",
	use: {
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	// Start the development server before running tests
	webServer: {
		command: "npm start",
		port: 3000,
		timeout: 120 * 1000,
		reuseExistingServer: !process.env.CI,
		env: {
			TURSO_DATABASE_URL: TEST_DATABASE_URL,
			TURSO_AUTH_TOKEN: "",
			// Explicit NODE_ENV so a production value exported in the developer's
			// shell cannot disable the seeding the specs depend on.
			NODE_ENV: "test",
			// Quick-login endpoint is opt-in; specs cover its enabled path.
			ENABLE_QUICK_LOGIN: "true",
			ADMIN_EMAIL_SEED: "admin@centrumrubacek.cz",
			ADMIN_PASSWORD_SEED: "admin123",
			PARTICIPANT_EMAIL_SEED: "maminka@test.cz",
			PARTICIPANT_PASSWORD_SEED: "test123",
			// Blank SMTP_HOST forces NoOpEmailService (src/email-factory.ts) so
			// tests never depend on a live SMTP server — Ethereal rate limiting
			// (429) was causing flaky failures in registration-heavy specs.
			SMTP_HOST: "",
		},
	},
});
