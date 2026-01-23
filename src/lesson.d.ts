export type Lesson = {
    id: string;
    title: string;
    date: string;
    dayOfWeek: string;
    time: string;
    location: string;
    ageGroup: string;
    capacity: number;
    enrolledCount: number;
};
export type LessonInput = Omit<Lesson, "id" | "enrolledCount">;
export declare function createLesson(input: LessonInput): Lesson;
//# sourceMappingURL=lesson.d.ts.map