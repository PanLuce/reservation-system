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

function makeXlsxBuffer(
	rows: { kidName: string; parentEmail: string }[],
): Buffer {
	const wb = XLSX.utils.book_new();
	const data = [
		["jméno", "email"],
		...rows.map((r) => [r.kidName, r.parentEmail]),
	];
	XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(data), "Import");
	return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

function toBlob(buf: Buffer): Blob {
	return new Blob(
		[
			buf.buffer.slice(
				buf.byteOffset,
				buf.byteOffset + buf.byteLength,
			) as ArrayBuffer,
		],
		{
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		},
	);
}

test.describe
	.serial("POST /api/admin/participants-import/preview — new flat format", () => {
		let adminCookie: string;

		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();
			adminCookie = await loginAsAdmin();
		});

		test("returns flat candidates list with kidName and parentEmail", async () => {
			const buf = makeXlsxBuffer([
				{ kidName: "Tomáš Novák", parentEmail: "jana@test.cz" },
				{ kidName: "Eva Svoboda", parentEmail: "petr@test.cz" },
			]);
			const form = new FormData();
			form.append("file", toBlob(buf), "test.xlsx");

			const res = await fetch(`${BASE}/api/admin/participants-import/preview`, {
				method: "POST",
				headers: { Cookie: adminCookie },
				body: form,
			});

			expect(res.status).toBe(200);
			const data = (await res.json()) as {
				candidates: { kidName: string; parentEmail: string }[];
			};
			expect(Array.isArray(data.candidates)).toBe(true);
			expect(data.candidates).toHaveLength(2);
			expect(data.candidates[0]).toHaveProperty("kidName");
			expect(data.candidates[0]).toHaveProperty("parentEmail");
			expect(data.candidates.map((c) => c.parentEmail)).toContain(
				"jana@test.cz",
			);
		});

		test("does not write to DB", async () => {
			const buf = makeXlsxBuffer([
				{ kidName: "Test Kid", parentEmail: "test@preview.cz" },
			]);
			const form = new FormData();
			form.append("file", toBlob(buf), "test.xlsx");

			await fetch(`${BASE}/api/admin/participants-import/preview`, {
				method: "POST",
				headers: { Cookie: adminCookie },
				body: form,
			});

			const all = await ParticipantDB.getAll();
			expect(all).toHaveLength(0);
		});
	});

test.describe
	.serial("POST /api/admin/participants-import/commit — new courseId-based format", () => {
		let adminCookie: string;
		let courseId: string;

		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();
			adminCookie = await loginAsAdmin();

			const course = createCourse({
				name: "Skupinka A",
				ageGroup: "1 - 2 roky",
				color: "#FF6B6B",
			});
			await CourseDB.insert(course);
			courseId = course.id;
		});

		test("creates new participants and links them to the existing skupinka", async () => {
			const res = await fetch(`${BASE}/api/admin/participants-import/commit`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({
					courseId,
					candidates: [
						{ kidName: "Tomáš Novák", parentEmail: "jana@test.cz" },
						{ kidName: "Eva Svoboda", parentEmail: "petr@test.cz" },
					],
				}),
			});

			expect(res.status).toBe(200);
			const data = (await res.json()) as { created: number; processed: number };
			expect(data.created).toBe(2);
			expect(data.processed).toBe(2);

			const members = await ParticipantDB.getByCourse(courseId);
			expect(members).toHaveLength(2);
		});

		test("creates two separate participants for same email with different kid names", async () => {
			const res = await fetch(`${BASE}/api/admin/participants-import/commit`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({
					courseId,
					candidates: [
						{ kidName: "KidA Máma", parentEmail: "mama@test.cz" },
						{ kidName: "KidB Máma", parentEmail: "mama@test.cz" },
					],
				}),
			});

			expect(res.status).toBe(200);
			const data = (await res.json()) as { created: number };
			expect(data.created).toBe(2);

			const all = await ParticipantDB.getAll();
			const mamaRows = all.filter(
				(p) => (p as Record<string, unknown>).email === "mama@test.cz",
			);
			expect(mamaRows).toHaveLength(2);
		});

		test("is idempotent for same (kidName, parentEmail) pair — no duplicates on re-import", async () => {
			const payload = {
				courseId,
				candidates: [{ kidName: "Tomáš Novák", parentEmail: "jana@test.cz" }],
			};

			await fetch(`${BASE}/api/admin/participants-import/commit`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify(payload),
			});
			const res2 = await fetch(`${BASE}/api/admin/participants-import/commit`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify(payload),
			});

			expect(res2.status).toBe(200);
			const data = (await res2.json()) as { skipped: number };
			expect(data.skipped).toBe(1);

			const all = await ParticipantDB.getAll();
			const rows = all.filter(
				(p) => (p as Record<string, unknown>).email === "jana@test.cz",
			);
			expect(rows).toHaveLength(1);
		});

		test("returns 400 when courseId does not exist — no silent course creation", async () => {
			const res = await fetch(`${BASE}/api/admin/participants-import/commit`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({
					courseId: "does-not-exist",
					candidates: [{ kidName: "Test Kid", parentEmail: "t@t.cz" }],
				}),
			});

			expect(res.status).toBe(400);

			// No course should have been created
			const courses = await CourseDB.getAll();
			expect(courses).toHaveLength(1); // only the pre-seeded one
		});

		test("returns 400 when courseId is missing", async () => {
			const res = await fetch(`${BASE}/api/admin/participants-import/commit`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({
					candidates: [{ kidName: "Test", parentEmail: "t@t.cz" }],
				}),
			});
			expect(res.status).toBe(400);
		});

		test("returns 400 when candidates is missing or empty", async () => {
			const res = await fetch(`${BASE}/api/admin/participants-import/commit`, {
				method: "POST",
				headers: { "Content-Type": "application/json", Cookie: adminCookie },
				body: JSON.stringify({ courseId, candidates: [] }),
			});
			expect(res.status).toBe(400);
		});
	});
