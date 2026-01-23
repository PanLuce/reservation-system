import { LessonDB, CourseDB } from "./database.js";
import type { Lesson } from "./lesson.js";

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

	bulkCreateLessons(config: {
		courseId: string;
		title: string;
		location: string;
		time: string;
		dayOfWeek: string;
		capacity: number;
		dates: string[];
	}): Lesson[] {
		if (!config.dates || config.dates.length === 0) {
			throw new Error("At least one date is required");
		}

		// Get course to retrieve age group
		const course = CourseDB.getById(config.courseId) as Record<string, unknown> | undefined;
		if (!course) {
			throw new Error(`Course ${config.courseId} not found`);
		}

		const createdLessons: Lesson[] = [];

		for (const date of config.dates) {
			const lesson: Lesson = {
				id: `lesson_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				title: config.title,
				date,
				dayOfWeek: config.dayOfWeek,
				time: config.time,
				location: config.location,
				ageGroup: course.ageGroup as string,
				capacity: config.capacity,
				enrolledCount: 0,
			};

			LessonDB.insertWithCourse(lesson, config.courseId);
			createdLessons.push(lesson);
		}

		return createdLessons;
	}

	bulkCreateLessonsRecurring(config: {
		courseId: string;
		title: string;
		location: string;
		time: string;
		dayOfWeek: string;
		capacity: number;
		startDate: string;
		weeksCount: number;
	}): Lesson[] {
		// Generate dates for weekly recurrence
		const dates: string[] = [];
		const start = new Date(config.startDate);

		for (let i = 0; i < config.weeksCount; i++) {
			const currentDate = new Date(start);
			currentDate.setDate(start.getDate() + i * 7);
			dates.push(currentDate.toISOString().split("T")[0]);
		}

		return this.bulkCreateLessons({
			courseId: config.courseId,
			title: config.title,
			location: config.location,
			time: config.time,
			dayOfWeek: config.dayOfWeek,
			capacity: config.capacity,
			dates,
		});
	}

	getLessonsByCourse(courseId: string): Lesson[] {
		return LessonDB.getByCourse(courseId) as Lesson[];
	}
}
