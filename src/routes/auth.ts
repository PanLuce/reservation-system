import express from "express";
import { authService } from "../app-context.js";
import {
	DEFAULT_ADMIN_EMAIL,
	DEFAULT_ADMIN_PASSWORD,
	DEFAULT_PARTICIPANT_EMAIL,
	DEFAULT_PARTICIPANT_PASSWORD,
} from "../database.js";
import { isQuickLoginEnabled } from "../env-flags.js";
import { requireAuth } from "../middleware/auth.js";
import "../types-express.js";

export const authRouter = express.Router();

// Test accounts quick-login — opt-in, served only when ENABLE_QUICK_LOGIN=true
authRouter.get("/api/test-accounts", (_req, res) => {
	if (!isQuickLoginEnabled(process.env.ENABLE_QUICK_LOGIN)) {
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
			label: "Přihlásit jako rodič",
			email: process.env.PARTICIPANT_EMAIL_SEED ?? DEFAULT_PARTICIPANT_EMAIL,
			password:
				process.env.PARTICIPANT_PASSWORD_SEED ?? DEFAULT_PARTICIPANT_PASSWORD,
			role: "participant",
		},
	];
	return res.json({ accounts });
});

// Authentication
authRouter.post("/api/auth/login", async (req, res) => {
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

authRouter.post("/api/auth/register", async (req, res) => {
	const { email, password, name } = req.body;

	if (!email || !password || !name) {
		return res
			.status(400)
			.json({ error: "Email, password, and name required" });
	}

	// participantId is intentionally NOT read from the request body: binding a
	// user to a participant must happen server-side (seed/admin invite), never
	// from client input, or any caller could claim another participant's data.
	const result = await authService.register(
		email,
		password,
		name,
		"participant",
	);

	if (!result.success) {
		return res.status(400).json({ error: result.error });
	}

	req.session.userId = result.user.id;
	res.status(201).json({ user: result.user });
});

authRouter.get("/api/auth/me", requireAuth, async (req, res) => {
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

authRouter.post("/api/auth/logout", (req, res) => {
	req.session.destroy((err) => {
		if (err) {
			return res.status(500).json({ error: "Logout failed" });
		}
		res.json({ message: "Logged out successfully" });
	});
});
