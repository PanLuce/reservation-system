import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";
import {
	CourseDB,
	initializeDatabase,
	resetDatabaseForTests,
} from "../src/database.js";
import { createCourse } from "../src/course.js";

const BASE = "http://localhost:3000";

async function loginAsAdmin(page: import("@playwright/test").Page) {
	await page.goto(`${BASE}/login.html`);
	await page.fill("#login-email", "admin@centrumrubacek.cz");
	await page.fill("#login-password", "admin123");
	await page.click('button[type="submit"]');
	await page.waitForURL(`${BASE}/`, { timeout: 10000 });
	await page.waitForSelector("#calendar-grid", { timeout: 10000 });
}

function makeMinimalXlsxBuffer(): Buffer {
	const wb = XLSX.utils.book_new();
	const ws = XLSX.utils.aoa_to_sheet([
		["Skupinka test – CVČ Vietnamská", "", "", "", ""],
		["jméno", "rodič", "tel", "email", "datum narození"],
		["Anička Nováková", "Jana Nováková", "777000001", "jana.nova@test.cz", "2023-01-15"],
	]);
	XLSX.utils.book_append_sheet(wb, ws, "Test sheet");
	return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

test.describe("REQ-3: Import summary modal", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();
		await CourseDB.insert(
			createCourse({ name: "Test skupinka", ageGroup: "1 - 2 roky" }),
		);
	});

	test("info-modal element exists in the DOM", async ({ page }) => {
		await loginAsAdmin(page);
		await expect(page.locator("#info-modal")).toBeAttached();
	});

	test("modal appears with import summary after a successful import", async ({
		page,
	}) => {
		await loginAsAdmin(page);

		// Navigate to import tab
		await page.click('[data-tab="excel"]');
		await expect(page.locator("#ods-step1")).toBeVisible();

		// Upload test file
		const xlsxBuffer = makeMinimalXlsxBuffer();
		await page.locator("#ods-file-input").setInputFiles({
			name: "test-import.xlsx",
			mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			buffer: xlsxBuffer,
		});
		await page.click('#ods-step1 button[type="submit"]');

		// Step 2: sheet picker appears (even for single-sheet files)
		await expect(page.locator("#ods-step-sheet")).toBeVisible({ timeout: 8000 });
		await page.click('[data-sheet-index="0"]');

		// Wait for step 3 (candidates) to appear
		await expect(page.locator("#ods-step2")).toBeVisible({ timeout: 8000 });

		// Select the first candidate
		const firstCheckbox = page.locator("#ods-candidate-0");
		await expect(firstCheckbox).toBeVisible({ timeout: 5000 });
		await firstCheckbox.check();

		// Select a skupinka
		const courseSelect = page.locator("#ods-target-course");
		await expect(courseSelect).toBeVisible();
		await courseSelect.selectOption({ index: 1 });

		// Submit import
		await page.click('button[onclick="submitOdsImport(this)"]');

		// Assert: modal is visible with import summary
		await expect(page.locator("#info-modal")).toBeVisible({ timeout: 8000 });
		await expect(page.locator("#info-modal-body")).toContainText("Importováno");
	});

	test("modal closes when OK is clicked", async ({ page }) => {
		await loginAsAdmin(page);

		// Directly show the modal via JS to test close behavior
		await page.evaluate(() => {
			const modal = document.getElementById("info-modal") as HTMLElement;
			if (modal) modal.style.display = "flex";
		});

		await expect(page.locator("#info-modal")).toBeVisible();

		await page.click("#info-modal-close");

		await expect(page.locator("#info-modal")).toBeHidden();
	});
});
