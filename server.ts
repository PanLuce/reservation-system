import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import { registrationManager, upload } from "./src/app-context.js";
import {
	CourseDB,
	client,
	initializeDatabase,
	ParticipantDB,
	seedSampleData,
} from "./src/database.js";
import { logger } from "./src/logger.js";
import { requireAdmin } from "./src/middleware/auth.js";
import { parseOdsWorkbook } from "./src/ods-loader.js";
import { createParticipant } from "./src/participant.js";
import { adminRouter } from "./src/routes/admin.js";
import { authRouter } from "./src/routes/auth.js";
import { coursesRouter } from "./src/routes/courses.js";
import { healthRouter } from "./src/routes/health.js";
import { lessonsRouter } from "./src/routes/lessons.js";
import { participantsRouter } from "./src/routes/participants.js";
import { registrationsRouter } from "./src/routes/registrations.js";
import { substitutionsRouter } from "./src/routes/substitutions.js";
import { LibSQLSessionStore } from "./src/session-store.js";
import "./src/types-express.js";

// Register global error handlers FIRST — before any code that might crash
process.on("uncaughtException", (error: Error) => {
	process.stderr.write(`FATAL uncaughtException: ${error}\n${error.stack}\n`);
	process.exit(1);
});
process.on("unhandledRejection", (reason: unknown) => {
	process.stderr.write(`FATAL unhandledRejection: ${reason}\n`);
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
		process.stderr.write(
			"FATAL: SESSION_SECRET environment variable is required in production\n",
		);
		process.exit(1);
	}
	if (!process.env.ALLOWED_ORIGINS) {
		process.stderr.write(
			"WARN: ALLOWED_ORIGINS not set, using default: https://centrumrubacek.cz\n",
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
	process.stderr.write(
		`FATAL: Database initialization failed: ${error}\n${error instanceof Error ? error.stack : ""}\n`,
	);
	process.exit(1);
}

const app = express();

// Trust first proxy (Render reverse proxy) — required for secure cookies behind proxy
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

// Health Check Endpoints
app.use(healthRouter);

// API Routes
app.use(authRouter);

// Lessons (public read, admin write) + age groups
app.use(lessonsRouter);

// Courses (skupinky) + Programs (kurzy) CRUD + course-scoped lessons
app.use(coursesRouter);

// Participant roster: course/lesson membership, transfers, bulk-register, sync
app.use(participantsRouter);

// Registrations + participant self-service
app.use(registrationsRouter);

// Admin overrides + substitutions
app.use(adminRouter);
app.use(substitutionsRouter);

// Import — Step 1: parse file, return flat candidate list (no DB writes)
app.post(
	"/api/admin/participants-import/preview",
	requireAdmin,
	upload.single("file"),
	async (req, res) => {
		if (!req.file) {
			return res.status(400).json({ error: "No file uploaded" });
		}
		try {
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
		} finally {
			fs.unlink(req.file.path, () => {});
		}
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
