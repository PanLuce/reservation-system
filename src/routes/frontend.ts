import path from "node:path";
import express from "express";
import "../types-express.js";

// The public dir is resolved by the caller (server bootstrap) since it depends
// on the server entrypoint's location, not this module's.
export function createFrontendRouter(publicDir: string) {
	const router = express.Router();

	// Serve frontend
	router.get("/", (req, res) => {
		// Check if user is authenticated
		if (!req.session.userId) {
			return res.redirect("/login.html");
		}
		res.sendFile(path.join(publicDir, "index.html"));
	});

	router.get("/login.html", (req, res) => {
		// Redirect to main page if already logged in
		if (req.session.userId) {
			return res.redirect("/");
		}
		res.sendFile(path.join(publicDir, "login.html"));
	});

	return router;
}
