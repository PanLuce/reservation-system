import * as XLSX from "xlsx";
import { createParticipant } from "./participant";
export class ExcelParticipantLoader {
    parseParticipantsFromFile(filePath) {
        const workbook = XLSX.readFile(filePath);
        return this.parseWorkbook(workbook);
    }
    parseParticipantsFromBuffer(buffer) {
        const workbook = XLSX.read(buffer, { type: "buffer" });
        return this.parseWorkbook(workbook);
    }
    bulkLoadAndRegister(filePath, lessonId, registrationManager) {
        const participants = this.parseParticipantsFromFile(filePath);
        const registrations = registrationManager.bulkRegisterParticipants(lessonId, participants);
        return registrations.length;
    }
    parseWorkbook(workbook) {
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
            return [];
        }
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        const participants = [];
        for (const row of jsonData) {
            if (this.isValidParticipantRow(row)) {
                const participant = createParticipant({
                    name: row.name,
                    email: row.email,
                    phone: row.phone,
                    ageGroup: row.ageGroup,
                });
                participants.push(participant);
            }
        }
        return participants;
    }
    isValidParticipantRow(row) {
        if (typeof row !== "object" || row === null) {
            return false;
        }
        const record = row;
        return (typeof record.name === "string" &&
            record.name.trim() !== "" &&
            typeof record.email === "string" &&
            record.email.trim() !== "" &&
            typeof record.phone === "string" &&
            record.phone.trim() !== "" &&
            typeof record.ageGroup === "string" &&
            record.ageGroup.trim() !== "");
    }
}
//# sourceMappingURL=excel-loader.js.map