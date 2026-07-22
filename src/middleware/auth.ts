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

// Allows access only if user is admin OR the :participantId param is one of the
// participants sharing the user's email (siblings included, see AuthService.verifyToken)
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
	if (user.participants?.some((p) => p.id === req.params.participantId)) {
		return next();
	}
	return res.status(403).json({ error: "Access denied" });
}
