import multer from "multer";
import { AuthService } from "./auth.js";
import { LessonCalendarDB } from "./calendar-db.js";
import { createEmailService } from "./email-factory.js";
import { RegistrationManagerDB } from "./registration-db.js";

// Shared singleton instances used across every route module — one calendar,
// one registration manager (wired to the email service), one auth service,
// one multer upload config for the whole app.
export const calendar = new LessonCalendarDB();
export const emailService = createEmailService();
export const registrationManager = new RegistrationManagerDB(emailService);
export const authService = new AuthService();
export const upload = multer({ dest: "uploads/" });
