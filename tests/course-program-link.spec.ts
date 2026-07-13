import { expect, test } from "@playwright/test";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	ProgramDB,
	resetDatabaseForTests,
} from "../src/database.js";
import { createProgram } from "../src/program.js";

test.describe
	.serial("Course ↔ Program link", () => {
		test.beforeEach(async () => {
			await initializeDatabase();
			await resetDatabaseForTests();
		});

		test("a course can be created with a programId and reads it back", async () => {
			const program = createProgram({
				name: "Batolata",
				ageGroup: "1 - 2 roky",
			});
			await ProgramDB.insert(program);

			const course = createCourse({
				name: "Pondělí 10h",
				ageGroup: "1 - 2 roky",
				programId: program.id,
			});
			await CourseDB.insert(course);

			const retrieved = await CourseDB.getById(course.id);
			expect(retrieved?.programId).toBe(program.id);
		});

		test("a course created without a program has a null programId", async () => {
			const course = createCourse({
				name: "Bez kurzu",
				ageGroup: "1 - 2 roky",
			});
			await CourseDB.insert(course);

			const retrieved = await CourseDB.getById(course.id);
			expect(retrieved?.programId).toBeNull();
		});

		test("getByProgram returns only the courses linked to that program", async () => {
			const program = createProgram({
				name: "Batolata",
				ageGroup: "1 - 2 roky",
			});
			await ProgramDB.insert(program);

			const linked = createCourse({
				name: "Linked",
				ageGroup: "1 - 2 roky",
				programId: program.id,
			});
			const unlinked = createCourse({
				name: "Unlinked",
				ageGroup: "1 - 2 roky",
			});
			await CourseDB.insert(linked);
			await CourseDB.insert(unlinked);

			const inProgram = await CourseDB.getByProgram(program.id);
			expect(inProgram).toHaveLength(1);
			expect(inProgram[0]?.id).toBe(linked.id);
		});

		test("a course can be reassigned to another program via update", async () => {
			const programA = createProgram({
				name: "Kurz A",
				ageGroup: "1 - 2 roky",
			});
			const programB = createProgram({
				name: "Kurz B",
				ageGroup: "1 - 2 roky",
			});
			await ProgramDB.insert(programA);
			await ProgramDB.insert(programB);

			const course = createCourse({
				name: "Movable",
				ageGroup: "1 - 2 roky",
				programId: programA.id,
			});
			await CourseDB.insert(course);

			await CourseDB.update(course.id, { programId: programB.id });

			const retrieved = await CourseDB.getById(course.id);
			expect(retrieved?.programId).toBe(programB.id);
		});

		test("deleting a program sets its courses' programId to null (ON DELETE SET NULL)", async () => {
			const program = createProgram({ name: "Doomed", ageGroup: "1 - 2 roky" });
			await ProgramDB.insert(program);

			const course = createCourse({
				name: "Orphan-to-be",
				ageGroup: "1 - 2 roky",
				programId: program.id,
			});
			await CourseDB.insert(course);

			await ProgramDB.delete(program.id);

			const retrieved = await CourseDB.getById(course.id);
			expect(retrieved).toBeDefined();
			expect(retrieved?.programId).toBeNull();
		});
	});
