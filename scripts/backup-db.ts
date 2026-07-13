import fs from "node:fs";
import type { Client, Value } from "@libsql/client";
import { createClient } from "@libsql/client";

function sqlLiteral(value: Value): string {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "number" || typeof value === "bigint") {
		return String(value);
	}
	if (value instanceof ArrayBuffer) {
		return `X'${Buffer.from(value).toString("hex")}'`;
	}
	return `'${String(value).replace(/'/g, "''")}'`;
}

// Dumps every user table (schema + rows) as a single restorable SQL script.
// Tables are discovered from sqlite_master rather than hardcoded, so this
// survives future domain renames (e.g. kurzy -> programs) with no changes.
export async function dumpDatabase(client: Client): Promise<string> {
	const tablesResult = await client.execute(
		"SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
	);

	const statements: string[] = [];
	for (const row of tablesResult.rows) {
		const tableName = String(row.name);
		const createSql = String(row.sql);
		statements.push(`${createSql};`);

		const rowsResult = await client.execute(`SELECT *
                                                 FROM "${tableName}"`);
		for (const dataRow of rowsResult.rows) {
			const columns = rowsResult.columns;
			const values = columns.map((col) => sqlLiteral(dataRow[col] as Value));
			statements.push(
				`INSERT INTO "${tableName}" (${columns.map((c) => `"${c}"`).join(", ")})
                 VALUES (${values.join(", ")});`,
			);
		}
	}

	return statements.join("\n");
}

async function main() {
	const url = process.env.TURSO_DATABASE_URL;
	const authToken = process.env.TURSO_AUTH_TOKEN;
	if (!url) {
		process.stderr.write("FATAL: TURSO_DATABASE_URL is required\n");
		process.exit(1);
	}

	const client = createClient(authToken ? { url, authToken } : { url });
	const dump = await dumpDatabase(client);

	const outPath = process.argv[2];
	if (outPath) {
		fs.writeFileSync(outPath, dump);
		process.stderr.write(`Backup written to ${outPath}\n`);
	} else {
		process.stdout.write(dump);
	}
}

const isMainModule =
	process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
	main().catch((error) => {
		process.stderr.write(`FATAL: backup failed: ${error}\n`);
		process.exit(1);
	});
}
