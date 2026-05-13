import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./smoke",
	fullyParallel: false,
	workers: 1,
	retries: 1,
	reporter: [["list"]],
	use: {
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
