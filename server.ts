import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import session from "express-session";
import helmet from "helmet";
import { client, initializeDatabase, seedSampleData } from "./src/database.js";
import { logger } from "./src/logger.js";
import { adminRouter } from "./src/routes/admin.js";
import { authRouter } from "./src/routes/auth.js";
import { coursesRouter } from "./src/routes/courses.js";
import { createFrontendRouter } from "./src/routes/frontend.js";
import { healthRouter } from "./src/routes/health.js";
import { importRouter } from "./src/routes/import.js";
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

// ODS participant import (admin)
app.use(importRouter);

// Serve frontend
app.use(createFrontendRouter(path.join(__dirname, "public")));

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
// at the top of the file (before any code that might crash) using
// process.stderr.write for reliable output in container environments.
