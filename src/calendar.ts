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
}
