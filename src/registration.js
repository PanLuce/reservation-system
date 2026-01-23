export class RegistrationManager {
    registrations = [];
    calendar;
    constructor(calendar) {
        this.calendar = calendar;
    }
    registerParticipant(lessonId, participant) {
        const lesson = this.calendar.getLessonById(lessonId);
        if (!lesson) {
            throw new Error(`Lesson ${lessonId} not found`);
        }
        const isFull = lesson.enrolledCount >= lesson.capacity;
        const status = isFull ? "waitlist" : "confirmed";
        const registration = {
            id: this.generateId(),
            lessonId,
            participantId: participant.id,
            registeredAt: new Date(),
            status,
        };
        this.registrations.push(registration);
        if (!isFull) {
            this.calendar.updateLesson(lessonId, {
                enrolledCount: lesson.enrolledCount + 1,
            });
        }
        return registration;
    }
    bulkRegisterParticipants(lessonId, participants) {
        const registrations = [];
        for (const participant of participants) {
            registrations.push(this.registerParticipant(lessonId, participant));
        }
        return registrations;
    }
    getRegistrationsForLesson(lessonId) {
        return this.registrations.filter((r) => r.lessonId === lessonId);
    }
    cancelRegistration(registrationId, currentTime = new Date()) {
        const registration = this.registrations.find((r) => r.id === registrationId);
        if (!registration) {
            throw new Error(`Registration ${registrationId} not found`);
        }
        const lesson = this.calendar.getLessonById(registration.lessonId);
        if (!lesson) {
            throw new Error(`Lesson ${registration.lessonId} not found`);
        }
        // Check if cancellation is before midnight of lesson day
        const lessonDate = new Date(lesson.date);
        const midnightOfLessonDay = new Date(lessonDate);
        midnightOfLessonDay.setHours(0, 0, 0, 0);
        if (currentTime >= midnightOfLessonDay) {
            return {
                success: false,
                error: "Cannot cancel after midnight before the lesson",
            };
        }
        if (registration.status === "confirmed") {
            this.calendar.updateLesson(registration.lessonId, {
                enrolledCount: Math.max(0, lesson.enrolledCount - 1),
            });
        }
        registration.status = "cancelled";
        return { success: true };
    }
    registerForSubstitution(lessonId, participant, missedLessonId) {
        const lesson = this.calendar.getLessonById(lessonId);
        if (!lesson) {
            throw new Error(`Lesson ${lessonId} not found`);
        }
        const isFull = lesson.enrolledCount >= lesson.capacity;
        const status = isFull ? "waitlist" : "confirmed";
        const registration = {
            id: this.generateId(),
            lessonId,
            participantId: participant.id,
            registeredAt: new Date(),
            status,
            missedLessonId,
        };
        this.registrations.push(registration);
        if (!isFull) {
            this.calendar.updateLesson(lessonId, {
                enrolledCount: lesson.enrolledCount + 1,
            });
        }
        return registration;
    }
    getAvailableSubstitutionLessons(ageGroup) {
        const allLessons = this.calendar.getAllLessons();
        return allLessons.filter((lesson) => lesson.ageGroup === ageGroup && lesson.enrolledCount < lesson.capacity);
    }
    generateId() {
        return `registration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}
//# sourceMappingURL=registration.js.map