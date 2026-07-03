import { expect, test } from "@playwright/test";
import { createCourse } from "../src/course.js";
import {
	CourseDB,
	initializeDatabase,
	KurzDB,
	resetDatabaseForTests,
} from "../src/database.js";
import { createKurz } from "../src/kurz.js";

test.describe
	.serial("Course ↔ Kurz link", () => {
		test.beforeEach(async () => {
			await initializeDatabase();
			await resetDatabaseForTests();
		});

		test("a course can be created with a kurzId and reads it back", async () => {
			const kurz = createKurz({ name: "Batolata", ageGroup: "1 - 2 roky" });
			await KurzDB.insert(kurz);

			const course = createCourse({
				name: "Pondělí 10h",
				ageGroup: "1 - 2 roky",
				kurzId: kurz.id,
			});
			await CourseDB.insert(course);

			const retrieved = await CourseDB.getById(course.id);
			expect(retrieved?.kurzId).toBe(kurz.id);
		});

		test("a course created without a kurz has a null kurzId", async () => {
			const course = createCourse({
				name: "Bez kurzu",
				ageGroup: "1 - 2 roky",
			});
			await CourseDB.insert(course);

			const retrieved = await CourseDB.getById(course.id);
			expect(retrieved?.kurzId).toBeNull();
		});

		test("getByKurz returns only the courses linked to that kurz", async () => {
			const kurz = createKurz({ name: "Batolata", ageGroup: "1 - 2 roky" });
			await KurzDB.insert(kurz);

			const linked = createCourse({
				name: "Linked",
				ageGroup: "1 - 2 roky",
				kurzId: kurz.id,
			});
			const unlinked = createCourse({
				name: "Unlinked",
				ageGroup: "1 - 2 roky",
			});
			await CourseDB.insert(linked);
			await CourseDB.insert(unlinked);

			const inKurz = await CourseDB.getByKurz(kurz.id);
			expect(inKurz).toHaveLength(1);
			expect(inKurz[0]?.id).toBe(linked.id);
		});

		test("a course can be reassigned to another kurz via update", async () => {
			const kurzA = createKurz({ name: "Kurz A", ageGroup: "1 - 2 roky" });
			const kurzB = createKurz({ name: "Kurz B", ageGroup: "1 - 2 roky" });
			await KurzDB.insert(kurzA);
			await KurzDB.insert(kurzB);

			const course = createCourse({
				name: "Movable",
				ageGroup: "1 - 2 roky",
				kurzId: kurzA.id,
			});
			await CourseDB.insert(course);

			await CourseDB.update(course.id, { kurzId: kurzB.id });

			const retrieved = await CourseDB.getById(course.id);
			expect(retrieved?.kurzId).toBe(kurzB.id);
		});

		test("deleting a kurz sets its courses' kurzId to null (ON DELETE SET NULL)", async () => {
			const kurz = createKurz({ name: "Doomed", ageGroup: "1 - 2 roky" });
			await KurzDB.insert(kurz);

			const course = createCourse({
				name: "Orphan-to-be",
				ageGroup: "1 - 2 roky",
				kurzId: kurz.id,
			});
			await CourseDB.insert(course);

			await KurzDB.delete(kurz.id);

			const retrieved = await CourseDB.getById(course.id);
			expect(retrieved).toBeDefined();
			expect(retrieved?.kurzId).toBeNull();
		});
	});
