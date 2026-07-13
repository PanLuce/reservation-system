import { defineConfig, devices } from "@playwright/test";

// Force a dedicated test database no matter what the shell has exported —
// specs import src/database.js directly in this process and would otherwise
// wipe the dev DB (or production, if a Turso URL leaked into the shell).
const TEST_DATABASE_URL = "file:./data/test.db";
process.env.TURSO_DATABASE_URL = TEST_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
// The test-runner process (which imports src/database.js directly) must be in
// test mode so its in-process client resolves to the same per-worker file
// (file:./data/test-<TEST_PARALLEL_INDEX>.db) that the webServer opens. Without
// this the runner stays on the shared test.db while the server uses test-0.db,
// so seeded data is invisible over HTTP. Workers inherit this env.
process.env.NODE_ENV = "test";

// One worker == one parallel slot == one app server on its own port and its own
// SQLite file. Keep WORKERS and the webServer array length in lockstep: a worker
// whose TEST_PARALLEL_INDEX has no matching server would get connection-refused.
const WORKERS = process.env.CI ? 2 : 4;

// Env shared by every per-slot server. PORT and the per-slot database file are
// added per entry below.
const serverEnv = {
	TURSO_AUTH_TOKEN: "",
	// Explicit NODE_ENV so a production value exported in the developer's shell
	// cannot disable the seeding the specs depend on.
	NODE_ENV: "test",
	// Quick-login endpoint is opt-in; specs cover its enabled path.
	ENABLE_QUICK_LOGIN: "true",
	ADMIN_EMAIL_SEED: "admin@centrumrubacek.cz",
	ADMIN_PASSWORD_SEED: "admin123",
	PARTICIPANT_EMAIL_SEED: "maminka@test.cz",
	PARTICIPANT_PASSWORD_SEED: "test123",
	// Blank SMTP_HOST forces NoOpEmailService (src/email-factory.ts) so tests
	// never depend on a live SMTP server — Ethereal rate limiting (429) was
	// causing flaky failures in registration-heavy specs.
	SMTP_HOST: "",
};

export default defineConfig({
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: WORKERS,
	reporter: "html",
	// Wipe stale per-slot databases (and their WAL/SHM) once before the run.
	use: {
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
	// One server per parallel slot. Slot i listens on port 3000+i and owns
	// file:./data/test-i.db — the same port (see tests/helpers/base.ts) and file
	// (see perWorkerTestDatabaseUrl) the worker with TEST_PARALLEL_INDEX=i resolves
	// to, so the worker's in-process writes and its HTTP calls hit one database.
	webServer: Array.from({ length: WORKERS }, (_, slot) => ({
		command: "npm start",
		port: 3000 + slot,
		timeout: 120 * 1000,
		reuseExistingServer: !process.env.CI,
		env: {
			...serverEnv,
			PORT: String(3000 + slot),
			TURSO_DATABASE_URL: `file:./data/test-${slot}.db`,
		},
	})),
});
