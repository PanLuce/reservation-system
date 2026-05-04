import { CourseDB, LessonDB } from "./database.js";
import type { Lesson } from "./lesson.js";
import { toDateString } from "./types.js";

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
			dates.push(toDateString(currentDate));
		}

		return this.bulkCreateLessons({
			courseId: config.courseId,
			title: config.title,
			time: config.time,
			dayOfWeek: config.dayOfWeek,
			capacity: config.capacity,
			dates,
		});
	}

	async bulkCreateLessonsRange(config: {
		courseId: string;
		title: string;
		time: string;
		dayOfWeek: string;
		capacity: number;
		startDate: string;
		endDate: string;
	}): Promise<Lesson[]> {
		const start = new Date(config.startDate);
		const end = new Date(config.endDate);
		if (end < start) {
			throw new Error("endDate must be on or after startDate");
		}

		const dayNames = [
			"Sunday",
			"Monday",
			"Tuesday",
			"Wednesday",
			"Thursday",
			"Friday",
			"Saturday",
		];
		const targetDay = dayNames.indexOf(config.dayOfWeek);
		if (targetDay === -1) {
			throw new Error(`Invalid dayOfWeek: ${config.dayOfWeek}`);
		}

		const dates: string[] = [];
		const current = new Date(start);
		// Advance to the first occurrence of the target weekday on or after startDate
		while (current.getUTCDay() !== targetDay) {
			current.setUTCDate(current.getUTCDate() + 1);
		}
		while (current <= end) {
			dates.push(toDateString(current));
			current.setUTCDate(current.getUTCDate() + 7);
		}

		if (dates.length > 52) {
			throw new Error(
				`Too many lessons: range produces ${dates.length} lessons (max 52)`,
			);
		}

		return this.bulkCreateLessons({
			courseId: config.courseId,
			title: config.title,
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
