import type { Lesson } from "./lesson";
export declare class LessonCalendar {
    private lessons;
    addLesson(lesson: Lesson): void;
    getAllLessons(): Lesson[];
    getLessonsByDay(day: string): Lesson[];
    getLessonById(id: string): Lesson | undefined;
    updateLesson(id: string, updates: Partial<Lesson>): void;
    bulkUpdateLessons(filter: Partial<Lesson>, updates: Partial<Lesson>): number;
    bulkDeleteLessons(filter: Partial<Lesson>): number;
    private matchesFilter;
}
//# sourceMappingURL=calendar.d.ts.map