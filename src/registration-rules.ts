/**
 * Returns true if the lesson date's midnight has already passed,
 * meaning self-service cancel/register is no longer allowed.
 *
 * The cutoff is midnight (00:00:00) on the day of the lesson.
 * After that moment, only admins can modify registrations.
 */
export function isAfterMidnightCutoff(
	lessonDate: string,
	now: Date = new Date(),
): boolean {
	const midnight = new Date(lessonDate);
	midnight.setHours(0, 0, 0, 0);
	return now >= midnight;
}
