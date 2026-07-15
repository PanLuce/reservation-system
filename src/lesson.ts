import { num, type Row, str } from "./db-row.js";

export type Lesson = {
	id: string;
	title: string;
	date: string; // YYYY-MM-DD format
	dayOfWeek: string;
	time: string;
	location?: string; // derived from course at read time; not stored on lessons
	ageGroup: string;
	capacity: number;
	enrolledCount: number;
	courseId?: string;
};

export function rowToLesson(row: Row): Lesson {
	return {
		id: str(row.id),
		title: str(row.title),
		date: str(row.date),
		dayOfWeek: str(row.dayOfWeek),
		time: str(row.time),
		location: str(row.location),
		ageGroup: str(row.ageGroup),
		capacity: num(row.capacity),
		enrolledCount: num(row.enrolledCount),
		...(row.courseId != null && { courseId: str(row.courseId) }),
	};
}

export type LessonInput = Omit<Lesson, "id" | "enrolledCount">;

export function createLesson(input: LessonInput): Lesson {
	return {
		id: generateId(),
		...input,
		enrolledCount: 0,
	};
}

const UPDATABLE_LESSON_FIELDS = ["title", "date", "dayOfWeek", "time"] as const;

export type LessonUpdate = Partial<
	Pick<Lesson, (typeof UPDATABLE_LESSON_FIELDS)[number] | "capacity">
>;

export function pickUpdatableLessonFields(body: unknown): LessonUpdate {
	if (typeof body !== "object" || body === null) return {};
	const source = body as Record<string, unknown>;
	const update: LessonUpdate = {};
	for (const field of UPDATABLE_LESSON_FIELDS) {
		if (field in source) update[field] = source[field] as string;
	}
	if ("capacity" in source) update.capacity = source.capacity as number;
	return update;
}

function generateId(): string {
	return `lesson_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
