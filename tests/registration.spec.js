import { expect, test } from "@playwright/test";
import { LessonCalendar } from "../src/calendar";
import { RegistrationManager } from "../src/registration";
test.describe("Registration Management", () => {
    test("should register a participant to a lesson", () => {
        // Arrange
        const calendar = new LessonCalendar();
        const lesson = {
            id: "lesson_1",
            title: "Morning Class",
            dayOfWeek: "Monday",
            time: "10:00",
            location: "CVČ Vietnamská",
            ageGroup: "3-12 months",
            capacity: 10,
            enrolledCount: 0,
        };
        calendar.addLesson(lesson);
        const registrationManager = new RegistrationManager(calendar);
        const participant = {
            id: "p1",
            name: "Jana Nováková",
            email: "jana@example.cz",
            phone: "+420 777 888 999",
            ageGroup: "3-12 months",
        };
        // Act
        const registration = registrationManager.registerParticipant("lesson_1", participant);
        // Assert
        expect(registration).toBeDefined();
        expect(registration.lessonId).toBe("lesson_1");
        expect(registration.participantId).toBe("p1");
        expect(registration.status).toBe("confirmed");
        // Check lesson enrolledCount increased
        const updatedLesson = calendar.getLessonById("lesson_1");
        expect(updatedLesson?.enrolledCount).toBe(1);
    });
    test("should register multiple participants at once (bulk)", () => {
        // Arrange
        const calendar = new LessonCalendar();
        const lesson = {
            id: "lesson_1",
            title: "Morning Class",
            dayOfWeek: "Monday",
            time: "10:00",
            location: "CVČ Vietnamská",
            ageGroup: "3-12 months",
            capacity: 10,
            enrolledCount: 0,
        };
        calendar.addLesson(lesson);
        const registrationManager = new RegistrationManager(calendar);
        const participants = [
            {
                id: "p1",
                name: "Jana Nováková",
                email: "jana@example.cz",
                phone: "+420 777 888 999",
                ageGroup: "3-12 months",
            },
            {
                id: "p2",
                name: "Petr Svoboda",
                email: "petr@example.cz",
                phone: "+420 666 555 444",
                ageGroup: "3-12 months",
            },
            {
                id: "p3",
                name: "Marie Dvořáková",
                email: "marie@example.cz",
                phone: "+420 555 444 333",
                ageGroup: "3-12 months",
            },
        ];
        // Act
        const registrations = registrationManager.bulkRegisterParticipants("lesson_1", participants);
        // Assert
        expect(registrations).toHaveLength(3);
        for (const registration of registrations) {
            expect(registration.status).toBe("confirmed");
        }
        // Check lesson enrolledCount increased
        const updatedLesson = calendar.getLessonById("lesson_1");
        expect(updatedLesson?.enrolledCount).toBe(3);
    });
    test("should put participant on waitlist when lesson is full", () => {
        // Arrange
        const calendar = new LessonCalendar();
        const lesson = {
            id: "lesson_1",
            title: "Morning Class",
            dayOfWeek: "Monday",
            time: "10:00",
            location: "CVČ Vietnamská",
            ageGroup: "3-12 months",
            capacity: 2, // Only 2 spots
            enrolledCount: 2, // Already full
        };
        calendar.addLesson(lesson);
        const registrationManager = new RegistrationManager(calendar);
        const participant = {
            id: "p1",
            name: "Jana Nováková",
            email: "jana@example.cz",
            phone: "+420 777 888 999",
            ageGroup: "3-12 months",
        };
        // Act
        const registration = registrationManager.registerParticipant("lesson_1", participant);
        // Assert
        expect(registration.status).toBe("waitlist");
        // enrolledCount should not increase
        const updatedLesson = calendar.getLessonById("lesson_1");
        expect(updatedLesson?.enrolledCount).toBe(2);
    });
    test("should cancel a registration", () => {
        // Arrange
        const calendar = new LessonCalendar();
        const lesson = {
            id: "lesson_1",
            title: "Morning Class",
            dayOfWeek: "Monday",
            time: "10:00",
            location: "CVČ Vietnamská",
            ageGroup: "3-12 months",
            capacity: 10,
            enrolledCount: 0,
        };
        calendar.addLesson(lesson);
        const registrationManager = new RegistrationManager(calendar);
        const participant = {
            id: "p1",
            name: "Jana Nováková",
            email: "jana@example.cz",
            phone: "+420 777 888 999",
            ageGroup: "3-12 months",
        };
        const registration = registrationManager.registerParticipant("lesson_1", participant);
        // Act
        registrationManager.cancelRegistration(registration.id);
        // Assert
        const registrations = registrationManager.getRegistrationsForLesson("lesson_1");
        const cancelledReg = registrations.find((r) => r.id === registration.id);
        expect(cancelledReg?.status).toBe("cancelled");
        // enrolledCount should decrease
        const updatedLesson = calendar.getLessonById("lesson_1");
        expect(updatedLesson?.enrolledCount).toBe(0);
    });
});
//# sourceMappingURL=registration.spec.js.map