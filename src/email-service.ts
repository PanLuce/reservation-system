import type nodemailer from "nodemailer";
import type { Lesson } from "./lesson.js";
import type { Participant } from "./participant.js";

/**
 * Email service for sending reservation confirmation emails
 * Handles both participant confirmations and admin notifications in Czech
 */
export class EmailService {
	constructor(
		private transporter: nodemailer.Transporter,
		private adminEmail: string,
		private fromEmail: string,
	) {}

	/**
	 * Sends confirmation email to participant
	 * Fails gracefully without throwing errors
	 * @param participant - The participant who registered
	 * @param lesson - The lesson they registered for
	 * @param status - Registration status (confirmed or waitlist)
	 */
	async sendParticipantConfirmation(
		participant: Participant,
		lesson: Lesson,
		status: "confirmed" | "waitlist",
	): Promise<void> {
		try {
			const subject =
				status === "confirmed"
					? `Potvrzení registrace - ${lesson.title}`
					: `Registrace na čekací listinu - ${lesson.title}`;

			const text =
				status === "confirmed"
					? this.createConfirmedEmailText(participant, lesson)
					: this.createWaitlistEmailText(participant, lesson);

			await this.transporter.sendMail({
				from: this.fromEmail,
				to: participant.email,
				subject,
				text,
			});
		} catch (error) {
			console.error("Failed to send participant confirmation email:", error);
		}
	}

	/**
	 * Sends notification email to admin about new registration
	 * Fails gracefully without throwing errors
	 * @param participant - The participant who registered
	 * @param lesson - The lesson they registered for
	 * @param status - Registration status (confirmed or waitlist)
	 */
	async sendAdminNotification(
		participant: Participant,
		lesson: Lesson,
		status: "confirmed" | "waitlist",
	): Promise<void> {
		try {
			const subject = `Nová registrace - ${lesson.title}`;
			const text = this.createAdminNotificationText(
				participant,
				lesson,
				status,
			);

			await this.transporter.sendMail({
				from: this.fromEmail,
				to: this.adminEmail,
				subject,
				text,
			});
		} catch (error) {
			console.error("Failed to send admin notification email:", error);
		}
	}

	private createConfirmedEmailText(
		participant: Participant,
		lesson: Lesson,
	): string {
		return `Dobrý den ${participant.name},

Vaše registrace na lekci byla úspěšně potvrzena!

Detaily lekce:
- Název: ${lesson.title}
- Den: ${lesson.dayOfWeek}
- Čas: ${lesson.time}
- Místo: ${lesson.location}
- Věková skupina: ${lesson.ageGroup}

Status: POTVRZENO ✓

Těšíme se na vás!

S pozdravem,
Centrum Rubáček`;
	}

	private createWaitlistEmailText(
		participant: Participant,
		lesson: Lesson,
	): string {
		return `Dobrý den ${participant.name},

Vaše registrace na lekci byla přijata a jste na čekací listině.

Detaily lekce:
- Název: ${lesson.title}
- Den: ${lesson.dayOfWeek}
- Čas: ${lesson.time}
- Místo: ${lesson.location}
- Věková skupina: ${lesson.ageGroup}

Status: ČEKACÍ LISTINA

Ozveme se vám, jakmile se uvolní místo.

S pozdravem,
Centrum Rubáček`;
	}

	private createAdminNotificationText(
		participant: Participant,
		lesson: Lesson,
		status: "confirmed" | "waitlist",
	): string {
		return `Nová registrace:

Účastník:
- Jméno: ${participant.name}
- Email: ${participant.email}
- Telefon: ${participant.phone}
- Věková skupina: ${participant.ageGroup}

Lekce:
- Název: ${lesson.title}
- Den: ${lesson.dayOfWeek}
- Čas: ${lesson.time}
- Místo: ${lesson.location}

Status: ${status}
Obsazenost: ${lesson.enrolledCount}/${lesson.capacity}`;
	}
}
