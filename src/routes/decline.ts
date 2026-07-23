import express from "express";
import { publicWriteRateLimit, registrationManager } from "../app-context.js";
import { LessonDB, ParticipantDB, RegistrationDB } from "../database.js";

export const declineRouter = express.Router();

// Public — reached from an email link, no login. Status doubles as the
// idempotency guard: once a registration is no longer 'confirmed' the token
// is treated as spent, so a stale/reused link can't be replayed.
declineRouter.get("/api/decline/:token", async (req, res) => {
	const token = req.params.token as string;
	const registration = await RegistrationDB.getByDeclineToken(token);
	if (!registration || registration.status !== "confirmed") {
		return res
			.status(404)
			.json({ error: "Odkaz je neplatný nebo již byl použit" });
	}

	const [participant, lesson] = await Promise.all([
		ParticipantDB.getById(registration.participantId as string),
		LessonDB.getById(registration.lessonId as string),
	]);
	if (!participant || !lesson) {
		return res
			.status(404)
			.json({ error: "Odkaz je neplatný nebo již byl použit" });
	}

	res.json({
		participant: { name: participant.name },
		lesson: {
			title: lesson.title,
			dayOfWeek: lesson.dayOfWeek,
			time: lesson.time,
			date: lesson.date,
		},
	});
});

declineRouter.post(
	"/api/decline/:token",
	publicWriteRateLimit,
	async (req, res) => {
		const token = req.params.token as string;
		const registration = await RegistrationDB.getByDeclineToken(token);
		if (!registration) {
			return res.status(404).json({ error: "Odkaz je neplatný" });
		}
		if (registration.status !== "confirmed") {
			return res.json({ alreadyDeclined: true });
		}

		// cancelRegistration already cascades to the next waitlisted participant
		// for a confirmed cancellation (wired in REQ-2 slice 1) — no separate
		// promotion call needed here.
		await registrationManager.cancelRegistration(registration.id as string);
		res.json({ declined: true });
	},
);
