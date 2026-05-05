import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";
import * as XLSX from "xlsx";
import {
	CourseDB,
	initializeDatabase,
	resetDatabaseForTests,
	UserDB,
} from "../src/database.js";
import { parseOdsWorkbook } from "../src/ods-loader.js";

const BASE = "http://localhost:3000";

async function loginAs(email: string, password: string): Promise<string> {
	const res = await fetch(`${BASE}/api/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});
	return res.headers.get("set-cookie") ?? "";
}

// Build a minimal ODS/XLSX buffer with two sheets for fixture use
function makeTestOdsBuffer(): Buffer {
	const wb = XLSX.utils.book_new();

	// Sheet 1: 2 blocks
	const ws1Data = [
		// Block 1: title row, header row, 2 data rows, blank
		["Hýbeme se s Rubáčkem – CVČ Vietnamská", "", "", "", ""],
		["jméno", "rodič", "tel", "email", "datum narození"],
		["Tomáš Novák", "Jana Nováková", "777000001", "jana@test.cz", "2023-01-15"],
		["Eva Svoboda", "Petr Svoboda", "777000002", "petr@test.cz", "2022-06-10"],
		["", "", "", "", ""],
		// Block 2: another skupinka
		["Pohyb a radost – CVČ Vietnamská", "", "", "", ""],
		["jméno", "rodič", "tel", "email", "datum narození"],
		["Max Horák", "Lucie Horáková", "777000003", "lucie@test.cz", "2021-03-20"],
	];
	const ws1 = XLSX.utils.aoa_to_sheet(ws1Data);
	XLSX.utils.book_append_sheet(wb, ws1, "Přihlášení Vietnamská duben26");

	// Sheet 2: 1 block, different location
	const ws2Data = [
		["Cvičení pro nejmenší – DK Poklad", "", "", "", ""],
		["jméno", "rodič", "tel", "email", "datum narození"],
		[
			"Sofie Kratochvíl",
			"Martin Kratochvíl",
			"777000004",
			"martin@test.cz",
			"2023-08-01",
		],
	];
	const ws2 = XLSX.utils.aoa_to_sheet(ws2Data);
	XLSX.utils.book_append_sheet(wb, ws2, "Přihlášení DK Poklad duben26");

	return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// ─── Unit tests for parseOdsWorkbook ─────────────────────────────────────────

test.describe("parseOdsWorkbook — unit", () => {
	test("returns correct sheet count and names", () => {
		const buf = makeTestOdsBuffer();
		const result = parseOdsWorkbook(buf);
		expect(result.sheets).toHaveLength(2);
		expect(result.sheets[0]?.sheetName).toBe("Přihlášení Vietnamská duben26");
		expect(result.sheets[1]?.sheetName).toBe("Přihlášení DK Poklad duben26");
	});

	test("detects location from sheet name — Vietnamská", () => {
		const buf = makeTestOdsBuffer();
		const result = parseOdsWorkbook(buf);
		expect(result.sheets[0]?.detectedLocation).toBe("Vietnamská");
	});

	test("detects location from sheet name — DK Poklad", () => {
		const buf = makeTestOdsBuffer();
		const result = parseOdsWorkbook(buf);
		expect(result.sheets[1]?.detectedLocation).toBe("DK Poklad");
	});

	test("detects 2 blocks on the first sheet", () => {
		const buf = makeTestOdsBuffer();
		const result = parseOdsWorkbook(buf);
		expect(result.sheets[0]?.blocks).toHaveLength(2);
	});

	test("first block has correct title and 2 participants", () => {
		const buf = makeTestOdsBuffer();
		const result = parseOdsWorkbook(buf);
		const block = result.sheets[0]?.blocks[0];
		expect(block?.title).toContain("Vietnamská");
		expect(block?.rows).toHaveLength(2);
	});

	test("participant row has email extracted", () => {
		const buf = makeTestOdsBuffer();
		const result = parseOdsWorkbook(buf);
		const rows = result.sheets[0]?.blocks[0]?.rows ?? [];
		const emails = rows.map((r) => r.email);
		expect(emails).toContain("jana@test.cz");
		expect(emails).toContain("petr@test.cz");
	});

	test("second sheet has 1 block with 1 participant", () => {
		const buf = makeTestOdsBuffer();
		const result = parseOdsWorkbook(buf);
		const blocks = result.sheets[1]?.blocks ?? [];
		expect(blocks).toHaveLength(1);
		expect(blocks[0]?.rows).toHaveLength(1);
		expect(blocks[0]?.rows[0]?.email).toBe("martin@test.cz");
	});

	test("unknown sheet name → detectedLocation null", () => {
		const wb = XLSX.utils.book_new();
		const ws = XLSX.utils.aoa_to_sheet([
			["Skupinka – Neznámé Místo"],
			["jméno", "email"],
			["Test", "t@t.cz"],
		]);
		XLSX.utils.book_append_sheet(wb, ws, "Neznámý list");
		const buf = Buffer.from(
			XLSX.write(wb, { type: "buffer", bookType: "xlsx" }),
		);
		const result = parseOdsWorkbook(buf);
		expect(result.sheets[0]?.detectedLocation).toBeNull();
	});

	test("empty workbook returns empty sheets array", () => {
		const wb = XLSX.utils.book_new();
		const ws = XLSX.utils.aoa_to_sheet([]);
		XLSX.utils.book_append_sheet(wb, ws, "Empty");
		const buf = Buffer.from(
			XLSX.write(wb, { type: "buffer", bookType: "xlsx" }),
		);
		const result = parseOdsWorkbook(buf);
		expect(result.sheets[0]?.blocks).toHaveLength(0);
	});
});

// ─── HTTP endpoint tests ──────────────────────────────────────────────────────

test.describe
	.serial("ODS import endpoints", () => {
		let adminCookie: string;
		let participantCookie: string;

		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();

			await UserDB.insert({
				id: "ods_participant",
				email: "participant@ods.cz",
				passwordHash: await bcrypt.hash("pass", 10),
				name: "P",
				role: "participant",
			});

			adminCookie = await loginAs("admin@centrumrubacek.cz", "admin123");
			participantCookie = await loginAs("participant@ods.cz", "pass");
		});

		// --- preview ---

		test("POST /api/admin/participants-import/preview returns flat candidates without touching DB", async () => {
			const buf = makeTestOdsBuffer();
			const form = new FormData();
			form.append(
				"file",
				new Blob(
					[
						buf.buffer.slice(
							buf.byteOffset,
							buf.byteOffset + buf.byteLength,
						) as ArrayBuffer,
					],
					{
						type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					},
				),
				"test.xlsx",
			);

			const res = await fetch(`${BASE}/api/admin/participants-import/preview`, {
				method: "POST",
				headers: { Cookie: adminCookie },
				body: form,
			});

			expect(res.status).toBe(200);
			const data = (await res.json()) as {
				sheets: {
					sheetName: string;
					detectedLocation: string | null;
					candidates: { kidName: string; parentEmail: string }[];
				}[];
			};
			expect(Array.isArray(data.sheets)).toBe(true);
			// test workbook has 2 sheets: sheet1 (3 candidates), sheet2 (1 candidate)
			expect(data.sheets).toHaveLength(2);
			expect(data.sheets[0]?.candidates).toHaveLength(3);
			expect(data.sheets[1]?.candidates).toHaveLength(1);
			expect(data.sheets[0]?.candidates[0]).toHaveProperty("kidName");
			expect(data.sheets[0]?.candidates[0]).toHaveProperty("parentEmail");

			// DB untouched
			const courses = await CourseDB.getAll();
			expect(courses).toHaveLength(0);
		});

		test("preview blocked for participants — 403", async () => {
			const buf = makeTestOdsBuffer();
			const form = new FormData();
			form.append(
				"file",
				new Blob([
					buf.buffer.slice(
						buf.byteOffset,
						buf.byteOffset + buf.byteLength,
					) as ArrayBuffer,
				]),
				"test.xlsx",
			);

			const res = await fetch(`${BASE}/api/admin/participants-import/preview`, {
				method: "POST",
				headers: { Cookie: participantCookie },
				body: form,
			});
			expect(res.status).toBe(403);
		});

		test("preview with no file — 400", async () => {
			const res = await fetch(`${BASE}/api/admin/participants-import/preview`, {
				method: "POST",
				headers: { Cookie: adminCookie },
				body: new FormData(),
			});
			expect(res.status).toBe(400);
		});

		test("commit blocked for participants — 403", async () => {
			const res = await fetch(`${BASE}/api/admin/participants-import/commit`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: participantCookie,
				},
				body: JSON.stringify({
					courseId: "x",
					candidates: [{ kidName: "X", parentEmail: "x@x.cz" }],
				}),
			});
			expect(res.status).toBe(403);
		});
	});
