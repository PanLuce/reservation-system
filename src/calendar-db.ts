import { CourseDB, LessonDB } from "./database.js";
import type { Lesson } from "./lesson.js";

export class LessonCalendarDB {
	async addLesson(lesson: Lesson): Promise<void> {
		await LessonDB.insert(lesson);
	}

	async getAllLessons(): Promise<Lesson[]> {
		return (await LessonDB.getAll()) as unknown as Lesson[];
	}

	async getLessonsByDay(day: string): Promise<Lesson[]> {
		return (await LessonDB.getByDay(day)) as unknown as Lesson[];
	}

	async getLessonById(id: string): Promise<Lesson | undefined> {
		return (await LessonDB.getById(id)) as Lesson | undefined;
	}

	async updateLesson(id: string, updates: Partial<Lesson>): Promise<void> {
		await LessonDB.update(id, updates);
	}

	async bulkUpdateLessons(
		filter: Partial<Lesson>,
		updates: Partial<Lesson>,
	): Promise<number> {
		const result = await LessonDB.bulkUpdate(filter, updates);
		return result.changes;
	}

	async bulkDeleteLessons(filter: Partial<Lesson>): Promise<number> {
		const result = await LessonDB.bulkDelete(filter);
		return result.changes;
	}

	async bulkCreateLessons(config: {
		courseId: string;
		title: string;
		location: string;
		time: string;
		dayOfWeek: string;
		capacity: number;
		dates: string[];
	}): Promise<Lesson[]> {
		if (!config.dates || config.dates.length === 0) {
			throw new Error("At least one date is required");
		}

		// Get course to retrieve age group
		const course = (await CourseDB.getById(config.courseId)) as
			| Record<string, unknown>
			| undefined;
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

			await LessonDB.insertWithCourse(lesson, config.courseId);
			createdLessons.push(lesson);
		}

		return createdLessons;
	}

	async bulkCreateLessonsRecurring(config: {
		courseId: string;
		title: string;
		location: string;
		time: string;
		dayOfWeek: string;
		capacity: number;
		startDate: string;
		weeksCount: number;
	}): Promise<Lesson[]> {
		// Generate dates for weekly recurrence
		const dates: string[] = [];
		const start = new Date(config.startDate);

		for (let i = 0; i < config.weeksCount; i++) {
			const currentDate = new Date(start);
			currentDate.setDate(start.getDate() + i * 7);
			dates.push(currentDate.toISOString().split("T")[0]!);
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

	async getLessonsByCourse(courseId: string): Promise<Lesson[]> {
		return (await LessonDB.getByCourse(courseId)) as unknown as Lesson[];
	}
}
