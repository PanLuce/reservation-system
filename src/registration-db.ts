import { LessonDB, ParticipantDB, RegistrationDB } from "./database.js";
import type { Participant } from "./participant.js";
import type { Registration } from "./registration.js";

export class RegistrationManagerDB {
	registerParticipant(
		lessonId: string,
		participant: Participant,
	): Registration {
		// Save participant first
		ParticipantDB.insert(participant);

		// Get lesson
		const lesson = LessonDB.getById(lessonId);
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
			status: status as "confirmed" | "waitlist" | "cancelled",
		};

		// Save registration
		RegistrationDB.insert(registration);

		// Update lesson enrolled count if confirmed
		if (!isFull) {
			LessonDB.update(lessonId, {
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
		return RegistrationDB.getByLessonId(lessonId) as Registration[];
	}

	cancelRegistration(registrationId: string): void {
		const registration = RegistrationDB.getById(registrationId);
		if (!registration) {
			throw new Error(`Registration ${registrationId} not found`);
		}

		if (registration.status === "confirmed") {
			const lesson = LessonDB.getById(registration.lessonId);
			if (lesson) {
				LessonDB.update(registration.lessonId, {
					enrolledCount: Math.max(0, lesson.enrolledCount - 1),
				});
			}
		}

		RegistrationDB.update(registrationId, { status: "cancelled" });
	}

	registerForSubstitution(
		lessonId: string,
		participant: Participant,
		missedLessonId: string,
	): Registration {
		// Save participant first
		ParticipantDB.insert(participant);

		// Get lesson
		const lesson = LessonDB.getById(lessonId);
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
			status: status as "confirmed" | "waitlist" | "cancelled",
			missedLessonId,
		};

		// Save registration
		RegistrationDB.insert(registration);

		// Update lesson enrolled count if confirmed
		if (!isFull) {
			LessonDB.update(lessonId, {
				enrolledCount: lesson.enrolledCount + 1,
			});
		}

		return registration;
	}

	getAvailableSubstitutionLessons(ageGroup: string) {
		const allLessons = LessonDB.getAll();
		return allLessons.filter(
			(lesson: Record<string, unknown>) =>
				lesson.ageGroup === ageGroup &&
				(lesson.enrolledCount as number) < (lesson.capacity as number),
		);
	}

	private generateId(): string {
		return `registration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}
}
