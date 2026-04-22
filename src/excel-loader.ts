import * as XLSX from "xlsx";
import type { Participant } from "./participant.js";
import { createParticipant } from "./participant.js";
import type { RegistrationManager } from "./registration.js";
import type { RegistrationManagerDB } from "./registration-db.js";

export type SkupinkaRow = {
	name: string;
	email: string;
	skupinkaName: string;
};

export type CourseRow = {
	name: string;
	ageGroup: string;
	color: string;
	location?: string;
	description?: string;
	lessonTemplate?: {
		dayOfWeek: string;
		time: string;
		capacity: number;
		startDate: string;
		endDate: string;
	};
};

export type CourseRowResult = {
	ok: boolean;
	name: string;
	error?: string;
};

export class ExcelParticipantLoader {
	parseParticipantsFromFile(filePath: string): Participant[] {
		const workbook = XLSX.readFile(filePath);
		return this.parseWorkbook(workbook);
	}

	parseParticipantsFromBuffer(buffer: Buffer): Participant[] {
		const workbook = XLSX.read(buffer, { type: "buffer" });
		return this.parseWorkbook(workbook);
	}

	parseSkupinkaRowsFromBuffer(buffer: Buffer): SkupinkaRow[] {
		const workbook = XLSX.read(buffer, { type: "buffer" });
		const sheetName = workbook.SheetNames[0];
		if (!sheetName) return [];
		const worksheet = workbook.Sheets[sheetName];
		if (!worksheet) return [];
		const rows = XLSX.utils.sheet_to_json(worksheet) as Record<
			string,
			unknown
		>[];
		return rows
			.filter(
				(r) =>
					typeof r.name === "string" &&
					r.name.trim() !== "" &&
					typeof r.email === "string" &&
					r.email.trim() !== "" &&
					typeof r.skupinka === "string" &&
					r.skupinka.trim() !== "",
			)
			.map((r) => ({
				name: (r.name as string).trim(),
				email: (r.email as string).trim(),
				skupinkaName: (r.skupinka as string).trim(),
			}));
	}

	parseCourseRowsFromBuffer(buffer: Buffer): { rows: CourseRow[]; errors: CourseRowResult[] } {
		const workbook = XLSX.read(buffer, { type: "buffer" });
		const sheetName = workbook.SheetNames[0];
		if (!sheetName) return { rows: [], errors: [] };
		const worksheet = workbook.Sheets[sheetName];
		if (!worksheet) return { rows: [], errors: [] };

		const raw = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];
		const rows: CourseRow[] = [];
		const errors: CourseRowResult[] = [];
		const hexColor = /^#([0-9A-Fa-f]{3}){1,2}$/;

		for (const r of raw) {
			const name = typeof r.name === "string" ? r.name.trim() : "";
			const ageGroup = typeof r.ageGroup === "string" ? r.ageGroup.trim() : "";
			const color = typeof r.color === "string" ? r.color.trim() : "";

			if (!name || !ageGroup || !color) {
				errors.push({ ok: false, name: name || "(missing)", error: "Required columns: name, ageGroup, color" });
				continue;
			}
			if (!hexColor.test(color)) {
				errors.push({ ok: false, name, error: `Invalid color hex: ${color}` });
				continue;
			}

			const rawDesc = typeof r.description === "string" ? r.description.trim() : "";
			const rawLocation = typeof r.location === "string" ? r.location.trim() : "";
			const row: CourseRow = {
				name,
				ageGroup,
				color,
				...(rawDesc ? { description: rawDesc } : {}),
				...(rawLocation ? { location: rawLocation } : {}),
			};

			const dayOfWeek = typeof r.dayOfWeek === "string" ? r.dayOfWeek.trim() : "";
			const time = typeof r.time === "string" ? r.time.trim() : "";
			const capacity = typeof r.capacity === "number" ? r.capacity : Number(r.capacity);
			const startDate = typeof r.startDate === "string" ? r.startDate.trim() : "";
			const endDate = typeof r.endDate === "string" ? r.endDate.trim() : "";

			if (dayOfWeek && time && capacity > 0 && startDate && endDate) {
				row.lessonTemplate = { dayOfWeek, time, capacity, startDate, endDate };
			}

			rows.push(row);
		}

		return { rows, errors };
	}

	async bulkLoadAndRegister(
		filePath: string,
		lessonId: string,
		registrationManager: RegistrationManager | RegistrationManagerDB,
	): Promise<number> {
		const participants = this.parseParticipantsFromFile(filePath);
		const registrations = await registrationManager.bulkRegisterParticipants(
			lessonId,
			participants,
		);
		return registrations.length;
	}

	private parseWorkbook(workbook: XLSX.WorkBook): Participant[] {
		const sheetName = workbook.SheetNames[0];
		if (!sheetName) {
			return [];
		}

		const worksheet = workbook.Sheets[sheetName];
		if (!worksheet) {
			return [];
		}
		const jsonData = XLSX.utils.sheet_to_json(worksheet);

		const participants: Participant[] = [];

		for (const row of jsonData) {
			if (this.isValidParticipantRow(row)) {
				const participant = createParticipant({
					name: (row as Record<string, unknown>).name as string,
					email: (row as Record<string, unknown>).email as string,
					phone: (row as Record<string, unknown>).phone as string,
					ageGroup: (row as Record<string, unknown>).ageGroup as string,
				});
				participants.push(participant);
			}
		}

		return participants;
	}

	private isValidParticipantRow(row: unknown): boolean {
		if (typeof row !== "object" || row === null) {
			return false;
		}

		const record = row as Record<string, unknown>;
		return (
			typeof record.name === "string" &&
			record.name.trim() !== "" &&
			typeof record.email === "string" &&
			record.email.trim() !== "" &&
			typeof record.phone === "string" &&
			record.phone.trim() !== "" &&
			typeof record.ageGroup === "string" &&
			record.ageGroup.trim() !== ""
		);
	}
}
