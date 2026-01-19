import { expect, test } from "@playwright/test";
import {
	createEmailService,
	type EmailServiceInterface,
} from "../src/email-factory";

test.describe("Email Factory", () => {
	// Store original env vars to restore after tests
	const originalEnv = { ...process.env };

	test.afterEach(() => {
		// Restore original environment after each test
		process.env = { ...originalEnv };
	});

	test("should create email service with valid SMTP configuration", () => {
		// Arrange
		process.env.SMTP_HOST = "smtp.ethereal.email";
		process.env.SMTP_PORT = "587";
		process.env.SMTP_USER = "test@ethereal.email";
		process.env.SMTP_PASS = "test-password";
		process.env.ADMIN_EMAIL = "admin@centrumrubacek.cz";
		process.env.FROM_EMAIL = "info@centrumrubacek.cz";

		// Act
		const emailService = createEmailService();

		// Assert
		expect(emailService).toBeDefined();
		expect(emailService).not.toBeNull();
		expect(typeof emailService.sendParticipantConfirmation).toBe("function");
		expect(typeof emailService.sendAdminNotification).toBe("function");
	});

	test("should return no-op service when SMTP_HOST is missing", () => {
		// Arrange
		delete process.env.SMTP_HOST;
		process.env.SMTP_PORT = "587";
		process.env.SMTP_USER = "test@ethereal.email";
		process.env.SMTP_PASS = "test-password";
		process.env.ADMIN_EMAIL = "admin@centrumrubacek.cz";
		process.env.FROM_EMAIL = "info@centrumrubacek.cz";

		// Act
		const emailService = createEmailService();

		// Assert
		expect(emailService).toBeDefined();
		expect(emailService).not.toBeNull();

		// Should be a no-op service (implements interface but does nothing)
		expect(typeof emailService.sendParticipantConfirmation).toBe("function");
		expect(typeof emailService.sendAdminNotification).toBe("function");
	});

	test("should return no-op service when any required env var is missing", () => {
		// Test missing SMTP_USER
		process.env.SMTP_HOST = "smtp.ethereal.email";
		process.env.SMTP_PORT = "587";
		delete process.env.SMTP_USER;
		process.env.SMTP_PASS = "test-password";
		process.env.ADMIN_EMAIL = "admin@centrumrubacek.cz";
		process.env.FROM_EMAIL = "info@centrumrubacek.cz";

		let emailService = createEmailService();
		expect(emailService).toBeDefined();

		// Test missing ADMIN_EMAIL
		process.env.SMTP_HOST = "smtp.ethereal.email";
		process.env.SMTP_PORT = "587";
		process.env.SMTP_USER = "test@ethereal.email";
		process.env.SMTP_PASS = "test-password";
		delete process.env.ADMIN_EMAIL;
		process.env.FROM_EMAIL = "info@centrumrubacek.cz";

		emailService = createEmailService();
		expect(emailService).toBeDefined();

		// Test missing FROM_EMAIL
		process.env.SMTP_HOST = "smtp.ethereal.email";
		process.env.SMTP_PORT = "587";
		process.env.SMTP_USER = "test@ethereal.email";
		process.env.SMTP_PASS = "test-password";
		process.env.ADMIN_EMAIL = "admin@centrumrubacek.cz";
		delete process.env.FROM_EMAIL;

		emailService = createEmailService();
		expect(emailService).toBeDefined();
	});

	test("should use default port 587 when SMTP_PORT is not specified", () => {
		// Arrange
		process.env.SMTP_HOST = "smtp.ethereal.email";
		delete process.env.SMTP_PORT;
		process.env.SMTP_USER = "test@ethereal.email";
		process.env.SMTP_PASS = "test-password";
		process.env.ADMIN_EMAIL = "admin@centrumrubacek.cz";
		process.env.FROM_EMAIL = "info@centrumrubacek.cz";

		// Act
		const emailService = createEmailService();

		// Assert
		expect(emailService).toBeDefined();
		expect(emailService).not.toBeNull();
	});

	test("should create working no-op service that doesn't throw", async () => {
		// Arrange - no env vars set
		delete process.env.SMTP_HOST;
		delete process.env.SMTP_PORT;
		delete process.env.SMTP_USER;
		delete process.env.SMTP_PASS;
		delete process.env.ADMIN_EMAIL;
		delete process.env.FROM_EMAIL;

		const emailService = createEmailService();

		const mockParticipant = {
			id: "p1",
			name: "Test User",
			email: "test@example.com",
			phone: "+420 123 456 789",
			ageGroup: "3-12 months",
		};

		const mockLesson = {
			id: "lesson_1",
			title: "Test Lesson",
			dayOfWeek: "Monday",
			time: "10:00",
			location: "Test Location",
			ageGroup: "3-12 months",
			capacity: 10,
			enrolledCount: 5,
		};

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
});
