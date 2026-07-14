import fs from "node:fs";
import express from "express";
import { registrationManager, upload } from "../app-context.js";
import { CourseDB, ParticipantDB } from "../database.js";
import { requireAdmin } from "../middleware/auth.js";
import { parseOdsWorkbook } from "../ods-loader.js";
import { createParticipant } from "../participant.js";

export const importRouter = express.Router();

// Import — Step 1: parse file, return flat candidate list (no DB writes)
importRouter.post(
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
importRouter.post(
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
