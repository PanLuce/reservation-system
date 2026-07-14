import express from "express";
import { registrationManager } from "../app-context.js";
import { issueCredit } from "../credit.js";
import { CreditDB, LessonDB, RegistrationDB } from "../database.js";
import { requireAdmin } from "../middleware/auth.js";

export const adminRouter = express.Router();

// Admin Override
adminRouter.post(
	"/api/admin/register-participant",
	requireAdmin,
	async (req, res) => {
		const { lessonId, participantId, forceCapacity } = req.body;

		if (!lessonId || !participantId) {
			return res.status(400).json({
				error: "Both lessonId and participantId are required",
			});
		}

		const result = await registrationManager.adminRegisterParticipant(
			lessonId,
			participantId,
			{ forceCapacity: forceCapacity || false },
		);

		if (result.success) {
			res.status(201).json(result);
		} else {
			res.status(400).json(result);
		}
	},
);

adminRouter.post(
	"/api/admin/cancel-registration",
	requireAdmin,
	async (req, res) => {
		const { registrationId, excused } = req.body;

		if (!registrationId) {
			return res.status(400).json({ error: "Registration ID is required" });
		}

		const result =
			await registrationManager.adminCancelRegistration(registrationId);

		if (!result.success) {
			return res.status(404).json(result);
		}

		if (excused) {
			const reg = await RegistrationDB.getById(registrationId);
			if (reg) {
				const lesson = await LessonDB.getById(reg.lessonId as string);
				if (lesson?.courseId) {
					await issueCredit(
						reg.participantId as string,
						registrationId,
						lesson.courseId as string,
					);
				}
			}
		}

		res.json(result);
	},
);

adminRouter.post(
	"/api/admin/bulk-register-participant",
	requireAdmin,
	async (req, res) => {
		const { participantId, lessonIds } = req.body;

		if (!participantId || !lessonIds || !Array.isArray(lessonIds)) {
			return res.status(400).json({
				error: "participantId and lessonIds array are required",
			});
		}

		const result = await registrationManager.adminBulkRegisterParticipant(
			participantId,
			lessonIds,
		);

		res.status(result.success ? 201 : 400).json(result);
	},
);

// Extend and shorten are the same operation — set a credit's expiry to a new
// date. Two routes are kept for API clarity; they share one handler.
async function setCreditExpiry(req: express.Request, res: express.Response) {
	const creditId = req.params.creditId as string;
	const { newExpiresAt } = req.body;
	if (!newExpiresAt) {
		return res.status(400).json({ error: "newExpiresAt is required" });
	}
	const result = await CreditDB.updateExpiry(creditId, newExpiresAt);
	if (result.changes === 0) {
		return res.status(404).json({ error: "Credit not found" });
	}
	const updated = await CreditDB.getById(creditId);
	res.json(updated);
}

adminRouter.post(
	"/api/admin/participants/:participantId/credits/:creditId/extend",
	requireAdmin,
	setCreditExpiry,
);

adminRouter.post(
	"/api/admin/participants/:participantId/credits/:creditId/shorten",
	requireAdmin,
	setCreditExpiry,
);
