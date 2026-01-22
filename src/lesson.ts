export type Lesson = {
	id: string;
	title: string;
	date: string; // YYYY-MM-DD format
	dayOfWeek: string;
	time: string;
	location: string;
	ageGroup: string;
	capacity: number;
	enrolledCount: number;
};

export type LessonInput = Omit<Lesson, "id" | "enrolledCount">;

export function createLesson(input: LessonInput): Lesson {
	return {
		id: generateId(),
		...input,
		enrolledCount: 0,
	};
}

function generateId(): string {
	return `lesson_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
