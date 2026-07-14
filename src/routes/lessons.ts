import express from "express";
import { AGE_GROUPS } from "../age-groups.js";
import { calendar, registrationManager } from "../app-context.js";
import { CourseDB } from "../database.js";
import { createLesson, pickUpdatableLessonFields } from "../lesson.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";

export const lessonsRouter = express.Router();

// Lessons (public read, admin write)
lessonsRouter.get("/api/lessons", async (_req, res) => {
	const lessons = await calendar.getAllLessons();
	const courses = await CourseDB.getAll();
	const courseMap = new Map(courses.map((c) => [c.id as string, c]));
	const enriched = lessons.map((l) => {
		const course = l.courseId ? courseMap.get(l.courseId as string) : undefined;
		return {
			...l,
			courseColor: course?.color ?? null,
			courseName: course?.name ?? null,
		};
	});
	res.json(enriched);
});

lessonsRouter.get("/api/lessons/:id", async (req, res) => {
	const lesson = await calendar.getLessonById(req.params.id as string);
	if (!lesson) {
		return res.status(404).json({ error: "Lesson not found" });
	}
	res.json(lesson);
});

lessonsRouter.post("/api/lessons", requireAdmin, async (req, res) => {
	const lessonData = req.body;
	const requiredFields = [
		"title",
		"date",
		"dayOfWeek",
		"time",
		"ageGroup",
		"capacity",
		"courseId",
	] as const;
	for (const field of requiredFields) {
		if (!lessonData[field] && lessonData[field] !== 0) {
			return res.status(400).json({ error: `${field} is required` });
		}
	}
	const courseExists = await CourseDB.getById(lessonData.courseId as string);
	if (!courseExists) {
		return res.status(400).json({ error: "Course not found" });
	}
	try {
		const lesson = createLesson({
			title: lessonData.title,
			date: lessonData.date,
			dayOfWeek: lessonData.dayOfWeek,
			time: lessonData.time,
			ageGroup: lessonData.ageGroup,
			capacity: Number(lessonData.capacity),
			courseId: lessonData.courseId as string,
		});
		await calendar.addLesson(lesson);
		await registrationManager.syncGroupEnrollments(
			lessonData.courseId as string,
		);
		res.status(201).json(lesson);
	} catch (error) {
		res.status(500).json({
			error: error instanceof Error ? error.message : "Failed to create lesson",
		});
	}
});

lessonsRouter.put("/api/lessons/:id", requireAdmin, async (req, res) => {
	const lessonId = req.params.id as string;
	if (!lessonId) {
		return res.status(400).json({ error: "Lesson ID is required" });
	}
	const lesson = await calendar.getLessonById(lessonId);
	if (!lesson) {
		return res.status(404).json({ error: "Lesson not found" });
	}
	const updates = pickUpdatableLessonFields(req.body);
	if (Object.keys(updates).length === 0) {
		return res.status(400).json({ error: "No updatable fields provided" });
	}
	await calendar.updateLesson(lessonId, updates);
	const updated = await calendar.getLessonById(lessonId);
	res.json(updated);
});

lessonsRouter.delete("/api/lessons/:id", requireAdmin, async (req, res) => {
	const lessonId = req.params.id as string;
	if (!lessonId) {
		return res.status(400).json({ error: "Lesson ID is required" });
	}
	const count = await calendar.bulkDeleteLessons({ id: lessonId });
	if (count === 0) {
		return res.status(404).json({ error: "Lesson not found" });
	}
	res.json({ message: "Lesson deleted" });
});

// Age groups list (for populating dropdowns)
lessonsRouter.get("/api/age-groups", requireAuth, (_req, res) => {
	res.json(AGE_GROUPS);
});
