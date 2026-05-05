import { consumeCredit, issueCredit } from "./credit.js";
import { LessonDB, ParticipantDB, RegistrationDB } from "./database.js";
import type { EmailServiceInterface } from "./email-factory.js";
import type { Participant } from "./participant.js";
import { isAfterMidnightCutoff } from "./registration-rules.js";
import { type Registration, toDateString } from "./types.js";

export class RegistrationManagerDB {
	constructor(private emailService?: EmailServiceInterface) {}

	async registerParticipant(
		lessonId: string,
		participant: Participant,
	): Promise<Registration> {
		// Save participant first (only if doesn't exist)
		const existingParticipant = await ParticipantDB.getById(participant.id);
		if (!existingParticipant) {
			await ParticipantDB.insert(participant);
		}

		// Get lesson
		const lesson = (await LessonDB.getById(lessonId)) as
			| Record<string, unknown>
			| undefined;
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
		await RegistrationDB.insert(registration);

		// Update lesson enrolled count if confirmed
		if (!isFull) {
			await LessonDB.update(lessonId, {
				enrolledCount: enrolledCount + 1,
			});
		}

		// Send emails asynchronously (don't block registration)
		if (this.emailService) {
			const updatedLesson = (await LessonDB.getById(lessonId)) as
				| Record<string, unknown>
				| undefined;
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

	async bulkRegisterParticipants(
		lessonId: string,
		participants: Participant[],
	): Promise<Registration[]> {
		const registrations: Registration[] = [];
		for (const participant of participants) {
			registrations.push(await this.registerParticipant(lessonId, participant));
		}
		return registrations;
	}

	async getRegistrationsForLesson(lessonId: string): Promise<Registration[]> {
		return (await RegistrationDB.getByLessonId(
			lessonId,
		)) as unknown as Registration[];
	}

	async cancelRegistration(registrationId: string): Promise<void> {
		const registration = (await RegistrationDB.getById(registrationId)) as
			| Record<string, unknown>
			| undefined;
		if (!registration) {
			throw new Error(`Registration ${registrationId} not found`);
		}

		const status = registration.status as string;
		if (status === "confirmed") {
			const regLessonId = registration.lessonId as string;
			const lesson = (await LessonDB.getById(regLessonId)) as
				| Record<string, unknown>
				| undefined;
			if (lesson) {
				const enrolledCount = lesson.enrolledCount as number;
				await LessonDB.update(regLessonId, {
					enrolledCount: Math.max(0, enrolledCount - 1),
				});
			}
		}

		await RegistrationDB.update(registrationId, { status: "cancelled" });
	}

	async registerForSubstitution(
		lessonId: string,
		participant: Participant,
		missedLessonId: string,
	): Promise<Registration> {
		// Save participant first
		await ParticipantDB.insert(participant);

		// Get lesson
		const lesson = (await LessonDB.getById(lessonId)) as
			| Record<string, unknown>
			| undefined;
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
		await RegistrationDB.insert(registration);

		// Update lesson enrolled count if confirmed
		if (!isFull) {
			await LessonDB.update(lessonId, {
				enrolledCount: enrolledCount + 1,
			});
		}

		return registration;
	}

	async getAvailableSubstitutionLessons(
		ageGroup: string,
	): Promise<Array<Record<string, unknown>>> {
		const allLessons = (await LessonDB.getAll()) as Array<
			Record<string, unknown>
		>;
		return allLessons.filter(
			(lesson) =>
				lesson.ageGroup === ageGroup &&
				(lesson.enrolledCount as number) < (lesson.capacity as number),
		);
	}

	async bulkAssignGroupToLessons(config: {
		participantIds: string[];
		lessonIds: string[];
	}): Promise<{
		totalRegistrations: number;
		successful: number;
		skipped: number;
		waitlisted: number;
		errors: Array<{ participantId: string; lessonId: string; error: string }>;
	}> {
		const result = {
			totalRegistrations:
				config.participantIds.length * config.lessonIds.length,
			successful: 0,
			skipped: 0,
			waitlisted: 0,
			errors: [] as Array<{
				participantId: string;
				lessonId: string;
				error: string;
			}>,
		};

		for (const participantId of config.participantIds) {
			// Get participant
			const participant = (await ParticipantDB.getById(participantId)) as
				| Record<string, unknown>
				| undefined;
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
					const existingReg = await RegistrationDB.getByParticipantAndLesson(
						participantId,
						lessonId,
					);

					if (existingReg) {
						result.skipped++;
						continue;
					}

					// Get lesson to check capacity
					const lesson = (await LessonDB.getById(lessonId)) as
						| Record<string, unknown>
						| undefined;
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

					await RegistrationDB.insert(registration);

					// Update lesson enrolled count if confirmed
					if (!isFull) {
						await LessonDB.update(lessonId, {
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

	async participantCancelRegistration(
		registrationId: string,
		participantId: string,
	): Promise<{ success: boolean; message?: string; error?: string }> {
		// Get registration
		const registration = (await RegistrationDB.getById(registrationId)) as
			| Record<string, unknown>
			| undefined;

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

		// Enforce midnight cutoff
		const lesson = (await LessonDB.getById(registration.lessonId as string)) as
			| Record<string, unknown>
			| undefined;
		if (lesson && isAfterMidnightCutoff(lesson.date as string)) {
			return {
				success: false,
				error: "Cannot cancel after midnight before the lesson",
			};
		}

		// Cancel the registration
		await this.cancelRegistration(registrationId);

		// Issue substitution credit
		if (lesson?.courseId) {
			await issueCredit(
				participantId,
				registrationId,
				lesson.courseId as string,
			);
		}

		return { success: true, message: "Registration successfully cancelled" };
	}

	async participantSelfRegister(
		lessonId: string,
		participantId: string,
	): Promise<{
		success: boolean;
		registration?: Registration;
		error?: string;
	}> {
		// Get participant
		const participant = (await ParticipantDB.getById(participantId)) as
			| Record<string, unknown>
			| undefined;
		if (!participant) {
			return { success: false, error: "Participant not found" };
		}

		// Get lesson
		const lesson = (await LessonDB.getById(lessonId)) as
			| Record<string, unknown>
			| undefined;
		if (!lesson) {
			return { success: false, error: "Lesson not found" };
		}

		// Enforce midnight cutoff
		if (isAfterMidnightCutoff(lesson.date as string)) {
			return {
				success: false,
				error: "Cannot register after midnight before the lesson",
			};
		}

		// Check age group match
		if (lesson.ageGroup !== participant.ageGroup) {
			return {
				success: false,
				error: `This lesson is for age group ${lesson.ageGroup}, but you are in ${participant.ageGroup}`,
			};
		}

		// Check if already registered
		const existingReg = await RegistrationDB.getByParticipantAndLesson(
			participantId,
			lessonId,
		);
		if (existingReg) {
			return {
				success: false,
				error: "You are already registered for this lesson",
			};
		}

		// Determine if this is a substitution (lesson's course ≠ participant's own courses)
		const lessonCourseId = lesson.courseId as string | null;
		let isSubstitution = false;
		if (lessonCourseId) {
			const participantCourses =
				await ParticipantDB.getCoursesForParticipant(participantId);
			const ownCourseIds = new Set(
				participantCourses.map((c) => c.id as string),
			);
			isSubstitution = !ownCourseIds.has(lessonCourseId);
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
			const registration = await this.registerParticipant(
				lessonId,
				participantObj,
			);

			// Consume credit for substitution registrations
			if (isSubstitution) {
				const consumed = await consumeCredit(participantId, registration.id);
				if (!consumed) {
					// Roll back the registration
					await this.cancelRegistration(registration.id);
					return {
						success: false,
						error: "No active substitution credit available",
						noCredit: true,
					} as { success: false; error: string; noCredit: boolean };
				}
			}

			return { success: true, registration };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Registration failed",
			};
		}
	}

	async participantTransferLesson(
		currentRegistrationId: string,
		newLessonId: string,
		participantId: string,
	): Promise<{
		success: boolean;
		newRegistration?: Registration;
		error?: string;
	}> {
		// Get current registration
		const currentReg = (await RegistrationDB.getById(currentRegistrationId)) as
			| Record<string, unknown>
			| undefined;

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
		const participant = (await ParticipantDB.getById(participantId)) as
			| Record<string, unknown>
			| undefined;
		if (!participant) {
			return { success: false, error: "Participant not found" };
		}

		// Get new lesson
		const newLesson = (await LessonDB.getById(newLessonId)) as
			| Record<string, unknown>
			| undefined;
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
		const existingReg = await RegistrationDB.getByParticipantAndLesson(
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
			await this.cancelRegistration(currentRegistrationId);

			// Register to new lesson
			const participantObj = {
				id: participantId,
				name: participant.name as string,
				email: participant.email as string,
				phone: participant.phone as string,
				ageGroup: participant.ageGroup as string,
			};

			const newRegistration = await this.registerParticipant(
				newLessonId,
				participantObj,
			);

			return { success: true, newRegistration };
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Transfer failed",
			};
		}
	}

	async getAvailableLessonsForParticipant(participantId: string): Promise<
		Array<{
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
		}>
	> {
		// Get participant
		const participant = (await ParticipantDB.getById(participantId)) as
			| Record<string, unknown>
			| undefined;
		if (!participant) {
			return [];
		}

		// Get today's date for filtering future lessons
		const today = toDateString(new Date());

		// Get all lessons for participant's age group
		const allLessons = (await LessonDB.getAll()) as Array<
			Record<string, unknown>
		>;
		const matchingLessons = allLessons.filter(
			(lesson) =>
				lesson.ageGroup === participant.ageGroup &&
				(lesson.enrolledCount as number) < (lesson.capacity as number) &&
				(lesson.date as string) >= today, // Only future lessons
		);

		// Get participant's existing registrations
		const participantRegs = (await RegistrationDB.getByParticipantId(
			participantId,
		)) as Array<Record<string, unknown>>;
		const registeredLessonIds = participantRegs.map(
			(r) => r.lessonId as string,
		);

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
				availableSpots:
					(lesson.capacity as number) - (lesson.enrolledCount as number),
			}));

		return availableLessons;
	}

	// Admin Override Methods
	async adminRegisterParticipant(
		lessonId: string,
		participantId: string,
		options?: { forceCapacity?: boolean },
	): Promise<{
		success: boolean;
		registration?: Registration;
		error?: string;
		adminOverride?: { reason: string };
	}> {
		// Get participant
		const participant = (await ParticipantDB.getById(participantId)) as
			| Record<string, unknown>
			| undefined;
		if (!participant) {
			return { success: false, error: "Participant not found" };
		}

		// Get lesson
		const lesson = (await LessonDB.getById(lessonId)) as
			| Record<string, unknown>
			| undefined;
		if (!lesson) {
			return { success: false, error: "Lesson not found" };
		}

		// Check if already registered
		const existingReg = await RegistrationDB.getByParticipantAndLesson(
			participantId,
			lessonId,
		);
		if (existingReg) {
			return {
				success: false,
				error: "Participant is already registered for this lesson",
			};
		}

		// Track override reasons
		let overrideReason = "";

		// Check age group mismatch (don't block, just note)
		if (lesson.ageGroup !== participant.ageGroup) {
			overrideReason = `Age group override: participant is ${participant.ageGroup}, lesson is for ${lesson.ageGroup}`;
		}

		// Check capacity
		const enrolledCount = lesson.enrolledCount as number;
		const capacity = lesson.capacity as number;
		const isFull = enrolledCount >= capacity;

		let status: "confirmed" | "waitlist" | "cancelled" = "confirmed";

		// Admin can force capacity, otherwise respect capacity limits
		if (isFull && !options?.forceCapacity) {
			status = "waitlist";
		} else if (isFull && options?.forceCapacity) {
			// Force capacity override
			if (overrideReason) {
				overrideReason +=
					"; Capacity override: lesson is full but admin forced registration";
			} else {
				overrideReason =
					"Capacity override: lesson is full but admin forced registration";
			}
		}

		// Create registration
		const registration: Registration = {
			id: this.generateId(),
			lessonId,
			participantId,
			registeredAt: new Date(),
			status,
		};

		try {
			await RegistrationDB.insert(registration);

			// Update lesson enrolled count if confirmed
			if (status === "confirmed") {
				await LessonDB.update(lessonId, {
					enrolledCount: enrolledCount + 1,
				});
			}

			const result: {
				success: boolean;
				registration: Registration;
				adminOverride?: { reason: string };
			} = {
				success: true,
				registration,
			};

			if (overrideReason) {
				result.adminOverride = { reason: overrideReason };
			}

			return result;
		} catch (error) {
			return {
				success: false,
				error: error instanceof Error ? error.message : "Registration failed",
			};
		}
	}

	async adminCancelRegistration(
		registrationId: string,
	): Promise<{ success: boolean; message?: string; error?: string }> {
		// Get registration
		const registration = (await RegistrationDB.getById(registrationId)) as
			| Record<string, unknown>
			| undefined;

		if (!registration) {
			return { success: false, error: "Registration not found" };
		}

		// Admin can cancel any registration without checks
		await this.cancelRegistration(registrationId);

		return {
			success: true,
			message: "Registration successfully cancelled by admin",
		};
	}

	async adminBulkRegisterParticipant(
		participantId: string,
		lessonIds: string[],
	): Promise<{
		success: boolean;
		registrations: Registration[];
		successful: number;
		failed: number;
		errors: Array<{ lessonId: string; error: string }>;
	}> {
		const result = {
			success: true,
			registrations: [] as Registration[],
			successful: 0,
			failed: 0,
			errors: [] as Array<{ lessonId: string; error: string }>,
		};

		for (const lessonId of lessonIds) {
			const regResult = await this.adminRegisterParticipant(
				lessonId,
				participantId,
			);

			if (regResult.success && regResult.registration) {
				result.registrations.push(regResult.registration);
				result.successful++;
			} else {
				result.failed++;
				result.errors.push({
					lessonId,
					error: regResult.error || "Unknown error",
				});
			}
		}

		if (result.failed > 0 && result.successful === 0) {
			result.success = false;
		}

		return result;
	}

	/**
	 * Idempotent. Ensures every participant linked to courseId is registered
	 * on every future lesson of that course. Skips past lessons and existing
	 * registrations. Overflow → waitlist.
	 */
	async syncGroupEnrollments(
		courseId: string,
	): Promise<{ enrolled: number; skipped: number }> {
		const today = new Date().toISOString().slice(0, 10);
		const [members, lessons] = await Promise.all([
			ParticipantDB.getByCourse(courseId),
			LessonDB.getByCourse(courseId),
		]);

		const futureLesson = lessons.filter((l) => (l.date as string) >= today);

		let enrolled = 0;
		let skipped = 0;

		for (const member of members) {
			const participantId = member.id as string;
			const participant = {
				id: participantId,
				name: member.name as string,
				email: member.email as string,
				phone: (member.phone as string) ?? "",
				ageGroup: member.ageGroup as string,
			};

			for (const lesson of futureLesson) {
				const lessonId = lesson.id as string;
				const existing = await RegistrationDB.getByParticipantAndLesson(
					participantId,
					lessonId,
				);
				if (existing) {
					skipped++;
					continue;
				}
				await this.registerParticipant(lessonId, participant);
				enrolled++;
			}
		}

		return { enrolled, skipped };
	}

	async cancelFutureRegistrationsInCourse(
		participantId: string,
		courseId: string,
	): Promise<void> {
		const today = new Date().toISOString().slice(0, 10);
		const regs = (await RegistrationDB.getByParticipantId(
			participantId,
		)) as Array<Record<string, unknown>>;
		for (const reg of regs) {
			if (reg.status === "cancelled") continue;
			const lesson = (await LessonDB.getById(reg.lessonId as string)) as
				| Record<string, unknown>
				| undefined;
			if (!lesson) continue;
			if (lesson.courseId !== courseId) continue;
			if ((lesson.date as string) < today) continue;
			await this.cancelRegistration(reg.id as string);
		}
	}

	async registerFirstNFutureLessons(
		courseId: string,
		participantId: string,
		n: number,
	): Promise<{ enrolled: number }> {
		const today = new Date().toISOString().slice(0, 10);
		const participant = (await ParticipantDB.getById(participantId)) as
			| Record<string, unknown>
			| undefined;
		if (!participant) return { enrolled: 0 };

		const lessons = await LessonDB.getByCourse(courseId);
		const futureLessons = (lessons as Array<Record<string, unknown>>)
			.filter((l) => (l.date as string) >= today)
			.sort((a, b) => ((a.date as string) < (b.date as string) ? -1 : 1))
			.slice(0, n);

		let enrolled = 0;
		for (const lesson of futureLessons) {
			const lessonId = lesson.id as string;
			const existing = await RegistrationDB.getByParticipantAndLesson(
				participantId,
				lessonId,
			);
			if (existing) continue;
			await this.registerParticipant(lessonId, {
				id: participantId,
				name: participant.name as string,
				email: participant.email as string,
				phone: (participant.phone as string) ?? "",
				ageGroup: participant.ageGroup as string,
			});
			enrolled++;
		}
		return { enrolled };
	}

	private generateId(): string {
		return `registration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}
}
