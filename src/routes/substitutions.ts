import express from "express";
import { publicWriteRateLimit, registrationManager } from "../app-context.js";
import { validateParticipantInput } from "../input-validation.js";
import { createParticipant } from "../participant.js";

export const substitutionsRouter = express.Router();

// Substitutions
substitutionsRouter.get("/api/substitutions/:ageGroup", async (req, res) => {
	const availableLessons =
		await registrationManager.getAvailableSubstitutionLessons(
			req.params.ageGroup as string,
		);
	res.json(availableLessons);
});

substitutionsRouter.post(
	"/api/substitutions",
	publicWriteRateLimit,
	async (req, res) => {
		const { lessonId, participant, missedLessonId } = req.body;

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

		const registration = await registrationManager.registerForSubstitution(
			lessonId,
			newParticipant,
			missedLessonId,
		);
		res.status(201).json(registration);
	},
);
