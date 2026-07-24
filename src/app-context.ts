import { rateLimit } from "express-rate-limit";
import multer from "multer";
import { AuthService } from "./auth.js";
import { LessonCalendarDB } from "./calendar-db.js";
import { createEmailService } from "./email-factory.js";
import { RegistrationManagerDB } from "./registration-db.js";

// Base URL used to build absolute links in emails (e.g. the waitlist decline
// link) — falls back to the first configured CORS origin, then a hardcoded
// production default, since neither is guaranteed to be set in every env.
export function resolvePublicBaseUrl(): string {
	if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
	const allowedOrigins = process.env.ALLOWED_ORIGINS;
	if (allowedOrigins) return allowedOrigins.split(",")[0] as string;
	return "https://centrumrubacek.cz";
}

export const publicBaseUrl = resolvePublicBaseUrl();

// Shared singleton instances used across every route module — one calendar,
// one registration manager (wired to the email service), one auth service,
// one multer upload config for the whole app.
export const calendar = new LessonCalendarDB();
export const emailService = createEmailService();
export const registrationManager = new RegistrationManagerDB(
	emailService,
	publicBaseUrl,
);
export const authService = new AuthService();
export const upload = multer({ dest: "uploads/" });

// Rate limit for the unauthenticated public write endpoints (registrations,
// substitutions) — these are the entry point for spam/malformed-payload abuse.
export const publicWriteRateLimit = rateLimit({
	windowMs: 10 * 60 * 1000,
	limit: 10,
	standardHeaders: true,
	legacyHeaders: false,
});
