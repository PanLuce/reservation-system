import { randomUUID } from "node:crypto";
import { CreditDB, LessonDB } from "./database.js";

function addMonths(date: Date, months: number): Date {
	const d = new Date(date);
	d.setMonth(d.getMonth() + months);
	return d;
}

async function computeExpiry(
	courseId: string,
	earnedAt: Date,
): Promise<string> {
	const threeMonths = addMonths(earnedAt, 3);

	const lessons = await LessonDB.getByCourse(courseId);
	if (lessons.length === 0) return threeMonths.toISOString();

	const latestLesson = lessons.reduce((max, l) =>
		(l.date as string) > (max.date as string) ? l : max,
	);
	const courseEnd = new Date(latestLesson.date as string);

	return (courseEnd < threeMonths ? courseEnd : threeMonths).toISOString();
}

export async function issueCredit(
	participantId: string,
	registrationId: string,
	courseId: string,
): Promise<void> {
	const expiresAt = await computeExpiry(courseId, new Date());
	await CreditDB.insert({
		id: randomUUID(),
		participantId,
		earnedFromRegistrationId: registrationId,
		expiresAt,
	});
}

export async function consumeCredit(
	participantId: string,
	registrationId: string,
): Promise<boolean> {
	const credits = await CreditDB.getActiveByParticipant(participantId);
	if (credits.length === 0) return false;

	// biome-ignore lint/style/noNonNullAssertion: guarded by length check above
	await CreditDB.markUsed(credits[0]!.id as string, registrationId);
	return true;
}

export async function countActiveCredits(
	participantId: string,
): Promise<number> {
	const credits = await CreditDB.getActiveByParticipant(participantId);
	return credits.length;
}
