export function toDateString(date: Date): string {
	return date.toISOString().slice(0, 10);
}

// The app runs in UTC on Render but serves the Czech (Europe/Prague, UTC+1/+2)
// timezone. Using a UTC "today" to compare against stored local date strings is
// off by one between local midnight and 01:00–02:00. This returns today's date
// in Prague regardless of the server's timezone. `en-CA` yields ISO YYYY-MM-DD.
export function localDateString(date: Date = new Date()): string {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Europe/Prague",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

export type Registration = {
	id: string;
	lessonId: string;
	participantId: string;
	registeredAt: Date;
	status: "confirmed" | "waitlist" | "cancelled";
	missedLessonId?: string;
};
