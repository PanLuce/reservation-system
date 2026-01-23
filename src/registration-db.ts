import { LessonDB, ParticipantDB, RegistrationDB } from "./database.js";
import type { EmailServiceInterface } from "./email-factory.js";
import type { Participant } from "./participant.js";
import type { Registration } from "./registration.js";

export class RegistrationManagerDB {
	constructor(private emailService?: EmailServiceInterface) {}

	registerParticipant(
		lessonId: string,
		participant: Participant,
	): Registration {
		// Save participant first (only if doesn't exist)
		const existingParticipant = ParticipantDB.getById(participant.id);
		if (!existingParticipant) {
			ParticipantDB.insert(participant);
		}

		// Get lesson
		const lesson = LessonDB.getById(lessonId) as Record<string, unknown> | undefined;
		if (!lesson) {
			throw new Error(`Lesson ${lessonId} not found`);
		}

		const enrolledCount = lesson.enrolledCount as number;
		const capacity = lesson.capacity as number;
		const isFull = enrolledCount >= capacity;
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
				enrolledCount: enrolledCount + 1,
			});
		}

		// Send emails asynchronously (don't block registration)
		if (this.emailService) {
			const updatedLesson = LessonDB.getById(lessonId) as Record<string, unknown> | undefined;
			if (updatedLesson) {
				this.sendRegistrationEmails(participant, updatedLesson, status).catch(
					(err) => {
						console.error("Email sending failed:", err);
					},
				);
			}
		}

		return registration;
	}

	private async sendRegistrationEmails(
		participant: Participant,
		lesson: Record<string, unknown>,
		status: "confirmed" | "waitlist",
	): Promise<void> {
		if (!this.emailService) return;

		// Convert lesson from DB record to Lesson type
		const lessonData = {
			id: lesson.id as string,
			title: lesson.title as string,
			date: lesson.date as string,
			dayOfWeek: lesson.dayOfWeek as string,
			time: lesson.time as string,
			location: lesson.location as string,
			ageGroup: lesson.ageGroup as string,
			capacity: lesson.capacity as number,
			enrolledCount: lesson.enrolledCount as number,
		};

		await Promise.all([
			this.emailService.sendParticipantConfirmation(
				participant,
				lessonData,
				status,
			),
			this.emailService.sendAdminNotification(participant, lessonData, status),
		]);
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
		const registration = RegistrationDB.getById(registrationId) as Record<string, unknown> | undefined;
		if (!registration) {
			throw new Error(`Registration ${registrationId} not found`);
		}

		const status = registration.status as string;
		if (status === "confirmed") {
			const regLessonId = registration.lessonId as string;
			const lesson = LessonDB.getById(regLessonId) as Record<string, unknown> | undefined;
			if (lesson) {
				const enrolledCount = lesson.enrolledCount as number;
				LessonDB.update(regLessonId, {
					enrolledCount: Math.max(0, enrolledCount - 1),
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
		const lesson = LessonDB.getById(lessonId) as Record<string, unknown> | undefined;
		if (!lesson) {
			throw new Error(`Lesson ${lessonId} not found`);
		}

		const enrolledCount = lesson.enrolledCount as number;
		const capacity = lesson.capacity as number;
		const isFull = enrolledCount >= capacity;
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
				enrolledCount: enrolledCount + 1,
			});
		}

		return registration;
	}

	getAvailableSubstitutionLessons(ageGroup: string): Array<Record<string, unknown>> {
		const allLessons = LessonDB.getAll() as Array<Record<string, unknown>>;
		return allLessons.filter(
			(lesson) =>
				lesson.ageGroup === ageGroup &&
				(lesson.enrolledCount as number) < (lesson.capacity as number),
		);
	}

	bulkAssignGroupToLessons(config: {
		participantIds: string[];
		lessonIds: string[];
	}): {
		totalRegistrations: number;
		successful: number;
		skipped: number;
		waitlisted: number;
		errors: Array<{ participantId: string; lessonId: string; error: string }>;
	} {
		const result = {
			totalRegistrations: config.participantIds.length * config.lessonIds.length,
			successful: 0,
			skipped: 0,
			waitlisted: 0,
			errors: [] as Array<{ participantId: string; lessonId: string; error: string }>,
		};

		for (const participantId of config.participantIds) {
			// Get participant
			const participant = ParticipantDB.getById(participantId) as Record<string, unknown> | undefined;
			if (!participant) {
				for (const lessonId of config.lessonIds) {
					result.errors.push({
						participantId,
						lessonId,
						error: `Participant ${participantId} not found`,
					});
				}
				continue;
			}

			for (const lessonId of config.lessonIds) {
				try {
					// Check if already registered
					const existingReg = RegistrationDB.getByParticipantAndLesson(
						participantId,
						lessonId,
					);

					if (existingReg) {
						result.skipped++;
						continue;
					}

					// Get lesson to check capacity
					const lesson = LessonDB.getById(lessonId) as Record<string, unknown> | undefined;
					if (!lesson) {
						result.errors.push({
							participantId,
							lessonId,
							error: `Lesson ${lessonId} not found`,
						});
						continue;
					}

					const enrolledCount = lesson.enrolledCount as number;
					const capacity = lesson.capacity as number;
					const isFull = enrolledCount >= capacity;
					const status = isFull ? "waitlist" : "confirmed";

					// Create registration
					const registration = {
						id: this.generateId(),
						lessonId,
						participantId,
						status,
					};

					RegistrationDB.insert(registration);

					// Update lesson enrolled count if confirmed
					if (!isFull) {
						LessonDB.update(lessonId, {
							enrolledCount: enrolledCount + 1,
						});
						result.successful++;
					} else {
						result.waitlisted++;
					}
				} catch (error) {
					result.errors.push({
						participantId,
						lessonId,
						error: error instanceof Error ? error.message : "Unknown error",
					});
				}
			}
		}

		return result;
	}

	participantCancelRegistration(
		registrationId: string,
		participantId: string,
	): { success: boolean; message?: string; error?: string } {
		// Get registration
		const registration = RegistrationDB.getById(registrationId) as Record<string, unknown> | undefined;

		if (!registration) {
			return { success: false, error: "Registration not found" };
		}

		// Verify participant owns this registration
		if (registration.participantId !== participantId) {
			return {
				success: false,
				error: "You are not authorized to cancel this registration",
			};
		}

		// Cancel the registration
		this.cancelRegistration(registrationId);

		return { success: true, message: "Registration successfully cancelled" };
	}

	participantSelfRegister(
		lessonId: string,
		participantId: string,
	): {
		success: boolean;
		registration?: Registration;
		error?: string;
	} {
		// Get participant
		const participant = ParticipantDB.getById(participantId) as Record<string, unknown> | undefined;
		if (!participant) {
			return { success: false, error: "Participant not found" };
		}

		// Get lesson
		const lesson = LessonDB.getById(lessonId) as Record<string, unknown> | undefined;
		if (!lesson) {
			return { success: false, error: "Lesson not found" };
		}

		// Check age group match
		if (lesson.ageGroup !== participant.ageGroup) {
			return {
				success: false,
				error: `This lesson is for age group ${lesson.ageGroup}, but you are in ${participant.ageGroup}`,
			};
		}

		// Check if already registered
		const existingReg = RegistrationDB.getByParticipantAndLesson(
			participantId,
			lessonId,
		);
		if (existingReg) {
			return {
				success: false,
				error: "You are already registered for this lesson",
			};
		}

		// Register participant
		const participantObj = {
			id: participantId,
			name: participant.name as string,
			email: participant.email as string,
			phone: participant.phone as string,
			ageGroup: participant.ageGroup as string,
		};

		try {
			const registration = this.registerParticipant(lessonId, participantObj);
			return { success: true, registration };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Registration failed",
			};
		}
	}

	participantTransferLesson(
		currentRegistrationId: string,
		newLessonId: string,
		participantId: string,
	): {
		success: boolean;
		newRegistration?: Registration;
		error?: string;
	} {
		// Get current registration
		const currentReg = RegistrationDB.getById(currentRegistrationId) as Record<string, unknown> | undefined;

		if (!currentReg) {
			return { success: false, error: "Current registration not found" };
		}

		// Verify participant owns this registration
		if (currentReg.participantId !== participantId) {
			return {
				success: false,
				error: "You are not authorized to transfer this registration",
			};
		}

		// Get participant
		const participant = ParticipantDB.getById(participantId) as Record<string, unknown> | undefined;
		if (!participant) {
			return { success: false, error: "Participant not found" };
		}

		// Get new lesson
		const newLesson = LessonDB.getById(newLessonId) as Record<string, unknown> | undefined;
		if (!newLesson) {
			return { success: false, error: "New lesson not found" };
		}

		// Check age group match
		if (newLesson.ageGroup !== participant.ageGroup) {
			return {
				success: false,
				error: "The new lesson is for a different age group",
			};
		}

		// Check if already registered to new lesson
		const existingReg = RegistrationDB.getByParticipantAndLesson(
			participantId,
			newLessonId,
		);
		if (existingReg) {
			return {
				success: false,
				error: "You are already registered for the new lesson",
			};
		}

		try {
			// Cancel current registration
			this.cancelRegistration(currentRegistrationId);

			// Register to new lesson
			const participantObj = {
				id: participantId,
				name: participant.name as string,
				email: participant.email as string,
				phone: participant.phone as string,
				ageGroup: participant.ageGroup as string,
			};

			const newRegistration = this.registerParticipant(newLessonId, participantObj);

			return { success: true, newRegistration };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Transfer failed",
			};
		}
	}

	getAvailableLessonsForParticipant(participantId: string): Array<{
		id: string;
		title: string;
		date: string;
		dayOfWeek: string;
		time: string;
		location: string;
		ageGroup: string;
		capacity: number;
		enrolledCount: number;
		availableSpots: number;
	}> {
		// Get participant
		const participant = ParticipantDB.getById(participantId) as Record<string, unknown> | undefined;
		if (!participant) {
			return [];
		}

		// Get today's date for filtering future lessons
		const today = new Date().toISOString().split('T')[0];

		// Get all lessons for participant's age group
		const allLessons = LessonDB.getAll() as Array<Record<string, unknown>>;
		const matchingLessons = allLessons.filter(
			(lesson) =>
				lesson.ageGroup === participant.ageGroup &&
				(lesson.enrolledCount as number) < (lesson.capacity as number) &&
				(lesson.date as string) >= today, // Only future lessons
		);

		// Get participant's existing registrations
		const participantRegs = RegistrationDB.getByParticipantId(participantId) as Array<Record<string, unknown>>;
		const registeredLessonIds = participantRegs.map((r) => r.lessonId as string);

		// Filter out lessons participant is already registered for
		const availableLessons = matchingLessons
			.filter((lesson) => !registeredLessonIds.includes(lesson.id as string))
			.map((lesson) => ({
				id: lesson.id as string,
				title: lesson.title as string,
				date: lesson.date as string,
				dayOfWeek: lesson.dayOfWeek as string,
				time: lesson.time as string,
				location: lesson.location as string,
				ageGroup: lesson.ageGroup as string,
				capacity: lesson.capacity as number,
				enrolledCount: lesson.enrolledCount as number,
				availableSpots: (lesson.capacity as number) - (lesson.enrolledCount as number),
			}));

		return availableLessons;
	}

	private generateId(): string {
		return `registration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}
}
