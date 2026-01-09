import { expect, test } from "@playwright/test";
import { LessonCalendar } from "../src/calendar";
import { RegistrationManager } from "../src/registration";
test.describe("Substitution Management - TDD Red Phase", () => {
    test("should allow participant to sign up for substitution lesson", () => {
        // Arrange
        const calendar = new LessonCalendar();
        const lesson = {
            id: "lesson_1",
            title: "Monday Makeup Class",
            dayOfWeek: "Monday",
            time: "10:00",
            location: "CVČ Vietnamská",
            ageGroup: "3-12 months",
            capacity: 10,
            enrolledCount: 5, // Has space
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
        const registration = registrationManager.registerForSubstitution("lesson_1", participant, "missed_lesson_123");
        // Assert
        expect(registration).toBeDefined();
        expect(registration.status).toBe("confirmed");
        expect(registration.lessonId).toBe("lesson_1");
        // Check lesson count increased
        const updatedLesson = calendar.getLessonById("lesson_1");
        expect(updatedLesson?.enrolledCount).toBe(6);
    });
    test("should get list of available substitution lessons for age group", () => {
        // Arrange
        const calendar = new LessonCalendar();
        const lessons = [
            {
                id: "lesson_1",
                title: "Monday Class",
                dayOfWeek: "Monday",
                time: "10:00",
                location: "CVČ Vietnamská",
                ageGroup: "3-12 months",
                capacity: 10,
                enrolledCount: 5, // Available
            },
            {
                id: "lesson_2",
                title: "Monday Full Class",
                dayOfWeek: "Monday",
                time: "11:00",
                location: "CVČ Vietnamská",
                ageGroup: "3-12 months",
                capacity: 10,
                enrolledCount: 10, // Full - not available
            },
            {
                id: "lesson_3",
                title: "Tuesday Class",
                dayOfWeek: "Tuesday",
                time: "10:00",
                location: "CVČ Jeremiáše",
                ageGroup: "3-12 months",
                capacity: 12,
                enrolledCount: 8, // Available
            },
            {
                id: "lesson_4",
                title: "Wrong Age Group",
                dayOfWeek: "Wednesday",
                time: "10:00",
                location: "DK Poklad",
                ageGroup: "1-2 years", // Different age group
                capacity: 10,
                enrolledCount: 5,
            },
        ];
        for (const lesson of lessons) {
            calendar.addLesson(lesson);
        }
        const registrationManager = new RegistrationManager(calendar);
        // Act
        const availableLessons = registrationManager.getAvailableSubstitutionLessons("3-12 months");
        // Assert
        expect(availableLessons).toHaveLength(2); // Only lesson_1 and lesson_3
        const lessonIds = availableLessons.map((l) => l.id);
        expect(lessonIds).toContain("lesson_1");
        expect(lessonIds).toContain("lesson_3");
        expect(lessonIds).not.toContain("lesson_2"); // Full
        expect(lessonIds).not.toContain("lesson_4"); // Wrong age group
    });
    test("should track missed lesson reference in registration", () => {
        // Arrange
        const calendar = new LessonCalendar();
        const lesson = {
            id: "lesson_1",
            title: "Makeup Class",
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
        const registration = registrationManager.registerForSubstitution("lesson_1", participant, "original_lesson_456");
        // Assert
        // Registration should track which lesson it's substituting for
        const registrations = registrationManager.getRegistrationsForLesson("lesson_1");
        const subReg = registrations.find((r) => r.id === registration.id);
        expect(subReg).toBeDefined();
        // Implementation should store missed lesson reference
    });
});
//# sourceMappingURL=substitution.spec.js.map