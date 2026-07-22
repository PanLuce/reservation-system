import express from "express";
import { calendar, registrationManager } from "../app-context.js";
import { CourseDB, client, LessonDB, ParticipantDB } from "../database.js";
import { requireAdmin } from "../middleware/auth.js";
import { createParticipant } from "../participant.js";
import { localDateString } from "../types.js";

export const participantsRouter = express.Router();

participantsRouter.post(
	"/api/courses/:id/participants",
	requireAdmin,
	async (req, res) => {
		const courseId = req.params.id as string;
		const { name, email, phone } = req.body as {
			name?: string;
			email?: string;
			phone?: string;
		};

		if (!email || !name) {
			return res.status(400).json({ error: "name and email are required" });
		}

		const course = await CourseDB.getById(courseId);
		if (!course) {
			return res.status(404).json({ error: "Course not found" });
		}

		// Upsert by email + name, not email alone — siblings share a parent email,
		// so matching on email alone would collapse the second kid into the first
		// (see ODS importer, which already upserts the same way for this reason).
		let existingParticipant = (await ParticipantDB.getByEmailAndName(
			email,
			name,
		)) as Record<string, unknown> | undefined;
		let created = false;

		if (!existingParticipant) {
			const newParticipant = createParticipant({
				name,
				email,
				phone: phone ?? "",
				ageGroup: course.ageGroup as string,
			});
			await ParticipantDB.insert(newParticipant);
			existingParticipant = newParticipant as unknown as Record<
				string,
				unknown
			>;
			created = true;
		}

		const participantId = existingParticipant.id as string;

		// Idempotent link
		await ParticipantDB.linkToCourse(participantId, courseId);

		// Auto-enroll in all future lessons
		await registrationManager.syncGroupEnrollments(courseId);

		res.status(created ? 201 : 200).json({
			participant: existingParticipant,
			created,
		});
	},
);

participantsRouter.post(
	"/api/courses/:id/sync-enrollments",
	requireAdmin,
	async (req, res) => {
		const id = req.params.id as string;
		const existing = await CourseDB.getById(id);
		if (!existing) {
			return res.status(404).json({ error: "Course not found" });
		}
		const result = await registrationManager.syncGroupEnrollments(id);
		res.json(result);
	},
);

participantsRouter.post(
	"/api/courses/:courseId/bulk-register",
	requireAdmin,
	async (req, res) => {
		const courseId = req.params.courseId as string;
		if (!courseId) {
			return res.status(400).json({ error: "Course ID is required" });
		}

		const { participantIds, lessonIds } = req.body;

		if (
			!participantIds ||
			!Array.isArray(participantIds) ||
			participantIds.length === 0
		) {
			return res
				.status(400)
				.json({ error: "participantIds array is required" });
		}

		if (!lessonIds || !Array.isArray(lessonIds) || lessonIds.length === 0) {
			return res.status(400).json({ error: "lessonIds array is required" });
		}

		try {
			const result = await registrationManager.bulkAssignGroupToLessons({
				participantIds,
				lessonIds,
			});

			res.status(201).json({
				message: `Bulk registration completed`,
				...result,
			});
		} catch (error) {
			res.status(500).json({
				error:
					error instanceof Error
						? error.message
						: "Failed to process bulk registration",
			});
		}
	},
);

participantsRouter.get(
	"/api/courses/:courseId/participants",
	requireAdmin,
	async (req, res) => {
		const courseId = req.params.courseId as string;
		if (!courseId) {
			return res.status(400).json({ error: "Course ID is required" });
		}

		const withCounts =
			await ParticipantDB.getByCourseWithRemainingLessons(courseId);
		res.json(withCounts);
	},
);

participantsRouter.get(
	"/api/lessons/:lessonId/participants",
	requireAdmin,
	async (req, res) => {
		const lessonId = req.params.lessonId as string;
		if (!lessonId) {
			return res.status(400).json({ error: "Lesson ID is required" });
		}
		const lesson = (await calendar.getLessonById(lessonId)) as
			| Record<string, unknown>
			| undefined;
		if (!lesson) {
			return res.status(404).json({ error: "Lesson not found" });
		}
		const courseId = lesson.courseId as string | undefined;

		const result = await client.execute({
			sql: `SELECT p.id, p.name, p.email, p.phone, p.ageGroup
				FROM participants p
				INNER JOIN registrations r ON p.id = r.participantId
				WHERE r.lessonId = ? AND r.status != 'cancelled'`,
			args: [lessonId],
		});

		const withCounts = await Promise.all(
			result.rows.map(async (p) => ({
				...p,
				remainingLessons: courseId
					? await ParticipantDB.countRemainingLessonsInCourse(
							p.id as string,
							courseId,
						)
					: 0,
			})),
		);
		res.json(withCounts);
	},
);

participantsRouter.get(
	"/api/admin/participants",
	requireAdmin,
	async (_req, res) => {
		const enriched = await ParticipantDB.getAllWithCourseSummaries();
		res.json(enriched);
	},
);

participantsRouter.post(
	"/api/admin/participants/:participantId/transfer-course",
	requireAdmin,
	async (req, res) => {
		const participantId = req.params.participantId as string;
		const { fromCourseId, toCourseId, registerCount } = req.body as {
			fromCourseId: string;
			toCourseId: string;
			registerCount?: number;
		};

		if (!participantId || !fromCourseId || !toCourseId) {
			return res.status(400).json({
				error: "participantId, fromCourseId and toCourseId are required",
			});
		}

		const today = localDateString();

		const remainingInOld = await ParticipantDB.countRemainingLessonsInCourse(
			participantId,
			fromCourseId,
		);

		const betaLessonsRaw = await LessonDB.getByCourse(toCourseId);
		const futureInNew = (
			betaLessonsRaw as Array<Record<string, unknown>>
		).filter((l) => (l.date as string) >= today).length;

		if (registerCount === undefined) {
			// Phase 1 — report counts only
			const conflict = remainingInOld !== futureInNew;
			return res.json({ remainingInOld, futureInNew, conflict });
		}

		// Phase 2 — perform transfer
		await registrationManager.cancelFutureRegistrationsInCourse(
			participantId,
			fromCourseId,
		);
		await ParticipantDB.unlinkFromCourse(participantId, fromCourseId);
		await ParticipantDB.linkToCourse(participantId, toCourseId);
		const { enrolled } = await registrationManager.registerFirstNFutureLessons(
			toCourseId,
			participantId,
			registerCount,
		);

		res.json({ success: true, enrolled });
	},
);
