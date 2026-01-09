import type { Lesson } from "./lesson";

export class LessonCalendar {
	private lessons: Lesson[] = [];

	addLesson(lesson: Lesson): void {
		this.lessons.push(lesson);
	}

	getAllLessons(): Lesson[] {
		return [...this.lessons];
	}

	getLessonsByDay(day: string): Lesson[] {
		return this.lessons.filter((lesson) => lesson.dayOfWeek === day);
	}

	getLessonById(id: string): Lesson | undefined {
		return this.lessons.find((lesson) => lesson.id === id);
	}

	updateLesson(id: string, updates: Partial<Lesson>): void {
		const lesson = this.lessons.find((l) => l.id === id);
		if (lesson) {
			Object.assign(lesson, updates);
		}
	}

	bulkUpdateLessons(filter: Partial<Lesson>, updates: Partial<Lesson>): number {
		let updateCount = 0;
		for (const lesson of this.lessons) {
			if (this.matchesFilter(lesson, filter)) {
				Object.assign(lesson, updates);
				updateCount++;
			}
		}
		return updateCount;
	}

	bulkDeleteLessons(filter: Partial<Lesson>): number {
		const initialLength = this.lessons.length;
		this.lessons = this.lessons.filter(
			(lesson) => !this.matchesFilter(lesson, filter),
		);
		return initialLength - this.lessons.length;
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
