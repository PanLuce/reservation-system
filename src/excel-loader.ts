import * as XLSX from "xlsx";
import type { Participant } from "./participant.js";
import { createParticipant } from "./participant.js";
import type { RegistrationManager } from "./registration.js";
import type { RegistrationManagerDB } from "./registration-db.js";

export class ExcelParticipantLoader {
	parseParticipantsFromFile(filePath: string): Participant[] {
		const workbook = XLSX.readFile(filePath);
		return this.parseWorkbook(workbook);
	}

	parseParticipantsFromBuffer(buffer: Buffer): Participant[] {
		const workbook = XLSX.read(buffer, { type: "buffer" });
		return this.parseWorkbook(workbook);
	}

	bulkLoadAndRegister(
		filePath: string,
		lessonId: string,
		registrationManager: RegistrationManager | RegistrationManagerDB,
	): number {
		const participants = this.parseParticipantsFromFile(filePath);
		const registrations = registrationManager.bulkRegisterParticipants(
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
