import { localDateString } from "./types.js";

/**
 * Returns true if the lesson date's midnight has already passed,
 * meaning self-service cancel/register is no longer allowed.
 *
 * The cutoff is midnight (Europe/Prague) at the start of the lesson's day.
 * After that moment, only admins can modify registrations. Compares Prague-local
 * date strings (YYYY-MM-DD) rather than Date objects, so it is timezone-independent
 * regardless of the server's timezone (Render runs in UTC).
 */
export function isAfterMidnightCutoff(
	lessonDate: string,
	now: Date = new Date(),
): boolean {
	return localDateString(now) >= lessonDate;
}
