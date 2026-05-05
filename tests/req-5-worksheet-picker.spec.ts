import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	resetDatabaseForTests,
} from "../src/database.js";

const BASE = "http://localhost:3000";

async function loginAsAdmin(page: import("@playwright/test").Page) {
	await page.goto(`${BASE}/login.html`);
	await page.fill("#login-email", "admin@centrumrubacek.cz");
	await page.fill("#login-password", "admin123");
	await page.click('button[type="submit"]');
	await page.waitForURL(`${BASE}/`, { timeout: 10000 });
	await page.waitForSelector("#calendar-grid", { timeout: 10000 });
}

function makeTwoSheetXlsxBuffer(): Buffer {
	const wb = XLSX.utils.book_new();

	const ws1 = XLSX.utils.aoa_to_sheet([
		["Cvičení – CVČ Vietnamská", "", "", "", ""],
		["jméno", "rodič", "tel", "email", "datum narození"],
		[
			"Anička Sheet1",
			"Jana Nováková",
			"777000001",
			"sheet1@test.cz",
			"2023-01-15",
		],
	]);
	XLSX.utils.book_append_sheet(wb, ws1, "List Vietnamská");

	const ws2 = XLSX.utils.aoa_to_sheet([
		["Cvičení – DK Poklad", "", "", "", ""],
		["jméno", "rodič", "tel", "email", "datum narození"],
		["Bobík Sheet2", "Petr Novák", "777000002", "sheet2@test.cz", "2022-06-10"],
	]);
	XLSX.utils.book_append_sheet(wb, ws2, "List DK Poklad");

	return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

test.describe("REQ-5: Worksheet picker step in import flow", () => {
	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();
		await CourseDB.insert(
			createCourse({ name: "Test skupinka", ageGroup: "1 - 2 roky" }),
		);
	});

	test("sheet picker step appears after uploading a multi-sheet file", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await page.click('[data-tab="excel"]');
		await expect(page.locator("#ods-step1")).toBeVisible();

		const buf = makeTwoSheetXlsxBuffer();
		await page.locator("#ods-file-input").setInputFiles({
			name: "two-sheets.xlsx",
			mimeType:
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			buffer: buf,
		});
		await page.click('#ods-step1 button[type="submit"]');

		// Sheet picker must appear
		await expect(page.locator("#ods-step-sheet")).toBeVisible({
			timeout: 8000,
		});

		// Both sheet names must be listed
		await expect(page.locator("#ods-step-sheet")).toContainText(
			"List Vietnamská",
		);
		await expect(page.locator("#ods-step-sheet")).toContainText(
			"List DK Poklad",
		);

		// Candidate step must still be hidden
		await expect(page.locator("#ods-step2")).toBeHidden();
	});

	test("selecting a sheet shows only that sheet's candidates in step 3", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await page.click('[data-tab="excel"]');

		const buf = makeTwoSheetXlsxBuffer();
		await page.locator("#ods-file-input").setInputFiles({
			name: "two-sheets.xlsx",
			mimeType:
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			buffer: buf,
		});
		await page.click('#ods-step1 button[type="submit"]');
		await expect(page.locator("#ods-step-sheet")).toBeVisible({
			timeout: 8000,
		});

		// Pick the second sheet (DK Poklad)
		await page.click('[data-sheet-index="1"]');

		// Step 3 candidates must appear
		await expect(page.locator("#ods-step2")).toBeVisible({ timeout: 5000 });

		// Only sheet 2's candidate must appear; sheet1 must not
		// Names are in <input> value attributes, check via locator
		await expect(page.locator("#ods-kidname-0")).toHaveValue("Bobík Sheet2");
		await expect(page.locator("#ods-kidname-0")).not.toHaveValue(
			"Anička Sheet1",
		);
	});

	test("full import flow with worksheet picker produces success modal", async ({
		page,
	}) => {
		await loginAsAdmin(page);
		await page.click('[data-tab="excel"]');

		const buf = makeTwoSheetXlsxBuffer();
		await page.locator("#ods-file-input").setInputFiles({
			name: "two-sheets.xlsx",
			mimeType:
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			buffer: buf,
		});
		await page.click('#ods-step1 button[type="submit"]');
		await expect(page.locator("#ods-step-sheet")).toBeVisible({
			timeout: 8000,
		});

		// Pick first sheet
		await page.click('[data-sheet-index="0"]');
		await expect(page.locator("#ods-step2")).toBeVisible({ timeout: 5000 });

		// Check first candidate and assign skupinka
		const firstCheckbox = page.locator("#ods-candidate-0");
		await expect(firstCheckbox).toBeVisible({ timeout: 5000 });
		await firstCheckbox.check();

		const courseSelect = page.locator("#ods-target-course");
		await expect(courseSelect).toBeVisible();
		await courseSelect.selectOption({ index: 1 });

		await page.click('button[onclick="submitOdsImport(this)"]');

		await expect(page.locator("#info-modal")).toBeVisible({ timeout: 8000 });
		await expect(page.locator("#info-modal-body")).toContainText("Importováno");
	});
});
