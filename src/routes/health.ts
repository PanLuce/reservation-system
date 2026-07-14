import express from "express";
import { client } from "../database.js";
import { logger } from "../logger.js";

export const healthRouter = express.Router();

// Track server start time for uptime
const serverStartTime = Date.now();

// Basic health check - just confirms server is running
healthRouter.get("/health", (_req, res) => {
	res.json({
		status: "ok",
		timestamp: new Date().toISOString(),
		uptime: Math.floor((Date.now() - serverStartTime) / 1000), // in seconds
	});
});

// Readiness check - verifies dependencies (database) are available
healthRouter.get("/ready", async (_req, res) => {
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
