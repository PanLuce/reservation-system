export function toDateString(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export type Registration = {
	id: string;
	lessonId: string;
	participantId: string;
	registeredAt: Date;
	status: "confirmed" | "waitlist" | "cancelled";
	missedLessonId?: string;
};
