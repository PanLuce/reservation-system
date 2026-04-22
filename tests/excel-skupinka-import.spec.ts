import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";
import * as XLSX from "xlsx";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	ParticipantDB,
	resetDatabaseForTests,
	UserDB,
} from "../src/database.js";

const BASE = "http://localhost:3000";

function makeExcelBytes(rows: Record<string, unknown>[]): ArrayBuffer {
	const ws = XLSX.utils.json_to_sheet(rows);
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
	const result = XLSX.write(wb, {
		type: "array",
		bookType: "xlsx",
	}) as ArrayBuffer;
	return result;
}

async function loginAsAdmin(): Promise<string> {
	const res = await fetch(`${BASE}/api/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			email: "admin@centrumrubacek.cz",
			password: "admin123",
		}),
	});
	return res.headers.get("set-cookie") ?? "";
}

test.describe
	.serial("Excel import → skupinka", () => {
		let adminCookie: string;
		let courseA: Awaited<ReturnType<typeof createCourse>>;
		let courseB: Awaited<ReturnType<typeof createCourse>>;

		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();

			await UserDB.insert({
				id: "participant_excel_test",
				email: "participant_excel@example.com",
				passwordHash: await bcrypt.hash("pass123", 10),
				name: "Participant",
				role: "participant",
			});

			courseA = createCourse({
				name: "3-6 měsíců, Vietnamská",
				ageGroup: "6-9 měsíců (do lezení)",
				color: "#FF6B6B",
			});
			courseB = createCourse({
				name: "1-2 roky, Poklad",
				ageGroup: "1 - 2 roky",
				color: "#4CAF50",
			});
			await CourseDB.insert(courseA);
			await CourseDB.insert(courseB);

			adminCookie = await loginAsAdmin();
		});

		test("valid file links participants to their skupinky and returns per-row results", async () => {
			const buffer = makeExcelBytes([
				{
					name: "Jana Nováková",
					email: "jana@example.cz",
					skupinka: courseA.name,
				},
				{
					name: "Petr Svoboda",
					email: "petr@example.cz",
					skupinka: courseB.name,
				},
			]);

			const form = new FormData();
			form.append(
				"file",
				new Blob([buffer], {
					type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				}),
				"test.xlsx",
			);

			const res = await fetch(`${BASE}/api/excel/import`, {
				method: "POST",
				headers: { Cookie: adminCookie },
				body: form,
			});

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.results).toHaveLength(2);
			expect(data.results[0].ok).toBe(true);
			expect(data.results[1].ok).toBe(true);

			// Verify participants were linked to courses
			const membersA = await ParticipantDB.getByCourse(courseA.id);
			const membersB = await ParticipantDB.getByCourse(courseB.id);
			expect(membersA).toHaveLength(1);
			expect(membersA[0]!.email).toBe("jana@example.cz");
			expect(membersB).toHaveLength(1);
			expect(membersB[0]!.email).toBe("petr@example.cz");
		});

		test("unknown skupinka returns per-row error; other rows still processed", async () => {
			const buffer = makeExcelBytes([
				{ name: "Jana", email: "jana2@example.cz", skupinka: courseA.name },
				{
					name: "Ghost",
					email: "ghost@example.cz",
					skupinka: "Neexistující skupinka",
				},
			]);

			const form = new FormData();
			form.append(
				"file",
				new Blob([buffer], {
					type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				}),
				"test.xlsx",
			);

			const res = await fetch(`${BASE}/api/excel/import`, {
				method: "POST",
				headers: { Cookie: adminCookie },
				body: form,
			});

			expect(res.status).toBe(200);
			const data = await res.json();
			expect(data.results).toHaveLength(2);
			expect(data.results[0].ok).toBe(true);
			expect(data.results[1].ok).toBe(false);
			expect(data.results[1].error).toMatch(/skupinka/i);

			const membersA = await ParticipantDB.getByCourse(courseA.id);
			expect(membersA).toHaveLength(1);
		});

		test("re-uploading the same row is idempotent — no duplicate link", async () => {
			const buffer = makeExcelBytes([
				{
					name: "Jana",
					email: "idempotent@example.cz",
					skupinka: courseA.name,
				},
			]);

			const makeForm = () => {
				const form = new FormData();
				form.append(
					"file",
					new Blob([buffer], {
						type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
					}),
					"test.xlsx",
				);
				return form;
			};

			await fetch(`${BASE}/api/excel/import`, {
				method: "POST",
				headers: { Cookie: adminCookie },
				body: makeForm(),
			});
			await fetch(`${BASE}/api/excel/import`, {
				method: "POST",
				headers: { Cookie: adminCookie },
				body: makeForm(),
			});

			const members = await ParticipantDB.getByCourse(courseA.id);
			expect(members).toHaveLength(1);
		});

		test("participant role gets 403", async () => {
			const loginRes = await fetch(`${BASE}/api/auth/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: "participant_excel@example.com",
					password: "pass123",
				}),
			});
			const participantCookie = loginRes.headers.get("set-cookie") ?? "";

			const buffer = makeExcelBytes([
				{ name: "Jana", email: "jana@example.cz", skupinka: courseA.name },
			]);
			const form = new FormData();
			form.append(
				"file",
				new Blob([buffer], {
					type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				}),
				"test.xlsx",
			);

			const res = await fetch(`${BASE}/api/excel/import`, {
				method: "POST",
				headers: { Cookie: participantCookie },
				body: form,
			});
			expect(res.status).toBe(403);
		});
	});
