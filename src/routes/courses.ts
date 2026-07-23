import express from "express";
import { ageGroupToColor, isValidAgeGroup } from "../age-groups.js";
import { calendar, registrationManager } from "../app-context.js";
import { createCourse } from "../course.js";
import { CourseDB, ParticipantDB, ProgramDB } from "../database.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { createProgram } from "../program.js";

export const coursesRouter = express.Router();

// Courses (skupinky) — CRUD
coursesRouter.get("/api/courses", requireAuth, async (_req, res) => {
	res.json(await CourseDB.getAll());
});

coursesRouter.get(
	"/api/courses/age-group/:ageGroup",
	requireAuth,
	async (req, res) => {
		const courses = await CourseDB.getByAgeGroup(
			decodeURIComponent(req.params.ageGroup as string),
		);
		res.json(courses);
	},
);

coursesRouter.get("/api/courses/:id", requireAuth, async (req, res) => {
	const course = await CourseDB.getById(req.params.id as string);
	if (!course) {
		return res.status(404).json({ error: "Course not found" });
	}
	res.json(course);
});

coursesRouter.post("/api/courses", requireAdmin, async (req, res) => {
	try {
		const course = createCourse({
			name: req.body.name,
			ageGroup: req.body.ageGroup,
			location: req.body.location,
			color: req.body.color, // optional — derived from ageGroup if absent
			description: req.body.description,
			programId: req.body.programId, // optional — links the Skupinka to a parent Program
		});
		await CourseDB.insert(course);
		res.status(201).json(course);
	} catch (error) {
		res
			.status(400)
			.json({ error: error instanceof Error ? error.message : "Invalid data" });
	}
});

coursesRouter.put("/api/courses/:id", requireAdmin, async (req, res) => {
	const id = req.params.id as string;
	const existing = await CourseDB.getById(id);
	if (!existing) {
		return res.status(404).json({ error: "Course not found" });
	}
	try {
		const { name, ageGroup, location, description, programId } = req.body;
		// Always derive color when ageGroup is valid; otherwise keep color from body (manual override)
		const color =
			ageGroup && isValidAgeGroup(ageGroup)
				? ageGroupToColor(ageGroup)
				: (req.body.color as string | undefined);
		const updatePayload =
			color !== undefined
				? { name, ageGroup, location, color, description, programId }
				: { name, ageGroup, location, description, programId };
		await CourseDB.update(id, updatePayload);
		res.json(await CourseDB.getById(id));
	} catch (error) {
		res
			.status(400)
			.json({ error: error instanceof Error ? error.message : "Invalid data" });
	}
});

coursesRouter.delete("/api/courses/:id", requireAdmin, async (req, res) => {
	const id = req.params.id as string;
	const existing = await CourseDB.getById(id);
	if (!existing) {
		return res.status(404).json({ error: "Course not found" });
	}
	await CourseDB.delete(id);
	res.json({ message: "Course deleted" });
});

// Programs (Kurzy) — parent grouping of Skupinky (courses). CRUD.
coursesRouter.get("/api/programs", requireAuth, async (_req, res) => {
	res.json(await ProgramDB.getAll());
});

coursesRouter.get("/api/programs/:id", requireAuth, async (req, res) => {
	const program = await ProgramDB.getById(req.params.id as string);
	if (!program) {
		return res.status(404).json({ error: "Program not found" });
	}
	res.json(program);
});

coursesRouter.post("/api/programs", requireAdmin, async (req, res) => {
	try {
		const program = createProgram({
			name: req.body.name,
			ageGroup: req.body.ageGroup,
			color: req.body.color, // optional — derived from ageGroup if absent
			description: req.body.description,
		});
		await ProgramDB.insert(program);
		res.status(201).json(program);
	} catch (error) {
		res
			.status(400)
			.json({ error: error instanceof Error ? error.message : "Invalid data" });
	}
});

coursesRouter.put("/api/programs/:id", requireAdmin, async (req, res) => {
	const id = req.params.id as string;
	const existing = await ProgramDB.getById(id);
	if (!existing) {
		return res.status(404).json({ error: "Program not found" });
	}
	try {
		const { name, ageGroup, description } = req.body;
		// Re-derive color when ageGroup is valid; otherwise honor an explicit override.
		const color =
			ageGroup && isValidAgeGroup(ageGroup)
				? ageGroupToColor(ageGroup)
				: (req.body.color as string | undefined);
		const updatePayload =
			color !== undefined
				? { name, ageGroup, color, description }
				: { name, ageGroup, description };
		await ProgramDB.update(id, updatePayload);
		res.json(await ProgramDB.getById(id));
	} catch (error) {
		res
			.status(400)
			.json({ error: error instanceof Error ? error.message : "Invalid data" });
	}
});

coursesRouter.delete("/api/programs/:id", requireAdmin, async (req, res) => {
	const id = req.params.id as string;
	const existing = await ProgramDB.getById(id);
	if (!existing) {
		return res.status(404).json({ error: "Program not found" });
	}
	await ProgramDB.delete(id);
	res.json({ message: "Program deleted" });
});

// Course-scoped lesson creation / listing
coursesRouter.post(
	"/api/courses/:courseId/bulk-lessons",
	requireAdmin,
	async (req, res) => {
		const courseId = req.params.courseId as string;
		if (!courseId) {
			return res.status(400).json({ error: "Course ID is required" });
		}

		const {
			title,
			time,
			dayOfWeek,
			capacity,
			dates,
			startDate,
			endDate,
			weeksCount,
		} = req.body;

		try {
			let lessons: Awaited<ReturnType<typeof calendar.bulkCreateLessons>>;
			if (dates && Array.isArray(dates)) {
				lessons = await calendar.bulkCreateLessons({
					courseId,
					title,
					time,
					dayOfWeek,
					capacity: Number(capacity),
					dates,
				});
			} else if (startDate && endDate) {
				lessons = await calendar.bulkCreateLessonsRange({
					courseId,
					title,
					time,
					dayOfWeek,
					capacity: Number(capacity),
					startDate,
					endDate,
				});
			} else if (startDate && weeksCount) {
				lessons = await calendar.bulkCreateLessonsRecurring({
					courseId,
					title,
					time,
					dayOfWeek,
					capacity: Number(capacity),
					startDate,
					weeksCount: Number(weeksCount),
				});
			} else {
				return res.status(400).json({
					error:
						"Either dates array, (startDate + endDate), or (startDate + weeksCount) is required",
				});
			}

			// If the roster is bigger than what these lessons can hold, defer
			// enrollment to an explicit admin choice instead of silently
			// waitlisting the overflow — see resolve-lesson-overflow below.
			const roster = await ParticipantDB.getByCourse(courseId);
			const numericCapacity = Number(capacity);
			if (roster.length > numericCapacity) {
				return res.status(201).json({
					message: `Created ${lessons.length} lessons`,
					lessons,
					needsResolution: true,
					capacity: numericCapacity,
					roster: roster.map((member) => ({
						id: member.id as string,
						name: member.name as string,
					})),
				});
			}

			// Silent: notifying parents once per newly-created lesson would mean
			// up to (roster size × new lessons) emails from a single admin click.
			// Participant-add and ODS-import keep emailing as before — this is
			// the only sync trigger that opts out.
			const sync = await registrationManager.syncGroupEnrollments(courseId, {
				sendEmails: false,
			});

			res.status(201).json({
				message: `Created ${lessons.length} lessons`,
				lessons,
				enrolled: sync.enrolled,
				skipped: sync.skipped,
			});
		} catch (error) {
			res.status(400).json({
				error:
					error instanceof Error ? error.message : "Failed to create lessons",
			});
		}
	},
);

coursesRouter.get("/api/courses/:courseId/lessons", async (req, res) => {
	const courseId = req.params.courseId as string;
	if (!courseId) {
		return res.status(400).json({ error: "Course ID is required" });
	}

	const lessons = await calendar.getLessonsByCourse(courseId);
	res.json(lessons);
});
