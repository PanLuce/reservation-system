import { expect, test } from "@playwright/test";
import { initializeDatabase, KurzDB } from "../src/database.js";
import { createKurz, type Kurz } from "../src/kurz.js";

test.describe("Kurz factory - TDD", () => {
	test("should create a kurz with valid data", () => {
		const kurz: Kurz = createKurz({
			name: "Cvičení s batolaty",
			ageGroup: "1 - 2 roky",
			color: "#4CAF50",
			description: "Kurz pro batolata",
		});

		expect(kurz).toBeDefined();
		expect(kurz.id).toMatch(/^kurz_/);
		expect(kurz.name).toBe("Cvičení s batolaty");
		expect(kurz.ageGroup).toBe("1 - 2 roky");
		expect(kurz.color).toBe("#4CAF50");
		expect(kurz.description).toBe("Kurz pro batolata");
	});

	test("should fail to create kurz without a name", () => {
		expect(() => createKurz({ name: "", ageGroup: "1 - 2 roky" })).toThrow(
			"Kurz name is required",
		);
	});

	test("should fail to create kurz with an invalid age group", () => {
		expect(() =>
			createKurz({ name: "Test Kurz", ageGroup: "not-a-real-age" }),
		).toThrow(/Invalid age group/);
	});

	test("should derive color from ageGroup when color is invalid", () => {
		const kurz = createKurz({
			name: "Test Kurz",
			ageGroup: "1 - 2 roky",
			color: "not-a-hex",
		});
		expect(kurz.color).toMatch(/^#/);
	});

	test("should omit description when not provided", () => {
		const kurz = createKurz({ name: "Test Kurz", ageGroup: "1 - 2 roky" });
		expect(kurz.description).toBeUndefined();
	});
});

test.describe
	.serial("KurzDB operations - TDD", () => {
		test.beforeEach(async () => {
			await initializeDatabase();
			const kurzy = await KurzDB.getAll();
			for (const kurz of kurzy) {
				await KurzDB.delete(kurz.id as string);
			}
		});

		test("should insert and retrieve a kurz", async () => {
			const kurz = createKurz({
				name: "Cvičení s batolaty",
				ageGroup: "1 - 2 roky",
				description: "Kurz pro batolata",
			});

			await KurzDB.insert(kurz);
			const retrieved = await KurzDB.getById(kurz.id);

			expect(retrieved).toBeDefined();
			expect(retrieved?.name).toBe(kurz.name);
			expect(retrieved?.ageGroup).toBe(kurz.ageGroup);
			expect(retrieved?.color).toBe(kurz.color);
		});

		test("should return all kurzy ordered by name", async () => {
			await KurzDB.insert(
				createKurz({ name: "Zebra Kurz", ageGroup: "1 - 2 roky" }),
			);
			await KurzDB.insert(
				createKurz({ name: "Alfa Kurz", ageGroup: "1 - 2 roky" }),
			);

			const all = await KurzDB.getAll();

			expect(all).toHaveLength(2);
			expect(all[0]?.name).toBe("Alfa Kurz");
			expect(all[1]?.name).toBe("Zebra Kurz");
		});

		test("should update a kurz", async () => {
			const kurz = createKurz({
				name: "Original",
				ageGroup: "1 - 2 roky",
			});
			await KurzDB.insert(kurz);

			await KurzDB.update(kurz.id, { name: "Upravený" });
			const retrieved = await KurzDB.getById(kurz.id);

			expect(retrieved?.name).toBe("Upravený");
		});

		test("should delete a kurz", async () => {
			const kurz = createKurz({ name: "Smazat", ageGroup: "1 - 2 roky" });
			await KurzDB.insert(kurz);

			await KurzDB.delete(kurz.id);
			const retrieved = await KurzDB.getById(kurz.id);

			expect(retrieved).toBeUndefined();
		});
	});
