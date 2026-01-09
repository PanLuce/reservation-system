import type { Participant } from "./participant";
import type { RegistrationManager } from "./registration";
export declare class ExcelParticipantLoader {
    parseParticipantsFromFile(filePath: string): Participant[];
    parseParticipantsFromBuffer(buffer: Buffer): Participant[];
    bulkLoadAndRegister(filePath: string, lessonId: string, registrationManager: RegistrationManager): number;
    private parseWorkbook;
    private isValidParticipantRow;
}
//# sourceMappingURL=excel-loader.d.ts.map