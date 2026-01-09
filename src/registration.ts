import type { LessonCalendar } from "./calendar";
import type { Participant } from "./participant";

export type Registration = {
	id: string;
	lessonId: string;
	participantId: string;
	registeredAt: Date;
	status: "confirmed" | "waitlist" | "cancelled";
};

export class RegistrationManager {
	private registrations: Registration[] = [];
	private calendar: LessonCalendar;

	constructor(calendar: LessonCalendar) {
		this.calendar = calendar;
	}

	registerParticipant(
		lessonId: string,
		participant: Participant,
	): Registration {
		const lesson = this.calendar.getLessonById(lessonId);
		if (!lesson) {
			throw new Error(`Lesson ${lessonId} not found`);
		}

		const isFull = lesson.enrolledCount >= lesson.capacity;
		const status = isFull ? "waitlist" : "confirmed";

		const registration: Registration = {
			id: this.generateId(),
			lessonId,
			participantId: participant.id,
			registeredAt: new Date(),
			status,
		};

		this.registrations.push(registration);

		if (!isFull) {
			this.calendar.updateLesson(lessonId, {
				enrolledCount: lesson.enrolledCount + 1,
			});
		}

		return registration;
	}

	bulkRegisterParticipants(
		lessonId: string,
		participants: Participant[],
	): Registration[] {
		const registrations: Registration[] = [];
		for (const participant of participants) {
			registrations.push(this.registerParticipant(lessonId, participant));
		}
		return registrations;
	}

	getRegistrationsForLesson(lessonId: string): Registration[] {
		return this.registrations.filter((r) => r.lessonId === lessonId);
	}

	cancelRegistration(registrationId: string): void {
		const registration = this.registrations.find(
			(r) => r.id === registrationId,
		);
		if (!registration) {
			throw new Error(`Registration ${registrationId} not found`);
		}

		if (registration.status === "confirmed") {
			const lesson = this.calendar.getLessonById(registration.lessonId);
			if (lesson) {
				this.calendar.updateLesson(registration.lessonId, {
					enrolledCount: Math.max(0, lesson.enrolledCount - 1),
				});
			}
		}

		registration.status = "cancelled";
	}

	private generateId(): string {
		return `registration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}
}
