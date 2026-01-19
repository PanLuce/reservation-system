import nodemailer from "nodemailer";
import { EmailService } from "./email-service.js";
import type { Lesson } from "./lesson.js";
import type { Participant } from "./participant.js";

/**
 * Interface for email service implementations
 * Allows for real and no-op implementations
 */
export interface EmailServiceInterface {
	sendParticipantConfirmation(
		participant: Participant,
		lesson: Lesson,
		status: "confirmed" | "waitlist",
	): Promise<void>;

	sendAdminNotification(
		participant: Participant,
		lesson: Lesson,
		status: "confirmed" | "waitlist",
	): Promise<void>;
}

class NoOpEmailService implements EmailServiceInterface {
	async sendParticipantConfirmation(): Promise<void> {
		// No-op: do nothing
	}

	async sendAdminNotification(): Promise<void> {
		// No-op: do nothing
	}
}

/**
 * Creates email service from environment variables
 * Returns NoOpEmailService if SMTP configuration is incomplete
 * @returns EmailServiceInterface - Real or no-op implementation
 */
export function createEmailService(): EmailServiceInterface {
	const smtpHost = process.env.SMTP_HOST;
	const smtpPort = process.env.SMTP_PORT || "587";
	const smtpUser = process.env.SMTP_USER;
	const smtpPass = process.env.SMTP_PASS;
	const adminEmail = process.env.ADMIN_EMAIL;
	const fromEmail = process.env.FROM_EMAIL;

	// Validate required configuration
	if (!smtpHost || !smtpUser || !smtpPass || !adminEmail || !fromEmail) {
		console.warn(
			"Email service not configured. Missing required environment variables. Email notifications will be disabled.",
		);
		return new NoOpEmailService();
	}

	// Create nodemailer transporter
	const transporter = nodemailer.createTransport({
		host: smtpHost,
		port: Number.parseInt(smtpPort, 10),
		secure: false, // Use STARTTLS
		auth: {
			user: smtpUser,
			pass: smtpPass,
		},
	});

	console.log(`Email service enabled. Admin email: ${adminEmail}`);

	return new EmailService(transporter, adminEmail, fromEmail);
}
