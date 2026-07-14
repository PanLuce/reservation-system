import express from "express";
import { publicWriteRateLimit, registrationManager } from "../app-context.js";
import {
	CourseDB,
	CreditDB,
	LessonDB,
	ParticipantDB,
	RegistrationDB,
} from "../database.js";
import { validateParticipantInput } from "../input-validation.js";
import { requireParticipantScope } from "../middleware/auth.js";
import { createParticipant } from "../participant.js";
import { localDateString } from "../types.js";

export const registrationsRouter = express.Router();

// Registrations
registrationsRouter.post(
	"/api/registrations",
	publicWriteRateLimit,
	async (req, res) => {
		const { lessonId, participant } = req.body;

		const validationError = validateParticipantInput(participant ?? {});
		if (validationError) {
			return res.status(400).json({ error: validationError });
		}

		const newParticipant = createParticipant({
			name: participant.name,
			email: participant.email,
			phone: participant.phone,
			ageGroup: participant.ageGroup,
		});

		const registration = await registrationManager.registerParticipant(
			lessonId,
			newParticipant,
		);
		res.status(201).json(registration);
	},
);

registrationsRouter.get(
	"/api/registrations/lesson/:lessonId",
	async (req, res) => {
		const registrations = await registrationManager.getRegistrationsForLesson(
			req.params.lessonId as string,
		);
		res.json(registrations);
	},
);

registrationsRouter.get(
	"/api/participants/:participantId/registrations",
	requireParticipantScope,
	async (req, res) => {
		const participantId = req.params.participantId as string;
		if (!participantId) {
			return res.status(400).json({ error: "Participant ID is required" });
		}
		const registrations =
			await ParticipantDB.getRegistrationsWithLessonDetails(participantId);
		res.json(registrations);
	},
);

// Participant Self-Service
registrationsRouter.post(
	"/api/participants/:participantId/cancel-registration",
	requireParticipantScope,
	async (req, res) => {
		const participantId = req.params.participantId as string;
		const { registrationId } = req.body;

		if (!participantId) {
			return res.status(400).json({ error: "Participant ID is required" });
		}

		if (!registrationId) {
			return res.status(400).json({ error: "Registration ID is required" });
		}

		const result = await registrationManager.participantCancelRegistration(
			registrationId,
			participantId,
		);

		if (result.success) {
			res.json(result);
		} else {
			res.status(403).json(result);
		}
	},
);

registrationsRouter.post(
	"/api/participants/:participantId/register-lesson",
	requireParticipantScope,
	async (req, res) => {
		const participantId = req.params.participantId as string;
		const { lessonId } = req.body;

		if (!participantId) {
			return res.status(400).json({ error: "Participant ID is required" });
		}

		if (!lessonId) {
			return res.status(400).json({ error: "Lesson ID is required" });
		}

		const result = await registrationManager.participantSelfRegister(
			lessonId,
			participantId,
		);

		if (result.success) {
			res.status(201).json(result);
		} else if ("noCredit" in result && result.noCredit) {
			res.status(402).json(result);
		} else {
			res.status(400).json(result);
		}
	},
);

registrationsRouter.post(
	"/api/participants/:participantId/transfer-lesson",
	requireParticipantScope,
	async (req, res) => {
		const participantId = req.params.participantId as string;
		const { currentRegistrationId, newLessonId } = req.body;

		if (!participantId) {
			return res.status(400).json({ error: "Participant ID is required" });
		}

		if (!currentRegistrationId || !newLessonId) {
			return res.status(400).json({
				error: "Both currentRegistrationId and newLessonId are required",
			});
		}

		const result = await registrationManager.participantTransferLesson(
			currentRegistrationId,
			newLessonId,
			participantId,
		);

		if (result.success) {
			res.json(result);
		} else {
			res.status(400).json(result);
		}
	},
);

registrationsRouter.get(
	"/api/participants/:participantId/available-lessons",
	requireParticipantScope,
	async (req, res) => {
		const participantId = req.params.participantId as string;

		if (!participantId) {
			return res.status(400).json({ error: "Participant ID is required" });
		}

		const lessons =
			await registrationManager.getAvailableLessonsForParticipant(
				participantId,
			);

		res.json(lessons);
	},
);

registrationsRouter.get(
	"/api/participants/:participantId/substitution-candidates",
	requireParticipantScope,
	async (req, res) => {
		const participantId = req.params.participantId as string;

		const participantCourses =
			await ParticipantDB.getCoursesForParticipant(participantId);
		const participantAgeGroups = new Set(
			participantCourses.map((c) => c.ageGroup as string),
		);
		const participantCourseIds = new Set(
			participantCourses.map((c) => c.id as string),
		);

		const today = localDateString();

		const existingRegs = await RegistrationDB.getByParticipantId(participantId);
		const registeredLessonIds = new Set(
			existingRegs
				.filter((r) => r.status !== "cancelled")
				.map((r) => r.lessonId as string),
		);

		const allCourses = await CourseDB.getAll();
		const sameAgeGroupCourseIds = allCourses
			.filter(
				(c) =>
					participantAgeGroups.has(c.ageGroup as string) &&
					!participantCourseIds.has(c.id as string),
			)
			.map((c) => c.id as string);

		const candidates: unknown[] = [];
		for (const courseId of sameAgeGroupCourseIds) {
			const lessons = await LessonDB.getByCourse(courseId);
			for (const lesson of lessons) {
				if (
					(lesson.date as string) >= today &&
					!registeredLessonIds.has(lesson.id as string) &&
					(lesson.enrolledCount as number) < (lesson.capacity as number)
				) {
					candidates.push(lesson);
				}
			}
		}

		res.json(candidates);
	},
);

registrationsRouter.get(
	"/api/participants/:participantId/credits",
	requireParticipantScope,
	async (req, res) => {
		const participantId = req.params.participantId as string;
		const credits = await CreditDB.getActiveByParticipant(participantId);
		res.json({ count: credits.length, credits });
	},
);
