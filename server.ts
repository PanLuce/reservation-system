import express from "express";
import cors from "cors";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { LessonCalendarDB } from "./src/calendar-db.js";
import { createLesson } from "./src/lesson.js";
import type { Lesson } from "./src/lesson.js";
import { RegistrationManagerDB } from "./src/registration-db.js";
import { createParticipant } from "./src/participant.js";
import type { Participant } from "./src/participant.js";
import { ExcelParticipantLoader } from "./src/excel-loader.js";
import { initializeDatabase, seedSampleData } from "./src/database.js";

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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// File upload setup
const upload = multer({ dest: "uploads/" });

// Initialize data stores with database
const calendar = new LessonCalendarDB();
const registrationManager = new RegistrationManagerDB();
const excelLoader = new ExcelParticipantLoader();

// API Routes

// Lessons
app.get("/api/lessons", (req, res) => {
	res.json(calendar.getAllLessons());
});

app.get("/api/lessons/:id", (req, res) => {
	const lesson = calendar.getLessonById(req.params.id);
	if (!lesson) {
		return res.status(404).json({ error: "Lesson not found" });
	}
	res.json(lesson);
});

app.post("/api/lessons", (req, res) => {
	const lessonData = req.body;
	const lesson = createLesson({
		title: lessonData.title,
		dayOfWeek: lessonData.dayOfWeek,
		time: lessonData.time,
		location: lessonData.location,
		ageGroup: lessonData.ageGroup,
		capacity: Number(lessonData.capacity),
	});
	calendar.addLesson(lesson);
	res.status(201).json(lesson);
});

app.put("/api/lessons/:id", (req, res) => {
	const lesson = calendar.getLessonById(req.params.id);
	if (!lesson) {
		return res.status(404).json({ error: "Lesson not found" });
	}
	calendar.updateLesson(req.params.id, req.body);
	const updated = calendar.getLessonById(req.params.id);
	res.json(updated);
});

app.delete("/api/lessons/:id", (req, res) => {
	const count = calendar.bulkDeleteLessons({ id: req.params.id });
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
	const registrations =
		registrationManager.getRegistrationsForLesson(req.params.lessonId);
	res.json(registrations);
});

// Substitutions
app.get("/api/substitutions/:ageGroup", (req, res) => {
	const availableLessons =
		registrationManager.getAvailableSubstitutionLessons(req.params.ageGroup);
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
	res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
app.listen(PORT, () => {
	console.log(`🚀 Reservation System running at http://localhost:${PORT}`);
	console.log(`📅 Sample lessons loaded`);
	console.log(`\n✨ Open http://localhost:${PORT} in your browser\n`);
});
