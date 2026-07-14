import type express from "express";
import { authService } from "../app-context.js";
import "../types-express.js";

export function requireAuth(
	req: express.Request,
	res: express.Response,
	next: express.NextFunction,
) {
	if (!req.session.userId) {
		return res.status(401).json({ error: "Authentication required" });
	}
	next();
}

export async function requireAdmin(
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

// Allows access only if user is admin OR their participantId matches the :participantId param
export async function requireParticipantScope(
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
