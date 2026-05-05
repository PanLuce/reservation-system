import * as XLSX from "xlsx";

export type ParticipantRow = {
	name: string;
	email: string;
	phone?: string;
	parentName?: string;
};

export type ParsedBlock = {
	title: string;
	rows: ParticipantRow[];
	warnings: string[];
};

export type ParsedSheet = {
	sheetName: string;
	detectedLocation: string | null;
	blocks: ParsedBlock[];
};

export type ParsedWorkbook = {
	sheets: ParsedSheet[];
};

const LOCATION_HINTS: [RegExp, string][] = [
	[/vietnamsk/i, "Vietnamská"],
	[/jerem/i, "O.Jeremiáše"],
	[/poklad/i, "DK Poklad"],
];

const HEADER_KEYWORDS = ["jméno", "jmeno", "name", "email"];

function detectLocation(sheetName: string): string | null {
	for (const [pattern, location] of LOCATION_HINTS) {
		if (pattern.test(sheetName)) return location;
	}
	return null;
}

function isHeaderRow(row: unknown[]): boolean {
	const lower = row.map((c) =>
		String(c ?? "")
			.toLowerCase()
			.trim(),
	);
	return HEADER_KEYWORDS.some((kw) => lower.includes(kw));
}

function isBlankRow(row: unknown[]): boolean {
	return row.every(
		(c) => c === null || c === undefined || String(c).trim() === "",
	);
}

function findEmailIndex(headerRow: unknown[]): number {
	return headerRow.findIndex(
		(c) =>
			String(c ?? "")
				.toLowerCase()
				.trim() === "email",
	);
}

function findNameIndex(headerRow: unknown[]): number {
	const lower = headerRow.map((c) =>
		String(c ?? "")
			.toLowerCase()
			.trim(),
	);
	// "jméno" or "name" — prefer "jméno"
	const jmeno = lower.findIndex((c) => c === "jméno" || c === "jmeno");
	if (jmeno >= 0) return jmeno;
	return lower.indexOf("name");
}

function findPhoneIndex(headerRow: unknown[]): number {
	const lower = headerRow.map((c) =>
		String(c ?? "")
			.toLowerCase()
			.trim(),
	);
	return lower.findIndex(
		(c) => c === "tel" || c === "telefon" || c === "phone",
	);
}

function findParentIndex(headerRow: unknown[]): number {
	const lower = headerRow.map((c) =>
		String(c ?? "")
			.toLowerCase()
			.trim(),
	);
	return lower.findIndex(
		(c) => c === "rodič" || c === "rodic" || c === "parent",
	);
}

function parseSheetBlocks(rows: unknown[][]): ParsedBlock[] {
	const blocks: ParsedBlock[] = [];
	let i = 0;

	while (i < rows.length) {
		// Skip leading blank rows
		while (i < rows.length && isBlankRow(rows[i] ?? [])) i++;
		if (i >= rows.length) break;

		// This row should be either a title or header
		const candidateRow = rows[i] ?? [];

		if (isHeaderRow(candidateRow)) {
			// No title, header is first non-blank row
			const headerRow = candidateRow;
			i++;
			const block = extractBlock("", headerRow, rows, i);
			i = block.nextIndex;
			blocks.push(block.block);
		} else {
			// Title row
			const titleRow = candidateRow;
			const title = titleRow
				.filter((c) => c !== null && c !== undefined && String(c).trim() !== "")
				.join(" – ")
				.trim();
			i++;

			// Skip blank rows between title and header
			while (i < rows.length && isBlankRow(rows[i] ?? [])) i++;

			if (i >= rows.length) break;

			const nextRow = rows[i] ?? [];
			if (isHeaderRow(nextRow)) {
				const headerRow = nextRow;
				i++;
				const block = extractBlock(title, headerRow, rows, i);
				i = block.nextIndex;
				blocks.push(block.block);
			} else {
				// Title with no header — skip
				i++;
			}
		}
	}

	return blocks;
}

function extractBlock(
	title: string,
	headerRow: unknown[],
	allRows: unknown[][],
	startIndex: number,
): { block: ParsedBlock; nextIndex: number } {
	const emailIdx = findEmailIndex(headerRow);
	const nameIdx = findNameIndex(headerRow);
	const phoneIdx = findPhoneIndex(headerRow);
	const parentIdx = findParentIndex(headerRow);

	const participantRows: ParticipantRow[] = [];
	const warnings: string[] = [];
	let i = startIndex;

	while (
		i < allRows.length &&
		!isBlankRow(allRows[i] ?? []) &&
		!isHeaderRow(allRows[i] ?? [])
	) {
		const row = allRows[i] ?? [];

		const email = emailIdx >= 0 ? String(row[emailIdx] ?? "").trim() : "";
		const name = nameIdx >= 0 ? String(row[nameIdx] ?? "").trim() : "";
		const phone =
			phoneIdx >= 0 ? String(row[phoneIdx] ?? "").trim() : undefined;
		const parentName =
			parentIdx >= 0 ? String(row[parentIdx] ?? "").trim() : undefined;

		if (!email) {
			warnings.push(`Row ${i + 1}: missing email — skipped`);
		} else {
			participantRows.push({
				name: name || email,
				email,
				...(phone ? { phone } : {}),
				...(parentName ? { parentName } : {}),
			});
		}

		i++;
	}

	return {
		block: { title, rows: participantRows, warnings },
		nextIndex: i,
	};
}

export function parseOdsWorkbook(buffer: Buffer): ParsedWorkbook {
	const workbook = XLSX.read(buffer, { type: "buffer" });
	const sheets: ParsedSheet[] = [];

	for (const sheetName of workbook.SheetNames) {
		const worksheet = workbook.Sheets[sheetName];
		if (!worksheet) continue;

		const raw = XLSX.utils.sheet_to_json(worksheet, {
			header: 1,
			defval: null,
		}) as unknown[][];

		const detectedLocation = detectLocation(sheetName);
		const blocks = parseSheetBlocks(raw);

		sheets.push({ sheetName, detectedLocation, blocks });
	}

	return { sheets };
}
