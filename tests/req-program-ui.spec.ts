import { expect, test } from "@playwright/test";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	ensureDemoParticipant,
	initializeDatabase,
	ProgramDB,
	resetDatabaseForTests,
} from "../src/database.js";
import { createProgram } from "../src/program.js";

const BASE = "http://localhost:3000";

async function loginAsAdmin(page: import("@playwright/test").Page) {
	await page.goto(`${BASE}/login.html`);
	await page.fill("#login-email", "admin@centrumrubacek.cz");
	await page.fill("#login-password", "admin123");
	await page.click('button[type="submit"]');
	await page.waitForURL(`${BASE}/`, { timeout: 10000 });
	await page.waitForSelector("#calendar-grid", { timeout: 10000 });
}

async function openSkupinkyTab(page: import("@playwright/test").Page) {
	await page.click('[data-tab="courses"]');
	await page.waitForSelector("#courses-list", { timeout: 5000 });
}

test.describe
	.serial("REQ: Program grouping in the Skupinky tab", () => {
		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			process.env.PARTICIPANT_EMAIL_SEED = "maminka@test.cz";
			process.env.PARTICIPANT_PASSWORD_SEED = "test123";
			await initializeDatabase();
			await resetDatabaseForTests();
			await ensureDemoParticipant();
		});

		test("admin sees the '+ Přidat kurz' button in the Skupinky tab", async ({
			page,
		}) => {
			await loginAsAdmin(page);
			await openSkupinkyTab(page);

			await expect(
				page.locator("button").filter({ hasText: "Přidat kurz" }),
			).toBeVisible();
		});

		test("a Skupinka linked to a Program renders under that Program's section header", async ({
			page,
		}) => {
			const program = createProgram({
				name: "Cvičení s batolaty",
				ageGroup: "1 - 2 roky",
			});
			await ProgramDB.insert(program);
			const course = createCourse({
				name: "Pondělí 10h",
				ageGroup: "1 - 2 roky",
				location: "Studio",
				programId: program.id,
			});
			await CourseDB.insert(course);

			await loginAsAdmin(page);
			await openSkupinkyTab(page);

			const section = page.locator(
				`.program-section[data-program-id="${program.id}"]`,
			);
			await expect(section).toBeVisible();
			await expect(section).toContainText("Cvičení s batolaty");
			await expect(section.locator(`#course-card-${course.id}`)).toBeVisible();
		});

		test("an unassigned Skupinka renders under the 'Bez kurzu' section", async ({
			page,
		}) => {
			const course = createCourse({
				name: "Osamělá skupinka",
				ageGroup: "1 - 2 roky",
				location: "Studio",
			});
			await CourseDB.insert(course);

			await loginAsAdmin(page);
			await openSkupinkyTab(page);

			const section = page.locator('.program-section[data-program-id="none"]');
			await expect(section).toBeVisible();
			await expect(section).toContainText("Bez kurzu");
			await expect(section.locator(`#course-card-${course.id}`)).toBeVisible();
		});

		test("creating a Program via the form makes it appear as a section", async ({
			page,
		}) => {
			await loginAsAdmin(page);
			await openSkupinkyTab(page);

			await page.locator("button").filter({ hasText: "Přidat kurz" }).click();
			await page.waitForSelector("#add-program-form", { state: "visible" });
			await page.fill("#program-name", "Nový kurz UI");
			await page.selectOption("#program-age-group", "1 - 2 roky");
			await page.locator("#add-program-form button[type='submit']").click();

			await expect(
				page.locator(".program-section").filter({ hasText: "Nový kurz UI" }),
			).toBeVisible({ timeout: 5000 });
		});
	});
