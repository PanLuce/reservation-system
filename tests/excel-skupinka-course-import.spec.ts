import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";
import * as XLSX from "xlsx";
import {
	CourseDB,
	initializeDatabase,
	LessonDB,
	ParticipantDB,
	resetDatabaseForTests,
	RegistrationDB,
	UserDB,
} from "../src/database.js";
import { ExcelParticipantLoader } from "../src/excel-loader.js";
import { createParticipant } from "../src/participant.js";

const BASE = "http://localhost:3000";

function makeCoursesExcel(rows: Record<string, unknown>[]): ArrayBuffer {
	const ws = XLSX.utils.json_to_sheet(rows);
	const wb = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
	return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
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

function postFile(url: string, buffer: ArrayBuffer, cookie: string) {
	const form = new FormData();
	form.append(
		"file",
		new Blob([buffer], {
			type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		}),
		"courses.xlsx",
	);
	return fetch(url, {
		method: "POST",
		headers: { Cookie: cookie },
		body: form,
	});
}

test.describe.serial("Excel import → skupinky (courses)", () => {
	let adminCookie: string;

	test.beforeEach(async () => {
		process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
		process.env.ADMIN_PASSWORD_SEED = "admin123";
		await initializeDatabase();
		await resetDatabaseForTests();

		await UserDB.insert({
			id: "user_participant_course_import",
			email: "participant_courses@test.cz",
			passwordHash: await bcrypt.hash("pass", 10),
			name: "Test Participant",
			role: "participant",
		});

		adminCookie = await loginAsAdmin();
	});

	// ─── Parser unit tests (direct-import, no HTTP) ──────────────────────────

	test("parseCourseRowsFromBuffer: valid rows are parsed correctly", () => {
		const buffer = Buffer.from(
			makeCoursesExcel([
				{ name: "Skupinka A", ageGroup: "1 - 2 roky", color: "#FF6B6B" },
				{
					name: "Skupinka B",
					ageGroup: "2 - 3 roky",
					color: "#4CAF50",
					description: "Popis",
				},
			]),
		);
		const loader = new ExcelParticipantLoader();
		const { rows, errors } = loader.parseCourseRowsFromBuffer(buffer);
		expect(rows).toHaveLength(2);
		expect(errors).toHaveLength(0);
		expect(rows[0]!.name).toBe("Skupinka A");
		expect(rows[1]!.description).toBe("Popis");
	});

	test("parseCourseRowsFromBuffer: invalid color returns error, valid row passes", () => {
		const buffer = Buffer.from(
			makeCoursesExcel([
				{ name: "Valid", ageGroup: "1 - 2 roky", color: "#AABBCC" },
				{ name: "BadColor", ageGroup: "1 - 2 roky", color: "red" },
			]),
		);
		const loader = new ExcelParticipantLoader();
		const { rows, errors } = loader.parseCourseRowsFromBuffer(buffer);
		expect(rows).toHaveLength(1);
		expect(errors).toHaveLength(1);
		expect(errors[0]!.name).toBe("BadColor");
		expect(errors[0]!.error).toMatch(/Invalid color/);
	});

	test("parseCourseRowsFromBuffer: missing required column returns error", () => {
		const buffer = Buffer.from(
			makeCoursesExcel([{ name: "No age or color" }]),
		);
		const loader = new ExcelParticipantLoader();
		const { rows, errors } = loader.parseCourseRowsFromBuffer(buffer);
		expect(rows).toHaveLength(0);
		expect(errors).toHaveLength(1);
	});

	test("parseCourseRowsFromBuffer: lesson template columns are parsed when present", () => {
		const buffer = Buffer.from(
			makeCoursesExcel([
				{
					name: "With Lessons",
					ageGroup: "1 - 2 roky",
					color: "#112233",
					dayOfWeek: "Monday",
					time: "10:00",
					location: "Studio",
					capacity: 10,
					startDate: "2030-09-01",
					endDate: "2030-09-22",
				},
			]),
		);
		const loader = new ExcelParticipantLoader();
		const { rows } = loader.parseCourseRowsFromBuffer(buffer);
		expect(rows).toHaveLength(1);
		expect(rows[0]!.lessonTemplate).toBeDefined();
		expect(rows[0]!.lessonTemplate?.dayOfWeek).toBe("Monday");
	});

	// ─── HTTP integration tests ───────────────────────────────────────────────

	test("valid file creates two new courses in the DB", async () => {
		const buffer = makeCoursesExcel([
			{ name: "Nová skupinka A", ageGroup: "1 - 2 roky", color: "#AABBCC" },
			{ name: "Nová skupinka B", ageGroup: "2 - 3 roky", color: "#CCBBAA" },
		]);

		const res = await postFile(
			`${BASE}/api/admin/courses/import`,
			buffer,
			adminCookie,
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.processed).toBe(2);
		expect(data.perRow).toHaveLength(2);
		expect(data.perRow[0].ok).toBe(true);

		const courses = await CourseDB.getAll();
		const names = courses.map((c) => c.name);
		expect(names).toContain("Nová skupinka A");
		expect(names).toContain("Nová skupinka B");
	});

	test("invalid color row returns per-row error; valid rows still processed", async () => {
		const buffer = makeCoursesExcel([
			{ name: "Good Course", ageGroup: "1 - 2 roky", color: "#AABBCC" },
			{ name: "Bad Color", ageGroup: "1 - 2 roky", color: "notahex" },
		]);

		const res = await postFile(
			`${BASE}/api/admin/courses/import`,
			buffer,
			adminCookie,
		);
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.processed).toBe(1);
		const errRow = data.perRow.find((r: { ok: boolean }) => !r.ok);
		expect(errRow).toBeDefined();

		const courses = await CourseDB.getAll();
		expect(courses.some((c) => c.name === "Good Course")).toBe(true);
		expect(courses.some((c) => c.name === "Bad Color")).toBe(false);
	});

	test("re-uploading same course is idempotent — no duplicate", async () => {
		const buffer = makeCoursesExcel([
			{ name: "Idempotent Course", ageGroup: "1 - 2 roky", color: "#112233" },
		]);

		await postFile(`${BASE}/api/admin/courses/import`, buffer, adminCookie);
		await postFile(`${BASE}/api/admin/courses/import`, buffer, adminCookie);

		const courses = await CourseDB.getAll();
		const matches = courses.filter((c) => c.name === "Idempotent Course");
		expect(matches).toHaveLength(1);
	});

	test("lesson template columns create lessons and auto-enroll linked participant", async () => {
		// Pre-link a participant to verify auto-enroll
		const p = createParticipant({
			name: "AutoEnroll Test",
			email: "autoenroll@test.cz",
			phone: "",
			ageGroup: "1 - 2 roky",
		});
		await ParticipantDB.insert(p);

		const buffer = makeCoursesExcel([
			{
				name: "Lesson Template Course",
				ageGroup: "1 - 2 roky",
				color: "#AABBCC",
				dayOfWeek: "Monday",
				time: "10:00",
				location: "Studio",
				capacity: 10,
				startDate: "2030-09-01",
				endDate: "2030-09-22",
			},
		]);

		const res = await postFile(
			`${BASE}/api/admin/courses/import`,
			buffer,
			adminCookie,
		);
		expect(res.status).toBe(200);

		const courses = await CourseDB.getAll();
		const course = courses.find((c) => c.name === "Lesson Template Course");
		expect(course).toBeDefined();

		const lessons = await LessonDB.getByCourse(course!.id as string);
		expect(lessons.length).toBeGreaterThan(0);
		expect(lessons.every((l) => l.dayOfWeek === "Monday")).toBe(true);

		// Link participant AFTER course was created and verify re-upload triggers auto-enroll
		await ParticipantDB.linkToCourse(p.id, course!.id as string);
		const reUploadBuffer = makeCoursesExcel([
			{
				name: "Lesson Template Course",
				ageGroup: "1 - 2 roky",
				color: "#AABBCC",
				dayOfWeek: "Monday",
				time: "10:00",
				location: "Studio",
				capacity: 10,
				startDate: "2030-09-29",
				endDate: "2030-10-06",
			},
		]);
		await postFile(
			`${BASE}/api/admin/courses/import`,
			reUploadBuffer,
			adminCookie,
		);

		const regs = await RegistrationDB.getByParticipantId(p.id);
		const confirmed = regs.filter((r) => r.status === "confirmed");
		expect(confirmed.length).toBeGreaterThan(0);
	});

	test("participant role gets 403", async () => {
		const loginRes = await fetch(`${BASE}/api/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				email: "participant_courses@test.cz",
				password: "pass",
			}),
		});
		const participantCookie = loginRes.headers.get("set-cookie") ?? "";

		const buffer = makeCoursesExcel([
			{ name: "Hacker course", ageGroup: "1 - 2 roky", color: "#AABBCC" },
		]);
		const res = await postFile(
			`${BASE}/api/admin/courses/import`,
			buffer,
			participantCookie,
		);
		expect(res.status).toBe(403);
	});
});
