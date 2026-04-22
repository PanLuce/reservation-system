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
