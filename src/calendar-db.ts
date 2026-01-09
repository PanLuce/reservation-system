import type { Lesson } from "./lesson.js";
import { LessonDB } from "./database.js";

export class LessonCalendarDB {
	addLesson(lesson: Lesson): void {
		LessonDB.insert(lesson);
	}

	getAllLessons(): Lesson[] {
		return LessonDB.getAll() as Lesson[];
	}

	getLessonsByDay(day: string): Lesson[] {
		return LessonDB.getByDay(day) as Lesson[];
	}

	getLessonById(id: string): Lesson | undefined {
		return LessonDB.getById(id) as Lesson | undefined;
	}

	updateLesson(id: string, updates: Partial<Lesson>): void {
		LessonDB.update(id, updates);
	}

	bulkUpdateLessons(filter: Partial<Lesson>, updates: Partial<Lesson>): number {
		const result = LessonDB.bulkUpdate(filter, updates);
		return result.changes;
	}

	bulkDeleteLessons(filter: Partial<Lesson>): number {
		const result = LessonDB.bulkDelete(filter);
		return result.changes;
	}

	private matchesFilter(lesson: Lesson, filter: Partial<Lesson>): boolean {
		for (const key in filter) {
			if (lesson[key as keyof Lesson] !== filter[key as keyof Lesson]) {
				return false;
			}
		}
		return true;
	}
}
