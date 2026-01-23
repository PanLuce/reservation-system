import { expect, test } from "@playwright/test";
import type { Lesson } from "../src/lesson.js";
import type { Participant } from "../src/participant.js";
import { EmailService } from "../src/email-service.js";
import type nodemailer from "nodemailer";

// Mock nodemailer transporter
const createMockTransporter = () => {
	const sentEmails: Array<{
		from: string;
		to: string;
		subject: string;
		text: string;
	}> = [];

	return {
		sendMail: async (mailOptions: {
			from: string;
			to: string;
			subject: string;
			text: string;
		}) => {
			sentEmails.push(mailOptions);
			return { messageId: "test-message-id" };
		},
		getSentEmails: () => sentEmails,
		resetSentEmails: () => {
			sentEmails.length = 0;
		},
	};
};

test.describe("Email Service", () => {
	const mockParticipant: Participant = {
		id: "p1",
		name: "Jana Nováková",
		email: "jana@example.cz",
		phone: "+420 777 888 999",
		ageGroup: "3-12 months",
	};

	const mockLesson: Lesson = {
		id: "lesson_1",
		title: "Ranní cvičení",
		dayOfWeek: "Pondělí",
		time: "10:00",
		location: "CVČ Vietnamská",
		ageGroup: "3-12 months",
		capacity: 10,
		enrolledCount: 5,
	};

	test("should send participant confirmation email for confirmed status", async () => {
		// Arrange
		const mockTransporter = createMockTransporter();
		const emailService = new EmailService(
			mockTransporter as unknown as nodemailer.Transporter,
			"admin@centrumrubacek.cz",
			"info@centrumrubacek.cz",
		);

		// Act
		await emailService.sendParticipantConfirmation(
			mockParticipant,
			mockLesson,
			"confirmed",
		);

		// Assert
		const sentEmails = mockTransporter.getSentEmails();
		expect(sentEmails).toHaveLength(1);

		const email = sentEmails[0];
		expect(email.to).toBe("jana@example.cz");
		expect(email.from).toBe("info@centrumrubacek.cz");
		expect(email.subject).toContain("Potvrzení registrace");
		expect(email.subject).toContain("Ranní cvičení");

		// Check Czech content
		expect(email.text).toContain("Dobrý den Jana Nováková");
		expect(email.text).toContain("Vaše registrace na lekci byla úspěšně potvrzena");
		expect(email.text).toContain("Ranní cvičení");
		expect(email.text).toContain("Pondělí");
		expect(email.text).toContain("10:00");
		expect(email.text).toContain("CVČ Vietnamská");
		expect(email.text).toContain("3-12 months");
		expect(email.text).toContain("POTVRZENO");
		expect(email.text).toContain("Centrum Rubáček");
	});

	test("should send participant confirmation email for waitlist status", async () => {
		// Arrange
		const mockTransporter = createMockTransporter();
		const emailService = new EmailService(
			mockTransporter as unknown as nodemailer.Transporter,
			"admin@centrumrubacek.cz",
			"info@centrumrubacek.cz",
		);

		// Act
		await emailService.sendParticipantConfirmation(
			mockParticipant,
			mockLesson,
			"waitlist",
		);

		// Assert
		const sentEmails = mockTransporter.getSentEmails();
		expect(sentEmails).toHaveLength(1);

		const email = sentEmails[0];
		expect(email.to).toBe("jana@example.cz");
		expect(email.subject).toContain("Registrace na čekací listinu");
		expect(email.subject).toContain("Ranní cvičení");

		// Check Czech waitlist content
		expect(email.text).toContain("Dobrý den Jana Nováková");
		expect(email.text).toContain("jste na čekací listině");
		expect(email.text).toContain("ČEKACÍ LISTINA");
		expect(email.text).toContain("Ozveme se vám, jakmile se uvolní místo");
	});

	test("should send admin notification email", async () => {
		// Arrange
		const mockTransporter = createMockTransporter();
		const emailService = new EmailService(
			mockTransporter as unknown as nodemailer.Transporter,
			"admin@centrumrubacek.cz",
			"info@centrumrubacek.cz",
		);

		// Act
		await emailService.sendAdminNotification(
			mockParticipant,
			mockLesson,
			"confirmed",
		);

		// Assert
		const sentEmails = mockTransporter.getSentEmails();
		expect(sentEmails).toHaveLength(1);

		const email = sentEmails[0];
		expect(email.to).toBe("admin@centrumrubacek.cz");
		expect(email.from).toBe("info@centrumrubacek.cz");
		expect(email.subject).toContain("Nová registrace");
		expect(email.subject).toContain("Ranní cvičení");

		// Check admin notification content
		expect(email.text).toContain("Nová registrace:");
		expect(email.text).toContain("Jana Nováková");
		expect(email.text).toContain("jana@example.cz");
		expect(email.text).toContain("+420 777 888 999");
		expect(email.text).toContain("3-12 months");
		expect(email.text).toContain("Ranní cvičení");
		expect(email.text).toContain("Pondělí");
		expect(email.text).toContain("10:00");
		expect(email.text).toContain("CVČ Vietnamská");
		expect(email.text).toContain("5/10");
	});

	test("should handle SMTP errors gracefully without throwing", async () => {
		// Arrange
		const failingTransporter = {
			sendMail: async () => {
				throw new Error("SMTP connection failed");
			},
		};

		const emailService = new EmailService(
			failingTransporter as unknown as nodemailer.Transporter,
			"admin@centrumrubacek.cz",
			"info@centrumrubacek.cz",
		);

		// Act & Assert - should not throw
		await expect(
			emailService.sendParticipantConfirmation(
				mockParticipant,
				mockLesson,
				"confirmed",
			),
		).resolves.toBeUndefined();

		await expect(
			emailService.sendAdminNotification(
				mockParticipant,
				mockLesson,
				"confirmed",
			),
		).resolves.toBeUndefined();
	});

	test("should handle invalid email addresses gracefully", async () => {
		// Arrange
		const mockTransporter = createMockTransporter();
		const emailService = new EmailService(
			mockTransporter as unknown as nodemailer.Transporter,
			"admin@centrumrubacek.cz",
			"info@centrumrubacek.cz",
		);

		const participantWithInvalidEmail: Participant = {
			...mockParticipant,
			email: "invalid-email",
		};

		// Act & Assert - should not throw even with invalid email
		await expect(
			emailService.sendParticipantConfirmation(
				participantWithInvalidEmail,
				mockLesson,
				"confirmed",
			),
		).resolves.toBeUndefined();
	});

	test("should include enrollment count in admin notification", async () => {
		// Arrange
		const mockTransporter = createMockTransporter();
		const emailService = new EmailService(
			mockTransporter as unknown as nodemailer.Transporter,
			"admin@centrumrubacek.cz",
			"info@centrumrubacek.cz",
		);

		const fullLesson: Lesson = {
			...mockLesson,
			enrolledCount: 10,
			capacity: 10,
		};

		// Act
		await emailService.sendAdminNotification(
			mockParticipant,
			fullLesson,
			"waitlist",
		);

		// Assert
		const sentEmails = mockTransporter.getSentEmails();
		const email = sentEmails[0];

		expect(email.text).toContain("10/10");
		expect(email.text).toContain("waitlist");
	});
});
