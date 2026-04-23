import { defineConfig, devices } from "@playwright/test";

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
			ADMIN_EMAIL_SEED: "admin@centrumrubacek.cz",
			ADMIN_PASSWORD_SEED: "admin123",
			PARTICIPANT_EMAIL_SEED: "maminka@test.cz",
			PARTICIPANT_PASSWORD_SEED: "test123",
			ENABLE_QUICK_LOGIN: "true",
		},
	},
});
