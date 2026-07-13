import { expect, test } from "@playwright/test";
import { initializeDatabase, ProgramDB } from "../src/database.js";
import { createProgram, type Program } from "../src/program.js";

test.describe("Program factory - TDD", () => {
	test("should create a program with valid data", () => {
		const program: Program = createProgram({
			name: "Cvičení s batolaty",
			ageGroup: "1 - 2 roky",
			color: "#4CAF50",
			description: "Kurz pro batolata",
		});

		expect(program).toBeDefined();
		expect(program.id).toMatch(/^program_/);
		expect(program.name).toBe("Cvičení s batolaty");
		expect(program.ageGroup).toBe("1 - 2 roky");
		expect(program.color).toBe("#4CAF50");
		expect(program.description).toBe("Kurz pro batolata");
	});

	test("should fail to create program without a name", () => {
		expect(() => createProgram({ name: "", ageGroup: "1 - 2 roky" })).toThrow(
			"Program name is required",
		);
	});

	test("should fail to create program with an invalid age group", () => {
		expect(() =>
			createProgram({ name: "Test Kurz", ageGroup: "not-a-real-age" }),
		).toThrow(/Invalid age group/);
	});

	test("should derive color from ageGroup when color is invalid", () => {
		const program = createProgram({
			name: "Test Kurz",
			ageGroup: "1 - 2 roky",
			color: "not-a-hex",
		});
		expect(program.color).toMatch(/^#/);
	});

	test("should omit description when not provided", () => {
		const program = createProgram({
			name: "Test Kurz",
			ageGroup: "1 - 2 roky",
		});
		expect(program.description).toBeUndefined();
	});
});

test.describe
	.serial("ProgramDB operations - TDD", () => {
		test.beforeEach(async () => {
			await initializeDatabase();
			const programs = await ProgramDB.getAll();
			for (const program of programs) {
				await ProgramDB.delete(program.id as string);
			}
		});

		test("should insert and retrieve a program", async () => {
			const program = createProgram({
				name: "Cvičení s batolaty",
				ageGroup: "1 - 2 roky",
				description: "Kurz pro batolata",
			});

			await ProgramDB.insert(program);
			const retrieved = await ProgramDB.getById(program.id);

			expect(retrieved).toBeDefined();
			expect(retrieved?.name).toBe(program.name);
			expect(retrieved?.ageGroup).toBe(program.ageGroup);
			expect(retrieved?.color).toBe(program.color);
		});

		test("should return all programs ordered by name", async () => {
			await ProgramDB.insert(
				createProgram({ name: "Zebra Kurz", ageGroup: "1 - 2 roky" }),
			);
			await ProgramDB.insert(
				createProgram({ name: "Alfa Kurz", ageGroup: "1 - 2 roky" }),
			);

			const all = await ProgramDB.getAll();

			expect(all).toHaveLength(2);
			expect(all[0]?.name).toBe("Alfa Kurz");
			expect(all[1]?.name).toBe("Zebra Kurz");
		});

		test("should update a program", async () => {
			const program = createProgram({
				name: "Original",
				ageGroup: "1 - 2 roky",
			});
			await ProgramDB.insert(program);

			await ProgramDB.update(program.id, { name: "Upravený" });
			const retrieved = await ProgramDB.getById(program.id);

			expect(retrieved?.name).toBe("Upravený");
		});

		test("should delete a program", async () => {
			const program = createProgram({ name: "Smazat", ageGroup: "1 - 2 roky" });
			await ProgramDB.insert(program);

			await ProgramDB.delete(program.id);
			const retrieved = await ProgramDB.getById(program.id);

			expect(retrieved).toBeUndefined();
		});
	});
