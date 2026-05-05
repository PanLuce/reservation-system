import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import multer from "multer";
import {
	AGE_GROUPS,
	ageGroupToColor,
	isValidAgeGroup,
} from "./src/age-groups.js";
import { AuthService } from "./src/auth.js";
import { LessonCalendarDB } from "./src/calendar-db.js";
import { createCourse } from "./src/course.js";
import { issueCredit } from "./src/credit.js";
import {
	CourseDB,
	CreditDB,
	client,
	DEFAULT_ADMIN_EMAIL,
	DEFAULT_ADMIN_PASSWORD,
	DEFAULT_PARTICIPANT_EMAIL,
	DEFAULT_PARTICIPANT_PASSWORD,
	initializeDatabase,
	LessonDB,
	ParticipantDB,
	RegistrationDB,
	seedSampleData,
} from "./src/database.js";
import { createEmailService } from "./src/email-factory.js";
import { createLesson } from "./src/lesson.js";
import { logger } from "./src/logger.js";
import { parseOdsWorkbook } from "./src/ods-loader.js";
import { createParticipant } from "./src/participant.js";
import { RegistrationManagerDB } from "./src/registration-db.js";
import { LibSQLSessionStore } from "./src/session-store.js";

// Extend session data type
declare module "express-session" {
	interface SessionData {
		userId?: string;
	}
}

// Extend Express Request type for correlation ID
declare global {
	namespace Express {
		interface Request {
			correlationId?: string;
		}
	}
}

// Register global error handlers FIRST — before any code that might crash
process.on("uncaughtException", (error: Error) => {
	console.error("FATAL uncaughtException:", error);
	process.exit(1);
});
process.on("unhandledRejection", (reason: unknown) => {
	console.error("FATAL unhandledRejection:", reason);
	process.exit(1);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment configuration
const isProduction = process.env.NODE_ENV === "production";
const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;
const allowedOrigins = process.env.ALLOWED_ORIGINS
	? process.env.ALLOWED_ORIGINS.split(",")
	: ["https://centrumrubacek.cz"];

// Validate required environment variables in production
if (isProduction) {
	if (!process.env.SESSION_SECRET) {
		logger.error(
			"SESSION_SECRET environment variable is required in production",
		);
		process.exit(1);
	}
	if (!process.env.ALLOWED_ORIGINS) {
		logger.warn(
			"ALLOWED_ORIGINS not set, using default: https://centrumrubacek.cz",
		);
	}
}

// Ensure data directory exists
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database (async)
try {
	await initializeDatabase();
	await seedSampleData();
} catch (error) {
	console.error("FATAL: Database initialization failed:", error);
	process.exit(1);
}

const app = express();

// Trust first proxy (Railway reverse proxy) — required for secure cookies behind proxy
app.set("trust proxy", 1);

// Middleware

// Correlation ID middleware - add to every request for tracing
app.use((req, res, next) => {
	req.correlationId = randomUUID();
	res.setHeader("X-Correlation-ID", req.correlationId);
	next();
});

// Request logging middleware
app.use((req, res, next) => {
	const start = Date.now();

	// Log request
	logger.info("Incoming request", {
		correlationId: req.correlationId,
		method: req.method,
		path: req.path,
		ip: req.ip,
	});

	// Log response when finished
	res.on("finish", () => {
		const duration = Date.now() - start;
		const logLevel = res.statusCode >= 400 ? "warn" : "info";

		logger[logLevel]("Request completed", {
			correlationId: req.correlationId,
			method: req.method,
			path: req.path,
			statusCode: res.statusCode,
			duration: `${duration}ms`,
		});
	});

	next();
});

// Security headers middleware (helmet)
app.use(
	helmet({
		// Configure Content Security Policy
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
				scriptSrc: ["'self'", "'unsafe-inline'"],
				scriptSrcAttr: ["'unsafe-inline'"],
				imgSrc: ["'self'", "data:", "https:"],
				connectSrc: ["'self'"],
				fontSrc: ["'self'", "https://fonts.gstatic.com"],
				objectSrc: ["'none'"],
				mediaSrc: ["'self'"],
				frameSrc: ["'none'"],
				upgradeInsecureRequests: isProduction ? [] : null,
			},
		},
		// Allow iframe embedding (use CSP frame-ancestors for cross-origin)
		frameguard: isProduction ? { action: "sameorigin" as const } : false,
		// Other security headers
		hsts: {
			maxAge: 31536000, // 1 year
			includeSubDomains: true,
			preload: true,
		},
		noSniff: true,
		xssFilter: true,
	}),
);

app.use(
	cors({
		origin: isProduction ? allowedOrigins : true,
		credentials: true,
	}),
);

app.use(express.json());
app.use(
	session({
		store: new LibSQLSessionStore(client),
		secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
		resave: false,
		saveUninitialized: false,
		cookie: {
			secure: isProduction,
			httpOnly: true,
			maxAge: 24 * 60 * 60 * 1000, // 24 hours
			sameSite: "lax",
		},
	}),
);
app.use(express.static(path.join(__dirname, "public")));

// File upload setup
const upload = multer({ dest: "uploads/" });

// Initialize email service
const emailService = createEmailService();

// Initialize data stores with database
const calendar = new LessonCalendarDB();
const registrationManager = new RegistrationManagerDB(emailService);
const authService = new AuthService();

// Track server start time for uptime
const serverStartTime = Date.now();

// Health Check Endpoints

// Basic health check - just confirms server is running
app.get("/health", (_req, res) => {
	res.json({
		status: "ok",
		timestamp: new Date().toISOString(),
		uptime: Math.floor((Date.now() - serverStartTime) / 1000), // in seconds
	});
});

// Readiness check - verifies dependencies (database) are available
app.get("/ready", async (_req, res) => {
	try {
		// Test database connectivity with a simple query
		await client.execute("SELECT 1");

		res.json({
			status: "ready",
			database: "connected",
			timestamp: new Date().toISOString(),
		});
	} catch (error) {
		logger.error("Readiness check failed", {
			error: error instanceof Error ? error.message : String(error),
		});

		res.status(503).json({
			status: "not_ready",
			database: "disconnected",
			error: error instanceof Error ? error.message : "Unknown error",
			timestamp: new Date().toISOString(),
		});
	}
});

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

async function requireAdmin(
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) {
	if (!req.session.userId) {
		return res.status(401).json({ error: "Authentication required" });
	}

	const user = await authService.verifyToken(req.session.userId);
	if (!user || user.role !== "admin") {
		return res.status(403).json({ error: "Admin access required" });
	}

	next();
}

// Middleware: allows access only if user is admin OR their participantId matches the :participantId param
async function requireParticipantScope(
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) {
	if (!req.session.userId) {
		return res.status(401).json({ error: "Authentication required" });
	}
	const user = await authService.verifyToken(req.session.userId);
	if (!user) {
		return res.status(401).json({ error: "Authentication required" });
	}
	if (user.role === "admin") {
		return next();
	}
	if (user.participantId === req.params.participantId) {
		return next();
	}
	return res.status(403).json({ error: "Access denied" });
}

// API Routes

// Test accounts — always enabled until we go live (gate with ENABLE_QUICK_LOGIN=false to hide)
app.get("/api/test-accounts", (_req, res) => {
	if (process.env.ENABLE_QUICK_LOGIN === "false") {
		return res.status(404).json({ error: "Not available" });
	}
	const accounts: {
		label: string;
		email: string;
		password: string;
		role: string;
	}[] = [
		{
			label: "Přihlásit jako admin",
			email: process.env.ADMIN_EMAIL_SEED ?? DEFAULT_ADMIN_EMAIL,
			password: process.env.ADMIN_PASSWORD_SEED ?? DEFAULT_ADMIN_PASSWORD,
			role: "admin",
		},
		{
			label: "Přihlásit jako maminka",
			email: process.env.PARTICIPANT_EMAIL_SEED ?? DEFAULT_PARTICIPANT_EMAIL,
			password:
				process.env.PARTICIPANT_PASSWORD_SEED ?? DEFAULT_PARTICIPANT_PASSWORD,
			role: "participant",
		},
	];
	return res.json({ accounts });
});

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

app.get("/api/auth/me", requireAuth, async (req, res) => {
	const userId = req.session.userId;
	if (!userId) {
		return res.status(401).json({ error: "Authentication required" });
	}
	const user = await authService.verifyToken(userId);

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
app.get("/api/lessons", async (_req, res) => {
	const lessons = await calendar.getAllLessons();
	const courses = await CourseDB.getAll();
	const courseMap = new Map(courses.map((c) => [c.id as string, c]));
	const enriched = lessons.map((l) => {
		const course = l.courseId ? courseMap.get(l.courseId as string) : undefined;
		return {
			...l,
			courseColor: course?.color ?? null,
			courseName: course?.name ?? null,
		};
	});
	res.json(enriched);
});

app.get("/api/lessons/:id", async (req, res) => {
	const lesson = await calendar.getLessonById(req.params.id as string);
	if (!lesson) {
		return res.status(404).json({ error: "Lesson not found" });
	}
	res.json(lesson);
});

app.post("/api/lessons", requireAdmin, async (req, res) => {
	const lessonData = req.body;
	const requiredFields = [
		"title",
		"date",
		"dayOfWeek",
		"time",
		"ageGroup",
		"capacity",
		"courseId",
	] as const;
	for (const field of requiredFields) {
		if (!lessonData[field] && lessonData[field] !== 0) {
			return res.status(400).json({ error: `${field} is required` });
		}
	}
	const courseExists = await CourseDB.getById(lessonData.courseId as string);
	if (!courseExists) {
		return res.status(400).json({ error: "Course not found" });
	}
	try {
		const lesson = createLesson({
			title: lessonData.title,
			date: lessonData.date,
			dayOfWeek: lessonData.dayOfWeek,
			time: lessonData.time,
			ageGroup: lessonData.ageGroup,
			capacity: Number(lessonData.capacity),
			courseId: lessonData.courseId as string,
		});
		await calendar.addLesson(lesson);
		await registrationManager.syncGroupEnrollments(
			lessonData.courseId as string,
		);
		res.status(201).json(lesson);
	} catch (error) {
		res.status(500).json({
			error: error instanceof Error ? error.message : "Failed to create lesson",
		});
	}
});

// Age groups list (for populating dropdowns)
app.get("/api/age-groups", requireAuth, (_req, res) => {
	res.json(AGE_GROUPS);
});

// Courses (skupinky) — CRUD
app.get("/api/courses", requireAuth, async (_req, res) => {
	res.json(await CourseDB.getAll());
});

app.get("/api/courses/age-group/:ageGroup", requireAuth, async (req, res) => {
	const courses = await CourseDB.getByAgeGroup(
		decodeURIComponent(req.params.ageGroup as string),
	);
	res.json(courses);
});

app.get("/api/courses/:id", requireAuth, async (req, res) => {
	const course = await CourseDB.getById(req.params.id as string);
	if (!course) {
		return res.status(404).json({ error: "Course not found" });
	}
	res.json(course);
});

app.post("/api/courses", requireAdmin, async (req, res) => {
	try {
		const course = createCourse({
			name: req.body.name,
			ageGroup: req.body.ageGroup,
			location: req.body.location,
			color: req.body.color, // optional — derived from ageGroup if absent
			description: req.body.description,
		});
		await CourseDB.insert(course);
		res.status(201).json(course);
	} catch (error) {
		res
			.status(400)
			.json({ error: error instanceof Error ? error.message : "Invalid data" });
	}
});

app.put("/api/courses/:id", requireAdmin, async (req, res) => {
	const id = req.params.id as string;
	const existing = await CourseDB.getById(id);
	if (!existing) {
		return res.status(404).json({ error: "Course not found" });
	}
	try {
		const { name, ageGroup, location, description } = req.body;
		// Always derive color when ageGroup is valid; otherwise keep color from body (manual override)
		const color =
			ageGroup && isValidAgeGroup(ageGroup)
				? ageGroupToColor(ageGroup)
				: (req.body.color as string | undefined);
		const updatePayload =
			color !== undefined
				? { name, ageGroup, location, color, description }
				: { name, ageGroup, location, description };
		await CourseDB.update(id, updatePayload);
		res.json(await CourseDB.getById(id));
	} catch (error) {
		res
			.status(400)
			.json({ error: error instanceof Error ? error.message : "Invalid data" });
	}
});

app.delete("/api/courses/:id", requireAdmin, async (req, res) => {
	const id = req.params.id as string;
	const existing = await CourseDB.getById(id);
	if (!existing) {
		return res.status(404).json({ error: "Course not found" });
	}
	await CourseDB.delete(id);
	res.json({ message: "Course deleted" });
});

app.post("/api/courses/:id/participants", requireAdmin, async (req, res) => {
	const courseId = req.params.id as string;
	const { name, email, phone } = req.body as {
		name?: string;
		email?: string;
		phone?: string;
	};

	if (!email || !name) {
		return res.status(400).json({ error: "name and email are required" });
	}

	const course = await CourseDB.getById(courseId);
	if (!course) {
		return res.status(404).json({ error: "Course not found" });
	}

	// Upsert participant by email
	let existingParticipant = (await ParticipantDB.getByEmail(email)) as
		| Record<string, unknown>
		| undefined;
	let created = false;

	if (!existingParticipant) {
		const newParticipant = createParticipant({
			name,
			email,
			phone: phone ?? "",
			ageGroup: course.ageGroup as string,
		});
		await ParticipantDB.insert(newParticipant);
		existingParticipant = newParticipant as unknown as Record<string, unknown>;
		created = true;
	}

	const participantId = existingParticipant.id as string;

	// Idempotent link
	await ParticipantDB.linkToCourse(participantId, courseId);

	// Auto-enroll in all future lessons
	await registrationManager.syncGroupEnrollments(courseId);

	res.status(created ? 201 : 200).json({
		participant: existingParticipant,
		created,
	});
});

app.post(
	"/api/courses/:id/sync-enrollments",
	requireAdmin,
	async (req, res) => {
		const id = req.params.id as string;
		const existing = await CourseDB.getById(id);
		if (!existing) {
			return res.status(404).json({ error: "Course not found" });
		}
		const result = await registrationManager.syncGroupEnrollments(id);
		res.json(result);
	},
);

app.post(
	"/api/courses/:courseId/bulk-lessons",
	requireAdmin,
	async (req, res) => {
		const courseId = req.params.courseId as string;
		if (!courseId) {
			return res.status(400).json({ error: "Course ID is required" });
		}

		const {
			title,
			time,
			dayOfWeek,
			capacity,
			dates,
			startDate,
			endDate,
			weeksCount,
		} = req.body;

		try {
			let lessons: Awaited<ReturnType<typeof calendar.bulkCreateLessons>>;
			if (dates && Array.isArray(dates)) {
				lessons = await calendar.bulkCreateLessons({
					courseId,
					title,
					time,
					dayOfWeek,
					capacity: Number(capacity),
					dates,
				});
			} else if (startDate && endDate) {
				lessons = await calendar.bulkCreateLessonsRange({
					courseId,
					title,
					time,
					dayOfWeek,
					capacity: Number(capacity),
					startDate,
					endDate,
				});
			} else if (startDate && weeksCount) {
				lessons = await calendar.bulkCreateLessonsRecurring({
					courseId,
					title,
					time,
					dayOfWeek,
					capacity: Number(capacity),
					startDate,
					weeksCount: Number(weeksCount),
				});
			} else {
				return res.status(400).json({
					error:
						"Either dates array, (startDate + endDate), or (startDate + weeksCount) is required",
				});
			}

			res.status(201).json({
				message: `Created ${lessons.length} lessons`,
				lessons,
			});
		} catch (error) {
			res.status(400).json({
				error:
					error instanceof Error ? error.message : "Failed to create lessons",
			});
		}
	},
);

app.get("/api/courses/:courseId/lessons", async (req, res) => {
	const courseId = req.params.courseId as string;
	if (!courseId) {
		return res.status(400).json({ error: "Course ID is required" });
	}

	const lessons = await calendar.getLessonsByCourse(courseId);
	res.json(lessons);
});

app.post(
	"/api/courses/:courseId/bulk-register",
	requireAdmin,
	async (req, res) => {
		const courseId = req.params.courseId as string;
		if (!courseId) {
			return res.status(400).json({ error: "Course ID is required" });
		}

		const { participantIds, lessonIds } = req.body;

		if (
			!participantIds ||
			!Array.isArray(participantIds) ||
			participantIds.length === 0
		) {
			return res
				.status(400)
				.json({ error: "participantIds array is required" });
		}

		if (!lessonIds || !Array.isArray(lessonIds) || lessonIds.length === 0) {
			return res.status(400).json({ error: "lessonIds array is required" });
		}

		try {
			const result = await registrationManager.bulkAssignGroupToLessons({
				participantIds,
				lessonIds,
			});

			res.status(201).json({
				message: `Bulk registration completed`,
				...result,
			});
		} catch (error) {
			res.status(500).json({
				error:
					error instanceof Error
						? error.message
						: "Failed to process bulk registration",
			});
		}
	},
);

app.get(
	"/api/courses/:courseId/participants",
	requireAdmin,
	async (req, res) => {
		const courseId = req.params.courseId as string;
		if (!courseId) {
			return res.status(400).json({ error: "Course ID is required" });
		}

		const participants = await ParticipantDB.getByCourse(courseId);
		const withCounts = await Promise.all(
			participants.map(async (p) => ({
				...p,
				remainingLessons: await ParticipantDB.countRemainingLessonsInCourse(
					p.id as string,
					courseId,
				),
			})),
		);
		res.json(withCounts);
	},
);

app.get(
	"/api/lessons/:lessonId/participants",
	requireAdmin,
	async (req, res) => {
		const lessonId = req.params.lessonId as string;
		if (!lessonId) {
			return res.status(400).json({ error: "Lesson ID is required" });
		}
		const lesson = (await calendar.getLessonById(lessonId)) as
			| Record<string, unknown>
			| undefined;
		if (!lesson) {
			return res.status(404).json({ error: "Lesson not found" });
		}
		const courseId = lesson.courseId as string | undefined;

		const result = await client.execute({
			sql: `SELECT p.id, p.name, p.email, p.phone, p.ageGroup
				FROM participants p
				INNER JOIN registrations r ON p.id = r.participantId
				WHERE r.lessonId = ? AND r.status != 'cancelled'`,
			args: [lessonId],
		});

		const withCounts = await Promise.all(
			result.rows.map(async (p) => ({
				...p,
				remainingLessons: courseId
					? await ParticipantDB.countRemainingLessonsInCourse(
							p.id as string,
							courseId,
						)
					: 0,
			})),
		);
		res.json(withCounts);
	},
);

app.get("/api/admin/participants", requireAdmin, async (_req, res) => {
	const allParticipants = await ParticipantDB.getAll();
	const enriched = await Promise.all(
		allParticipants.map(async (p) => {
			const courses = await ParticipantDB.getCoursesForParticipant(
				p.id as string,
			);
			const coursesWithCounts = await Promise.all(
				courses.map(async (c) => ({
					id: c.id,
					name: c.name,
					ageGroup: c.ageGroup,
					remainingLessons: await ParticipantDB.countRemainingLessonsInCourse(
						p.id as string,
						c.id as string,
					),
				})),
			);
			return {
				id: p.id,
				name: p.name,
				email: p.email,
				phone: p.phone,
				ageGroup: p.ageGroup,
				courses: coursesWithCounts,
			};
		}),
	);
	res.json(enriched);
});

app.post(
	"/api/admin/participants/:participantId/transfer-course",
	requireAdmin,
	async (req, res) => {
		const participantId = req.params.participantId as string;
		const { fromCourseId, toCourseId, registerCount } = req.body as {
			fromCourseId: string;
			toCourseId: string;
			registerCount?: number;
		};

		if (!participantId || !fromCourseId || !toCourseId) {
			return res.status(400).json({
				error: "participantId, fromCourseId and toCourseId are required",
			});
		}

		const today = new Date().toISOString().slice(0, 10);

		const remainingInOld = await ParticipantDB.countRemainingLessonsInCourse(
			participantId,
			fromCourseId,
		);

		const betaLessonsRaw = await LessonDB.getByCourse(toCourseId);
		const futureInNew = (
			betaLessonsRaw as Array<Record<string, unknown>>
		).filter((l) => (l.date as string) >= today).length;

		if (registerCount === undefined) {
			// Phase 1 — report counts only
			const conflict = remainingInOld !== futureInNew;
			return res.json({ remainingInOld, futureInNew, conflict });
		}

		// Phase 2 — perform transfer
		await registrationManager.cancelFutureRegistrationsInCourse(
			participantId,
			fromCourseId,
		);
		await ParticipantDB.unlinkFromCourse(participantId, fromCourseId);
		await ParticipantDB.linkToCourse(participantId, toCourseId);
		const { enrolled } = await registrationManager.registerFirstNFutureLessons(
			toCourseId,
			participantId,
			registerCount,
		);

		res.json({ success: true, enrolled });
	},
);

app.put("/api/lessons/:id", requireAdmin, async (req, res) => {
	const lessonId = req.params.id as string;
	if (!lessonId) {
		return res.status(400).json({ error: "Lesson ID is required" });
	}
	const lesson = await calendar.getLessonById(lessonId);
	if (!lesson) {
		return res.status(404).json({ error: "Lesson not found" });
	}
	await calendar.updateLesson(lessonId, req.body);
	const updated = await calendar.getLessonById(lessonId);
	res.json(updated);
});

app.delete("/api/lessons/:id", requireAdmin, async (req, res) => {
	const lessonId = req.params.id as string;
	if (!lessonId) {
		return res.status(400).json({ error: "Lesson ID is required" });
	}
	const count = await calendar.bulkDeleteLessons({ id: lessonId });
	if (count === 0) {
		return res.status(404).json({ error: "Lesson not found" });
	}
	res.json({ message: "Lesson deleted" });
});

// Registrations
app.post("/api/registrations", async (req, res) => {
	const { lessonId, participant } = req.body;

	const newParticipant = createParticipant({
		name: participant.name,
		email: participant.email,
		phone: participant.phone,
		ageGroup: participant.ageGroup,
	});

	const registration = await registrationManager.registerParticipant(
		lessonId,
		newParticipant,
	);
	res.status(201).json(registration);
});

app.get("/api/registrations/lesson/:lessonId", async (req, res) => {
	const registrations = await registrationManager.getRegistrationsForLesson(
		req.params.lessonId as string,
	);
	res.json(registrations);
});

app.get(
	"/api/participants/:participantId/registrations",
	requireParticipantScope,
	async (req, res) => {
		const participantId = req.params.participantId as string;
		if (!participantId) {
			return res.status(400).json({ error: "Participant ID is required" });
		}
		const registrations =
			await ParticipantDB.getRegistrationsWithLessonDetails(participantId);
		res.json(registrations);
	},
);

// Participant Self-Service
app.post(
	"/api/participants/:participantId/cancel-registration",
	requireParticipantScope,
	async (req, res) => {
		const participantId = req.params.participantId as string;
		const { registrationId } = req.body;

		if (!participantId) {
			return res.status(400).json({ error: "Participant ID is required" });
		}

		if (!registrationId) {
			return res.status(400).json({ error: "Registration ID is required" });
		}

		const result = await registrationManager.participantCancelRegistration(
			registrationId,
			participantId,
		);

		if (result.success) {
			res.json(result);
		} else {
			res.status(403).json(result);
		}
	},
);

app.post(
	"/api/participants/:participantId/register-lesson",
	requireParticipantScope,
	async (req, res) => {
		const participantId = req.params.participantId as string;
		const { lessonId } = req.body;

		if (!participantId) {
			return res.status(400).json({ error: "Participant ID is required" });
		}

		if (!lessonId) {
			return res.status(400).json({ error: "Lesson ID is required" });
		}

		const result = await registrationManager.participantSelfRegister(
			lessonId,
			participantId,
		);

		if (result.success) {
			res.status(201).json(result);
		} else if ("noCredit" in result && result.noCredit) {
			res.status(402).json(result);
		} else {
			res.status(400).json(result);
		}
	},
);

app.post(
	"/api/participants/:participantId/transfer-lesson",
	requireParticipantScope,
	async (req, res) => {
		const participantId = req.params.participantId as string;
		const { currentRegistrationId, newLessonId } = req.body;

		if (!participantId) {
			return res.status(400).json({ error: "Participant ID is required" });
		}

		if (!currentRegistrationId || !newLessonId) {
			return res.status(400).json({
				error: "Both currentRegistrationId and newLessonId are required",
			});
		}

		const result = await registrationManager.participantTransferLesson(
			currentRegistrationId,
			newLessonId,
			participantId,
		);

		if (result.success) {
			res.json(result);
		} else {
			res.status(400).json(result);
		}
	},
);

app.get(
	"/api/participants/:participantId/available-lessons",
	requireParticipantScope,
	async (req, res) => {
		const participantId = req.params.participantId as string;

		if (!participantId) {
			return res.status(400).json({ error: "Participant ID is required" });
		}

		const lessons =
			await registrationManager.getAvailableLessonsForParticipant(
				participantId,
			);

		res.json(lessons);
	},
);

app.get(
	"/api/participants/:participantId/substitution-candidates",
	requireParticipantScope,
	async (req, res) => {
		const participantId = req.params.participantId as string;

		const participantCourses =
			await ParticipantDB.getCoursesForParticipant(participantId);
		const participantAgeGroups = new Set(
			participantCourses.map((c) => c.ageGroup as string),
		);
		const participantCourseIds = new Set(
			participantCourses.map((c) => c.id as string),
		);

		const today = new Date().toISOString().slice(0, 10);

		const existingRegs = await RegistrationDB.getByParticipantId(participantId);
		const registeredLessonIds = new Set(
			existingRegs
				.filter((r) => r.status !== "cancelled")
				.map((r) => r.lessonId as string),
		);

		const allCourses = await CourseDB.getAll();
		const sameAgeGroupCourseIds = allCourses
			.filter(
				(c) =>
					participantAgeGroups.has(c.ageGroup as string) &&
					!participantCourseIds.has(c.id as string),
			)
			.map((c) => c.id as string);

		const candidates: unknown[] = [];
		for (const courseId of sameAgeGroupCourseIds) {
			const lessons = await LessonDB.getByCourse(courseId);
			for (const lesson of lessons) {
				if (
					(lesson.date as string) >= today &&
					!registeredLessonIds.has(lesson.id as string) &&
					(lesson.enrolledCount as number) < (lesson.capacity as number)
				) {
					candidates.push(lesson);
				}
			}
		}

		res.json(candidates);
	},
);

app.get(
	"/api/participants/:participantId/credits",
	requireParticipantScope,
	async (req, res) => {
		const participantId = req.params.participantId as string;
		const credits = await CreditDB.getActiveByParticipant(participantId);
		res.json({ count: credits.length, credits });
	},
);

// Admin Override
app.post("/api/admin/register-participant", requireAdmin, async (req, res) => {
	const { lessonId, participantId, forceCapacity } = req.body;

	if (!lessonId || !participantId) {
		return res.status(400).json({
			error: "Both lessonId and participantId are required",
		});
	}

	const result = await registrationManager.adminRegisterParticipant(
		lessonId,
		participantId,
		{ forceCapacity: forceCapacity || false },
	);

	if (result.success) {
		res.status(201).json(result);
	} else {
		res.status(400).json(result);
	}
});

app.post("/api/admin/cancel-registration", requireAdmin, async (req, res) => {
	const { registrationId, excused } = req.body;

	if (!registrationId) {
		return res.status(400).json({ error: "Registration ID is required" });
	}

	const result =
		await registrationManager.adminCancelRegistration(registrationId);

	if (!result.success) {
		return res.status(404).json(result);
	}

	if (excused) {
		const reg = await RegistrationDB.getById(registrationId);
		if (reg) {
			const lesson = await LessonDB.getById(reg.lessonId as string);
			if (lesson?.courseId) {
				await issueCredit(
					reg.participantId as string,
					registrationId,
					lesson.courseId as string,
				);
			}
		}
	}

	res.json(result);
});

app.post(
	"/api/admin/bulk-register-participant",
	requireAdmin,
	async (req, res) => {
		const { participantId, lessonIds } = req.body;

		if (!participantId || !lessonIds || !Array.isArray(lessonIds)) {
			return res.status(400).json({
				error: "participantId and lessonIds array are required",
			});
		}

		const result = await registrationManager.adminBulkRegisterParticipant(
			participantId,
			lessonIds,
		);

		res.status(result.success ? 201 : 400).json(result);
	},
);

app.post(
	"/api/admin/participants/:participantId/credits/:creditId/extend",
	requireAdmin,
	async (req, res) => {
		const creditId = req.params.creditId as string;
		const { newExpiresAt } = req.body;
		if (!newExpiresAt) {
			return res.status(400).json({ error: "newExpiresAt is required" });
		}
		const result = await CreditDB.updateExpiry(creditId, newExpiresAt);
		if (result.changes === 0) {
			return res.status(404).json({ error: "Credit not found" });
		}
		const updated = await CreditDB.getById(creditId);
		res.json(updated);
	},
);

app.post(
	"/api/admin/participants/:participantId/credits/:creditId/shorten",
	requireAdmin,
	async (req, res) => {
		const creditId = req.params.creditId as string;
		const { newExpiresAt } = req.body;
		if (!newExpiresAt) {
			return res.status(400).json({ error: "newExpiresAt is required" });
		}
		const result = await CreditDB.updateExpiry(creditId, newExpiresAt);
		if (result.changes === 0) {
			return res.status(404).json({ error: "Credit not found" });
		}
		const updated = await CreditDB.getById(creditId);
		res.json(updated);
	},
);

// Substitutions
app.get("/api/substitutions/:ageGroup", async (req, res) => {
	const availableLessons =
		await registrationManager.getAvailableSubstitutionLessons(
			req.params.ageGroup as string,
		);
	res.json(availableLessons);
});

app.post("/api/substitutions", async (req, res) => {
	const { lessonId, participant, missedLessonId } = req.body;

	const newParticipant = createParticipant({
		name: participant.name,
		email: participant.email,
		phone: participant.phone,
		ageGroup: participant.ageGroup,
	});

	const registration = await registrationManager.registerForSubstitution(
		lessonId,
		newParticipant,
		missedLessonId,
	);
	res.status(201).json(registration);
});

// Import — Step 1: parse file, return flat candidate list (no DB writes)
app.post(
	"/api/admin/participants-import/preview",
	requireAdmin,
	upload.single("file"),
	async (req, res) => {
		if (!req.file) {
			return res.status(400).json({ error: "No file uploaded" });
		}
		const buffer = fs.readFileSync(req.file.path);
		const parsed = parseOdsWorkbook(buffer);

		const sheets = parsed.sheets.map((s) => ({
			sheetName: s.sheetName,
			detectedLocation: s.detectedLocation,
			candidates: s.blocks.flatMap((b) =>
				b.rows
					.filter((r) => r.email)
					.map((r) => ({ kidName: r.name || r.email, parentEmail: r.email })),
			),
		}));

		res.json({ sheets });
	},
);

// Import — Step 2: assign selected candidates to an existing skupinka
app.post(
	"/api/admin/participants-import/commit",
	requireAdmin,
	async (req, res) => {
		const { courseId, candidates } = req.body as {
			courseId?: string;
			candidates?: { kidName: string; parentEmail: string }[];
		};

		if (!courseId) {
			return res.status(400).json({ error: "courseId is required" });
		}
		if (!Array.isArray(candidates) || candidates.length === 0) {
			return res
				.status(400)
				.json({ error: "candidates must be a non-empty array" });
		}

		const course = await CourseDB.getById(courseId);
		if (!course) {
			return res.status(400).json({ error: "Course not found" });
		}

		const ageGroup = course.ageGroup as string;
		let created = 0;
		let skipped = 0;

		for (const c of candidates) {
			if (!c.parentEmail) continue;
			const kidName = c.kidName || c.parentEmail;
			const existing = await ParticipantDB.getByEmailAndName(
				c.parentEmail,
				kidName,
			);

			if (!existing) {
				const newP = createParticipant({
					name: kidName,
					email: c.parentEmail,
					phone: "",
					ageGroup,
				});
				await ParticipantDB.insert(newP);
				await ParticipantDB.linkToCourse(newP.id, courseId);
				created++;
			} else {
				await ParticipantDB.linkToCourse(existing.id as string, courseId);
				skipped++;
			}
		}

		await registrationManager.syncGroupEnrollments(courseId);

		res.json({ processed: candidates.length, created, skipped });
	},
);

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

// Global Error Handling Middleware

// 404 handler - must come after all routes
app.use((req, res) => {
	logger.warn("Route not found", {
		method: req.method,
		path: req.path,
		correlationId: req.correlationId,
	});

	res.status(404).json({
		error: "Not Found",
		message: `Cannot ${req.method} ${req.path}`,
		correlationId: req.correlationId,
	});
});

// Global error handler - must be last middleware
app.use(
	(
		err: Error,
		req: express.Request,
		res: express.Response,
		_next: express.NextFunction,
	) => {
		logger.error("Unhandled error in request", {
			error: err.message,
			stack: err.stack,
			method: req.method,
			path: req.path,
			correlationId: req.correlationId,
		});

		// Don't leak error details in production
		const errorMessage = isProduction
			? "Internal Server Error"
			: err.message || "Internal Server Error";

		res.status(500).json({
			error: "Internal Server Error",
			message: errorMessage,
			correlationId: req.correlationId,
		});
	},
);

// Start server
const server = app.listen(PORT, () => {
	logger.info("Reservation System started", {
		port: PORT,
		environment: isProduction ? "production" : "development",
		url: `http://localhost:${PORT}`,
	});
});

// Graceful shutdown handler
function gracefulShutdown(signal: string) {
	logger.info(`Received ${signal}, starting graceful shutdown`);

	server.close(() => {
		logger.info("HTTP server closed");

		// Close database connection
		try {
			client.close();
			logger.info("Database connection closed");
		} catch (error) {
			logger.error("Error closing database", {
				error: error instanceof Error ? error.message : String(error),
			});
		}

		logger.info("Graceful shutdown complete");
		process.exit(0);
	});

	// Force shutdown after 10 seconds if graceful shutdown hangs
	setTimeout(() => {
		logger.error("Graceful shutdown timeout, forcing exit");
		process.exit(1);
	}, 10000);
}

// Listen for termination signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Note: uncaughtException and unhandledRejection handlers are registered
// at the top of the file (before any code that might crash) using console.error
// for reliable output in container environments.
