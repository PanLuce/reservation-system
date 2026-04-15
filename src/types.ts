export type Registration = {
	id: string;
	lessonId: string;
	participantId: string;
	registeredAt: Date;
	status: "confirmed" | "waitlist" | "cancelled";
	missedLessonId?: string;
};
