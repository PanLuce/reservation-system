import type { LessonCalendar } from "./calendar";
import type { Participant } from "./participant";
export type Registration = {
    id: string;
    lessonId: string;
    participantId: string;
    registeredAt: Date;
    status: "confirmed" | "waitlist" | "cancelled";
    missedLessonId?: string;
};
export declare class RegistrationManager {
    private registrations;
    private calendar;
    constructor(calendar: LessonCalendar);
    registerParticipant(lessonId: string, participant: Participant): Registration;
    bulkRegisterParticipants(lessonId: string, participants: Participant[]): Registration[];
    getRegistrationsForLesson(lessonId: string): Registration[];
    cancelRegistration(registrationId: string, currentTime?: Date): {
        success: boolean;
        error?: string;
    };
    registerForSubstitution(lessonId: string, participant: Participant, missedLessonId: string): Registration;
    getAvailableSubstitutionLessons(ageGroup: string): any;
    private generateId;
}
//# sourceMappingURL=registration.d.ts.map