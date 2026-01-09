import { expect, test } from "@playwright/test";
import { LessonCalendar } from "../src/calendar";
test.describe("Bulk Operations - TDD Red Phase", () => {
    test("should update a single lesson", () => {
        // Arrange
        const calendar = new LessonCalendar();
        const lesson = {
            id: "test_1",
            title: "Old Title",
            dayOfWeek: "Monday",
            time: "10:00",
            location: "CVČ Vietnamská",
            ageGroup: "3-12 months",
            capacity: 10,
            enrolledCount: 0,
        };
        calendar.addLesson(lesson);
        // Act
        calendar.updateLesson("test_1", { title: "New Title", capacity: 15 });
        const updated = calendar.getLessonById("test_1");
        // Assert
        expect(updated?.title).toBe("New Title");
        expect(updated?.capacity).toBe(15);
        expect(updated?.dayOfWeek).toBe("Monday"); // unchanged
    });
    test("should update multiple lessons at once (bulk update)", () => {
        // Arrange
        const calendar = new LessonCalendar();
        const lessons = [
            {
                id: "test_1",
                title: "Monday Class",
                dayOfWeek: "Monday",
                time: "10:00",
                location: "CVČ Vietnamská",
                ageGroup: "3-12 months",
                capacity: 10,
                enrolledCount: 0,
            },
            {
                id: "test_2",
                title: "Monday Class",
                dayOfWeek: "Monday",
                time: "11:00",
                location: "CVČ Vietnamská",
                ageGroup: "3-12 months",
                capacity: 10,
                enrolledCount: 0,
            },
            {
                id: "test_3",
                title: "Tuesday Class",
                dayOfWeek: "Tuesday",
                time: "10:00",
                location: "CVČ Jeremiáše",
                ageGroup: "1-2 years",
                capacity: 12,
                enrolledCount: 0,
            },
        ];
        for (const lesson of lessons) {
            calendar.addLesson(lesson);
        }
        // Act - Update all Monday classes to have capacity 20
        const updateCount = calendar.bulkUpdateLessons({ dayOfWeek: "Monday" }, { capacity: 20 });
        // Assert
        expect(updateCount).toBe(2);
        const mondayLessons = calendar.getLessonsByDay("Monday");
        for (const lesson of mondayLessons) {
            expect(lesson.capacity).toBe(20);
        }
        // Tuesday should be unchanged
        const tuesdayLesson = calendar.getLessonById("test_3");
        expect(tuesdayLesson?.capacity).toBe(12);
    });
    test("should delete multiple lessons (bulk delete)", () => {
        // Arrange
        const calendar = new LessonCalendar();
        const lessons = [
            {
                id: "test_1",
                title: "Monday Class",
                dayOfWeek: "Monday",
                time: "10:00",
                location: "CVČ Vietnamská",
                ageGroup: "3-12 months",
                capacity: 10,
                enrolledCount: 0,
            },
            {
                id: "test_2",
                title: "Monday Class",
                dayOfWeek: "Monday",
                time: "11:00",
                location: "CVČ Vietnamská",
                ageGroup: "3-12 months",
                capacity: 10,
                enrolledCount: 0,
            },
            {
                id: "test_3",
                title: "Tuesday Class",
                dayOfWeek: "Tuesday",
                time: "10:00",
                location: "CVČ Jeremiáše",
                ageGroup: "1-2 years",
                capacity: 12,
                enrolledCount: 0,
            },
        ];
        for (const lesson of lessons) {
            calendar.addLesson(lesson);
        }
        // Act - Delete all Monday classes
        const deleteCount = calendar.bulkDeleteLessons({ dayOfWeek: "Monday" });
        // Assert
        expect(deleteCount).toBe(2);
        expect(calendar.getAllLessons()).toHaveLength(1);
        expect(calendar.getLessonsByDay("Monday")).toHaveLength(0);
        expect(calendar.getLessonsByDay("Tuesday")).toHaveLength(1);
    });
});
//# sourceMappingURL=bulk-operations.spec.js.map