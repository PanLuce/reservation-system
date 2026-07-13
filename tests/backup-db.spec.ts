import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@libsql/client";
import { expect, test } from "@playwright/test";
import { dumpDatabase } from "../scripts/backup-db.js";
import {
	initializeDatabase,
	ProgramDB,
	resetDatabaseForTests,
} from "../src/database.js";
import { createProgram } from "../src/program.js";

// Proves REQUIREMENTS.md item 10's backup half: a dump of the live test DB
// restores into a fresh database with identical row counts. Tables are
// discovered dynamically (sqlite_master), not hardcoded, so a future rename
// of any table needs no change here.

test.describe("dumpDatabase", () => {
	test.beforeEach(async () => {
		await initializeDatabase();
		await resetDatabaseForTests();
	});

	test("dump round-trips into a fresh database with identical row counts", async () => {
		await ProgramDB.insert(
			createProgram({ name: "Batolata", ageGroup: "1 - 2 roky" }),
		);
		await ProgramDB.insert(
			createProgram({ name: "Školkáci", ageGroup: "2 - 3 roky" }),
		);

		const { client: sourceClient } = await import("../src/database.js");
		const dumpSql = await dumpDatabase(sourceClient);

		expect(dumpSql).toContain("CREATE TABLE");
		expect(dumpSql).toContain("INSERT INTO");

		const restorePath = path.join(
			os.tmpdir(),
			`backup-db-restore-test-${Date.now()}.db`,
		);
		const restoreClient = createClient({ url: `file:${restorePath}` });
		try {
			await restoreClient.executeMultiple(dumpSql);

			const sourcePrograms = await sourceClient.execute(
				"SELECT COUNT(*) as count FROM programs",
			);
			const restoredPrograms = await restoreClient.execute(
				"SELECT COUNT(*) as count FROM programs",
			);
			expect(restoredPrograms.rows[0]?.count).toBe(
				sourcePrograms.rows[0]?.count,
			);

			const restoredNames = await restoreClient.execute(
				"SELECT name FROM programs ORDER BY name",
			);
			expect(restoredNames.rows.map((r) => r.name)).toEqual([
				"Batolata",
				"Školkáci",
			]);
		} finally {
			restoreClient.close();
			fs.rmSync(restorePath, { force: true });
			fs.rmSync(`${restorePath}-wal`, { force: true });
			fs.rmSync(`${restorePath}-shm`, { force: true });
		}
	});
});
