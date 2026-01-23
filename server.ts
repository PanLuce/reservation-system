import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import session from "express-session";
import multer from "multer";
import { AuthService } from "./src/auth.js";
import { LessonCalendarDB } from "./src/calendar-db.js";
import { initializeDatabase, seedSampleData } from "./src/database.js";
import { createEmailService } from "./src/email-factory.js";
import { ExcelParticipantLoader } from "./src/excel-loader.js";
import { createLesson } from "./src/lesson.js";
import { createParticipant } from "./src/participant.js";
import { RegistrationManagerDB } from "./src/registration-db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure data directory exists
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
initializeDatabase();
seedSampleData();

const app = express();
const PORT = 3000;

// Extend session data type
declare module "express-session" {
	interface SessionData {
		userId?: string;
	}
}

// Environment configuration
const isProduction = process.env.NODE_ENV === "production";
const allowedOrigins = process.env.ALLOWED_ORIGINS
	? process.env.ALLOWED_ORIGINS.split(",")
	: ["https://centrumrubacek.cz"];

// Middleware
app.use(
	cors({
		origin: isProduction ? allowedOrigins : true,
		credentials: true,
	}),
);

// Allow iframe embedding
app.use((req, res, next) => {
	// Remove X-Frame-Options to allow iframe embedding
	res.removeHeader("X-Frame-Options");
	next();
});

app.use(express.json());
app.use(
	session({
		secret:
			process.env.SESSION_SECRET ||
			"reservation-system-secret-change-in-production",
		resave: false,
		saveUninitialized: false,
		cookie: {
			secure: isProduction, // HTTPS required in production
			httpOnly: true,
			maxAge: 24 * 60 * 60 * 1000, // 24 hours
			sameSite: isProduction ? "none" : "lax", // 'none' required for cross-site iframe
		},
	}),
);
app.use(express.static("public"));

// File upload setup
const upload = multer({ dest: "uploads/" });

// Initialize email service
const emailService = createEmailService();

// Initialize data stores with database
const calendar = new LessonCalendarDB();
const registrationManager = new RegistrationManagerDB(emailService);
const excelLoader = new ExcelParticipantLoader();
const authService = new AuthService();

// Authentication middleware
function requireAuth(
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) {
	if (!req.session.userId) {
		return res.status(401).json({ error: "Authentication required" });
	}
	next();
}

function requireAdmin(
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) {
	if (!req.session.userId) {
		return res.status(401).json({ error: "Authentication required" });
	}

	const user = authService.verifyToken(req.session.userId);
	if (!user || user.role !== "admin") {
		return res.status(403).json({ error: "Admin access required" });
	}

	next();
}

// API Routes

// Authentication
app.post("/api/auth/login", async (req, res) => {
	const { email, password } = req.body;

	if (!email || !password) {
		return res.status(400).json({ error: "Email and password required" });
	}

	const result = await authService.login(email, password);

	if (!result.success) {
		return res.status(401).json({ error: result.error });
	}

	req.session.userId = result.user.id;
	res.json({ user: result.user });
});

app.post("/api/auth/register", async (req, res) => {
	const { email, password, name, participantId } = req.body;

	if (!email || !password || !name) {
		return res
			.status(400)
			.json({ error: "Email, password, and name required" });
	}

	const result = await authService.register(
		email,
		password,
		name,
		"participant",
		participantId,
	);

	if (!result.success) {
		return res.status(400).json({ error: result.error });
	}

	req.session.userId = result.user.id;
	res.status(201).json({ user: result.user });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
	const user = authService.verifyToken(req.session.userId!);

	if (!user) {
		return res.status(401).json({ error: "Invalid session" });
	}

	res.json({ user });
});

app.post("/api/auth/logout", (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			return res.status(500).json({ error: "Logout failed" });
		}
		res.json({ message: "Logged out successfully" });
	});
});

// API Routes

// Lessons (public read, admin write)
app.get("/api/lessons", (_req, res) => {
	res.json(calendar.getAllLessons());
});

app.get("/api/lessons/:id", (req, res) => {
	const lesson = calendar.getLessonById(req.params.id);
	if (!lesson) {
		return res.status(404).json({ error: "Lesson not found" });
	}
	res.json(lesson);
});

app.post("/api/lessons", requireAdmin, (req, res) => {
	const lessonData = req.body;
	const lesson = createLesson({
		title: lessonData.title,
		date: lessonData.date,
		dayOfWeek: lessonData.dayOfWeek,
		time: lessonData.time,
		location: lessonData.location,
		ageGroup: lessonData.ageGroup,
		capacity: Number(lessonData.capacity),
	});
	calendar.addLesson(lesson);
	res.status(201).json(lesson);
});

app.post("/api/courses/:courseId/bulk-lessons", requireAdmin, (req, res) => {
	const courseId = req.params.courseId;
	if (!courseId) {
		return res.status(400).json({ error: "Course ID is required" });
	}

	const { title, location, time, dayOfWeek, capacity, dates, startDate, weeksCount } = req.body;

	try {
		let lessons;
		if (dates && Array.isArray(dates)) {
			// Create lessons for specific dates
			lessons = calendar.bulkCreateLessons({
				courseId,
				title,
				location,
				time,
				dayOfWeek,
				capacity: Number(capacity),
				dates,
			});
		} else if (startDate && weeksCount) {
			// Create recurring lessons
			lessons = calendar.bulkCreateLessonsRecurring({
				courseId,
				title,
				location,
				time,
				dayOfWeek,
				capacity: Number(capacity),
				startDate,
				weeksCount: Number(weeksCount),
			});
		} else {
			return res.status(400).json({
				error: "Either dates array or (startDate + weeksCount) is required"
			});
		}

		res.status(201).json({
			message: `Created ${lessons.length} lessons`,
			lessons
		});
	} catch (error) {
		res.status(400).json({
			error: error instanceof Error ? error.message : "Failed to create lessons"
		});
	}
});

app.get("/api/courses/:courseId/lessons", (req, res) => {
	const courseId = req.params.courseId;
	if (!courseId) {
		return res.status(400).json({ error: "Course ID is required" });
	}

	const lessons = calendar.getLessonsByCourse(courseId);
	res.json(lessons);
});

app.post("/api/courses/:courseId/bulk-register", requireAdmin, (req, res) => {
	const courseId = req.params.courseId;
	if (!courseId) {
		return res.status(400).json({ error: "Course ID is required" });
	}

	const { participantIds, lessonIds } = req.body;

	if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
		return res.status(400).json({ error: "participantIds array is required" });
	}

	if (!lessonIds || !Array.isArray(lessonIds) || lessonIds.length === 0) {
		return res.status(400).json({ error: "lessonIds array is required" });
	}

	try {
		const result = registrationManager.bulkAssignGroupToLessons({
			participantIds,
			lessonIds,
		});

		res.status(201).json({
			message: `Bulk registration completed`,
			...result,
		});
	} catch (error) {
		res.status(500).json({
			error: error instanceof Error ? error.message : "Failed to process bulk registration",
		});
	}
});

app.get("/api/courses/:courseId/participants", (req, res) => {
	const courseId = req.params.courseId;
	if (!courseId) {
		return res.status(400).json({ error: "Course ID is required" });
	}

	const participants = ParticipantDB.getByCourse(courseId);
	res.json(participants);
});

app.put("/api/lessons/:id", requireAdmin, (req, res) => {
	const lessonId = req.params.id;
	if (!lessonId) {
		return res.status(400).json({ error: "Lesson ID is required" });
	}
	const lesson = calendar.getLessonById(lessonId);
	if (!lesson) {
		return res.status(404).json({ error: "Lesson not found" });
	}
	calendar.updateLesson(lessonId, req.body);
	const updated = calendar.getLessonById(lessonId);
	res.json(updated);
});

app.delete("/api/lessons/:id", requireAdmin, (req, res) => {
	const lessonId = req.params.id;
	if (!lessonId) {
		return res.status(400).json({ error: "Lesson ID is required" });
	}
	const count = calendar.bulkDeleteLessons({ id: lessonId });
	if (count === 0) {
		return res.status(404).json({ error: "Lesson not found" });
	}
	res.json({ message: "Lesson deleted" });
});

// Registrations
app.post("/api/registrations", (req, res) => {
	const { lessonId, participant } = req.body;

	const newParticipant = createParticipant({
		name: participant.name,
		email: participant.email,
		phone: participant.phone,
		ageGroup: participant.ageGroup,
	});

	const registration = registrationManager.registerParticipant(
		lessonId,
		newParticipant,
	);
	res.status(201).json(registration);
});

app.get("/api/registrations/lesson/:lessonId", (req, res) => {
	const registrations = registrationManager.getRegistrationsForLesson(
		req.params.lessonId,
	);
	res.json(registrations);
});

app.get("/api/participants/:participantId/registrations", (req, res) => {
	const participantId = req.params.participantId;
	if (!participantId) {
		return res.status(400).json({ error: "Participant ID is required" });
	}
	const registrations = ParticipantDB.getRegistrationsWithLessonDetails(participantId);
	res.json(registrations);
});

// Substitutions
app.get("/api/substitutions/:ageGroup", (req, res) => {
	const availableLessons = registrationManager.getAvailableSubstitutionLessons(
		req.params.ageGroup,
	);
	res.json(availableLessons);
});

app.post("/api/substitutions", (req, res) => {
	const { lessonId, participant, missedLessonId } = req.body;

	const newParticipant = createParticipant({
		name: participant.name,
		email: participant.email,
		phone: participant.phone,
		ageGroup: participant.ageGroup,
	});

	const registration = registrationManager.registerForSubstitution(
		lessonId,
		newParticipant,
		missedLessonId,
	);
	res.status(201).json(registration);
});

// Excel Import
app.post("/api/excel/import", upload.single("file"), (req, res) => {
	if (!req.file) {
		return res.status(400).json({ error: "No file uploaded" });
	}

	const lessonId = req.body.lessonId;
	if (!lessonId) {
		return res.status(400).json({ error: "Lesson ID required" });
	}

	try {
		const count = excelLoader.bulkLoadAndRegister(
			req.file.path,
			lessonId,
			registrationManager,
		);
		res.json({ message: `Successfully registered ${count} participants` });
	} catch (error) {
		res
			.status(500)
			.json({ error: "Failed to process Excel file", details: String(error) });
	}
});

// Serve frontend
app.get("/", (req, res) => {
	// Check if user is authenticated
	if (!req.session.userId) {
		return res.redirect("/login.html");
	}
	res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/login.html", (req, res) => {
	// Redirect to main page if already logged in
	if (req.session.userId) {
		return res.redirect("/");
	}
	res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Start server
app.listen(PORT, () => {
	console.log(`🚀 Reservation System running at http://localhost:${PORT}`);
	console.log(`📅 Sample lessons loaded`);
	console.log(`\n✨ Open http://localhost:${PORT} in your browser\n`);
});
