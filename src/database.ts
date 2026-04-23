import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { type Client, createClient, type InValue } from "@libsql/client";
import bcrypt from "bcrypt";
import { logger } from "./logger.js";
import { toDateString } from "./types.js";
import { AGE_GROUP_MIGRATION, ageGroupToColor } from "./age-groups.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const url =
	process.env.TURSO_DATABASE_URL ||
	`file:${path.join(__dirname, "..", "data", "reservations.db")}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

// Ensure data directory exists for local file mode
if (url.startsWith("file:")) {
	const dataDir = path.join(__dirname, "..", "data");
	if (!fs.existsSync(dataDir)) {
		fs.mkdirSync(dataDir, { recursive: true });
	}
}

export const client: Client = createClient(
	authToken ? { url, authToken } : { url },
);

export async function initializeDatabase() {
	// PRAGMAs only work with local SQLite — Turso manages these server-side
	if (url.startsWith("file:")) {
		await client.execute("PRAGMA foreign_keys = ON");
		await client.execute("PRAGMA journal_mode = WAL");
		await client.execute("PRAGMA busy_timeout = 5000");
	}

	await client.batch(
		[
			{
				sql: `CREATE TABLE IF NOT EXISTS courses (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				ageGroup TEXT NOT NULL,
				color TEXT NOT NULL,
				location TEXT NOT NULL DEFAULT '',
				description TEXT,
				createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
			)`,
				args: [],
			},
			{
				sql: `CREATE TABLE IF NOT EXISTS lessons (
				id TEXT PRIMARY KEY,
				title TEXT NOT NULL,
				date TEXT NOT NULL,
				dayOfWeek TEXT NOT NULL,
				time TEXT NOT NULL,
				ageGroup TEXT NOT NULL,
				capacity INTEGER NOT NULL,
				enrolledCount INTEGER NOT NULL DEFAULT 0,
				courseId TEXT,
				createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE SET NULL
			)`,
				args: [],
			},
			{
				sql: `CREATE TABLE IF NOT EXISTS participants (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				email TEXT NOT NULL,
				phone TEXT NOT NULL,
				ageGroup TEXT NOT NULL,
				createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
			)`,
				args: [],
			},
			{
				sql: `CREATE TABLE IF NOT EXISTS users (
				id TEXT PRIMARY KEY,
				email TEXT UNIQUE NOT NULL,
				passwordHash TEXT NOT NULL,
				name TEXT NOT NULL,
				role TEXT NOT NULL CHECK(role IN ('admin', 'participant')),
				participantId TEXT,
				createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
				lastLogin DATETIME,
				FOREIGN KEY (participantId) REFERENCES participants(id) ON DELETE SET NULL
			)`,
				args: [],
			},
			{
				sql: `CREATE TABLE IF NOT EXISTS registrations (
				id TEXT PRIMARY KEY,
				lessonId TEXT NOT NULL,
				participantId TEXT NOT NULL,
				registeredAt DATETIME DEFAULT CURRENT_TIMESTAMP,
				status TEXT NOT NULL CHECK(status IN ('confirmed', 'waitlist', 'cancelled')),
				missedLessonId TEXT,
				FOREIGN KEY (lessonId) REFERENCES lessons(id) ON DELETE CASCADE,
				FOREIGN KEY (participantId) REFERENCES participants(id) ON DELETE CASCADE
			)`,
				args: [],
			},
			{
				sql: `CREATE TABLE IF NOT EXISTS course_participants (
				courseId TEXT NOT NULL,
				participantId TEXT NOT NULL,
				addedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (courseId, participantId),
				FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE,
				FOREIGN KEY (participantId) REFERENCES participants(id) ON DELETE CASCADE
			)`,
				args: [],
			},
			{
				sql: `CREATE TABLE IF NOT EXISTS substitution_credits (
				id TEXT PRIMARY KEY,
				participantId TEXT NOT NULL,
				earnedFromRegistrationId TEXT,
				earnedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
				expiresAt DATETIME NOT NULL,
				usedOnRegistrationId TEXT,
				usedAt DATETIME,
				FOREIGN KEY (participantId) REFERENCES participants(id) ON DELETE CASCADE
			)`,
				args: [],
			},
			{
				sql: `CREATE TABLE IF NOT EXISTS sessions (
				sid TEXT PRIMARY KEY,
				sess TEXT NOT NULL,
				expired DATETIME NOT NULL
			)`,
				args: [],
			},
			{
				sql: "CREATE INDEX IF NOT EXISTS idx_courses_ageGroup ON courses(ageGroup)",
				args: [],
			},
			{
				sql: "CREATE INDEX IF NOT EXISTS idx_lessons_dayOfWeek ON lessons(dayOfWeek)",
				args: [],
			},
			{
				sql: "CREATE INDEX IF NOT EXISTS idx_lessons_ageGroup ON lessons(ageGroup)",
				args: [],
			},
			{
				sql: "CREATE INDEX IF NOT EXISTS idx_lessons_courseId ON lessons(courseId)",
				args: [],
			},
			{
				sql: "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
				args: [],
			},
			{
				sql: "CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)",
				args: [],
			},
			{
				sql: "CREATE INDEX IF NOT EXISTS idx_registrations_lessonId ON registrations(lessonId)",
				args: [],
			},
			{
				sql: "CREATE INDEX IF NOT EXISTS idx_registrations_participantId ON registrations(participantId)",
				args: [],
			},
			{
				sql: "CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status)",
				args: [],
			},
			{
				sql: "CREATE INDEX IF NOT EXISTS idx_sessions_expired ON sessions(expired)",
				args: [],
			},
		],
		"write",
	);

	await migrateAgeGroups();
	await migrateLocationToCourses();
	await migrateDropParticipantCourseId();

	logger.info("Database initialized successfully");
}

async function migrateAgeGroups() {
	for (const [oldName, newName] of Object.entries(AGE_GROUP_MIGRATION)) {
		const newColor = ageGroupToColor(newName);
		await client.batch(
			[
				{
					sql: "UPDATE courses SET ageGroup = ?, color = ? WHERE ageGroup = ?",
					args: [newName, newColor, oldName],
				},
				{
					sql: "UPDATE participants SET ageGroup = ? WHERE ageGroup = ?",
					args: [newName, oldName],
				},
				{
					sql: "UPDATE lessons SET ageGroup = ? WHERE ageGroup = ?",
					args: [newName, oldName],
				},
			],
			"write",
		);
	}
}

async function migrateLocationToCourses() {
	// Add location column to courses if it doesn't exist yet (idempotent)
	try {
		await client.execute(
			"ALTER TABLE courses ADD COLUMN location TEXT NOT NULL DEFAULT ''",
		);
	} catch {
		// Column already exists — nothing to do
	}

	// Backfill courses.location from their first lesson's location BEFORE dropping the column
	try {
		await client.execute(`
			UPDATE courses
			SET location = (
				SELECT location FROM lessons
				WHERE lessons.courseId = courses.id
				  AND location IS NOT NULL AND location != ''
				LIMIT 1
			)
			WHERE location = '' AND EXISTS (
				SELECT 1 FROM lessons
				WHERE lessons.courseId = courses.id
				  AND location IS NOT NULL AND location != ''
			)
		`);
	} catch {
		// lessons.location may already be gone — ignore
	}

	// Remove location column from lessons (it now lives on courses)
	try {
		await client.execute("ALTER TABLE lessons DROP COLUMN location");
	} catch {
		// Already removed or not supported — nothing to do
	}
}

async function migrateDropParticipantCourseId() {
	try {
		await client.execute("ALTER TABLE participants DROP COLUMN courseId");
	} catch {
		// Column already dropped or not supported — nothing to do
	}
}

export async function resetDatabaseForTests() {
	await client.batch(
		[
			{ sql: "DELETE FROM sessions", args: [] },
			{ sql: "DELETE FROM substitution_credits", args: [] },
			{ sql: "DELETE FROM registrations", args: [] },
			{ sql: "DELETE FROM course_participants", args: [] },
			{ sql: "DELETE FROM users", args: [] },
			{ sql: "DELETE FROM lessons", args: [] },
			{ sql: "DELETE FROM participants", args: [] },
			{ sql: "DELETE FROM courses", args: [] },
		],
		"write",
	);
	await ensureAdminUser();
}

export async function ensureAdminUser() {
	const adminEmail = process.env.ADMIN_EMAIL_SEED;
	const adminPassword = process.env.ADMIN_PASSWORD_SEED;

	if (!adminEmail || !adminPassword) {
		console.warn("[seed] ADMIN_EMAIL_SEED / ADMIN_PASSWORD_SEED not set — skipping admin seed");
		return;
	}

	const existing = await client.execute({
		sql: "SELECT COUNT(*) as count FROM users WHERE email = ?",
		args: [adminEmail],
	});

	if (Number(existing.rows[0]?.count ?? 0) > 0) {
		return;
	}

	const passwordHash = await bcrypt.hash(adminPassword, 10);
	await client.execute({
		sql: "INSERT INTO users (id, email, passwordHash, name, role) VALUES (?, ?, ?, ?, ?)",
		args: ["admin_seed", adminEmail, passwordHash, "Admin", "admin"],
	});

	logger.info("Admin user ensured", { email: adminEmail });
}

export async function ensureDemoParticipant() {
	const participantEmail = process.env.PARTICIPANT_EMAIL_SEED;
	const participantPassword = process.env.PARTICIPANT_PASSWORD_SEED;

	if (!participantEmail || !participantPassword) {
		console.warn("[seed] PARTICIPANT_EMAIL_SEED / PARTICIPANT_PASSWORD_SEED not set — skipping demo participant seed");
		return;
	}

	const existing = await client.execute({
		sql: "SELECT COUNT(*) as count FROM users WHERE email = ?",
		args: [participantEmail],
	});
	if (Number(existing.rows[0]?.count ?? 0) > 0) {
		return;
	}

	const courseId = "demo_skupinka_seed";
	const participantId = "demo_participant_seed";
	const userId = "demo_user_seed";

	await client.execute({
		sql: "INSERT OR IGNORE INTO courses (id, name, ageGroup, color) VALUES (?, ?, ?, ?)",
		args: [courseId, "Demo skupinka", "1 - 2 roky", "#B3E5FC"],
	});

	await client.execute({
		sql: "INSERT OR IGNORE INTO participants (id, name, email, phone, ageGroup) VALUES (?, ?, ?, ?, ?)",
		args: [participantId, "Maminka Testovací", participantEmail, "", "1 - 2 roky"],
	});

	await client.execute({
		sql: "INSERT OR IGNORE INTO course_participants (courseId, participantId) VALUES (?, ?)",
		args: [courseId, participantId],
	});

	const today = new Date();
	const dayNames: string[] = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
	for (let i = 0; i < 3; i++) {
		const lessonDate = new Date(today);
		lessonDate.setDate(today.getDate() + 7 * (i + 1));
		const lessonId = `demo_lesson_seed_${i + 1}`;
		const dayOfWeek: string = dayNames[lessonDate.getDay()] ?? "Monday";
		await client.execute({
			sql: "INSERT OR IGNORE INTO lessons (id, title, date, dayOfWeek, time, ageGroup, capacity, enrolledCount, courseId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			args: [lessonId, `Demo lekce ${i + 1}`, toDateString(lessonDate), dayOfWeek, "10:00", "1 - 2 roky", 10, 1, courseId],
		});
		await client.execute({
			sql: "INSERT OR IGNORE INTO registrations (id, lessonId, participantId, status) VALUES (?, ?, ?, ?)",
			args: [`demo_reg_seed_${i + 1}`, lessonId, participantId, "confirmed"],
		});
	}

	const expiresAt = new Date(today);
	expiresAt.setMonth(expiresAt.getMonth() + 3);
	await client.execute({
		sql: "INSERT OR IGNORE INTO substitution_credits (id, participantId, earnedFromRegistrationId, expiresAt) VALUES (?, ?, ?, ?)",
		args: [randomUUID(), participantId, "demo_reg_seed_1", expiresAt.toISOString()],
	});

	const passwordHash = await bcrypt.hash(participantPassword, 10);
	await client.execute({
		sql: "INSERT OR IGNORE INTO users (id, email, passwordHash, name, role, participantId) VALUES (?, ?, ?, ?, ?, ?)",
		args: [userId, participantEmail, passwordHash, "Maminka Testovací", "participant", participantId],
	});

	logger.info("Demo participant ensured", { email: participantEmail });
}

export async function seedSampleData() {
	const result = await client.execute({
		sql: "SELECT COUNT(*) as count FROM lessons",
		args: [],
	});
	const count = Number(result.rows[0]?.count ?? 0);

	if (count === 0) {
		logger.info("Seeding sample data...");

		const today = new Date();
		const nextMonday = new Date(today);
		nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7));
		const nextTuesday = new Date(nextMonday);
		nextTuesday.setDate(nextMonday.getDate() + 1);
		const nextWednesday = new Date(nextMonday);
		nextWednesday.setDate(nextMonday.getDate() + 2);

		const mondayDate = toDateString(nextMonday);
		const tuesdayDate = toDateString(nextTuesday);
		const wednesdayDate = toDateString(nextWednesday);

		const sampleLessons: InValue[][] = [
			["lesson_1", "Cvičení pro maminky s dětmi - Pondělí dopoledne", mondayDate, "Monday", "10:00", "6-9 měsíců (do lezení)", 10, 3],
			["lesson_2", "Cvičení pro maminky s dětmi - Úterý odpoledne", tuesdayDate, "Tuesday", "14:00", "1 - 2 roky", 12, 8],
			["lesson_3", "Cvičení pro maminky s dětmi - Středa dopoledne", wednesdayDate, "Wednesday", "10:00", "2 - 3 roky", 15, 12],
		];

		for (const lesson of sampleLessons) {
			await client.execute({
				sql: "INSERT INTO lessons (id, title, date, dayOfWeek, time, ageGroup, capacity, enrolledCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
				args: lesson,
			});
		}

		logger.info("Sample data seeded successfully");
	}

	await ensureAdminUser();
	await ensureDemoParticipant();
}

// Database operations for Courses
export const CourseDB = {
	async getAll() {
		const result = await client.execute({
			sql: "SELECT * FROM courses ORDER BY name",
			args: [],
		});
		return result.rows;
	},

	async getById(id: string) {
		const result = await client.execute({
			sql: "SELECT * FROM courses WHERE id = ?",
			args: [id],
		});
		return result.rows[0];
	},

	async getByAgeGroup(ageGroup: string) {
		const result = await client.execute({
			sql: "SELECT * FROM courses WHERE ageGroup = ?",
			args: [ageGroup],
		});
		return result.rows;
	},

	async getByName(name: string) {
		const result = await client.execute({
			sql: "SELECT * FROM courses WHERE name = ?",
			args: [name],
		});
		return result.rows[0];
	},

	async insert(course: {
		id: string;
		name: string;
		ageGroup: string;
		color: string;
		location?: string;
		description?: string;
	}) {
		const result = await client.execute({
			sql: "INSERT INTO courses (id, name, ageGroup, color, location, description) VALUES (?, ?, ?, ?, ?, ?)",
			args: [
				course.id,
				course.name,
				course.ageGroup,
				course.color,
				course.location ?? "",
				course.description || null,
			],
		});
		return { changes: result.rowsAffected };
	},

	async update(
		id: string,
		updates: {
			name?: string;
			ageGroup?: string;
			color?: string;
			location?: string;
			description?: string;
		},
	) {
		const fields: string[] = [];
		const values: InValue[] = [];

		for (const [key, value] of Object.entries(updates)) {
			if (value !== undefined) {
				fields.push(`${key} = ?`);
				values.push(value);
			}
		}

		if (fields.length === 0) return;

		values.push(id);
		const result = await client.execute({
			sql: `UPDATE courses SET ${fields.join(", ")} WHERE id = ?`,
			args: values as InValue[],
		});
		return { changes: result.rowsAffected };
	},

	async delete(id: string) {
		const result = await client.execute({
			sql: "DELETE FROM courses WHERE id = ?",
			args: [id],
		});
		return { changes: result.rowsAffected };
	},
};

// Database operations for Lessons
export const LessonDB = {
	async getAll() {
		const result = await client.execute({
			sql: `SELECT l.*, COALESCE(c.location, '') AS location
				FROM lessons l
				LEFT JOIN courses c ON l.courseId = c.id
				ORDER BY l.dayOfWeek, l.time`,
			args: [],
		});
		return result.rows;
	},

	async getById(id: string) {
		const result = await client.execute({
			sql: `SELECT l.*, COALESCE(c.location, '') AS location
				FROM lessons l
				LEFT JOIN courses c ON l.courseId = c.id
				WHERE l.id = ?`,
			args: [id],
		});
		return result.rows[0];
	},

	async getByDay(dayOfWeek: string) {
		const result = await client.execute({
			sql: `SELECT l.*, COALESCE(c.location, '') AS location
				FROM lessons l
				LEFT JOIN courses c ON l.courseId = c.id
				WHERE l.dayOfWeek = ?`,
			args: [dayOfWeek],
		});
		return result.rows;
	},

	async insert(
		lesson: {
			id: string;
			title: string;
			date: string;
			dayOfWeek: string;
			time: string;
			location?: string; // ignored — location lives on courses now
			ageGroup: string;
			capacity: number;
			enrolledCount: number;
			courseId?: string;
		},
		courseId?: string,
	) {
		const resolvedCourseId = courseId ?? lesson.courseId ?? null;
		const result = await client.execute({
			sql: "INSERT INTO lessons (id, title, date, dayOfWeek, time, ageGroup, capacity, enrolledCount, courseId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			args: [
				lesson.id,
				lesson.title,
				lesson.date,
				lesson.dayOfWeek,
				lesson.time,
				lesson.ageGroup,
				lesson.capacity,
				lesson.enrolledCount,
				resolvedCourseId,
			],
		});
		return { changes: result.rowsAffected };
	},

	async update(id: string, updates: Partial<Record<string, unknown>>) {
		const fields = Object.keys(updates)
			.map((key) => `${key} = ?`)
			.join(", ");
		const values = [...Object.values(updates), id];
		const result = await client.execute({
			sql: `UPDATE lessons SET ${fields} WHERE id = ?`,
			args: values as InValue[],
		});
		return { changes: result.rowsAffected };
	},

	async delete(id: string) {
		const result = await client.execute({
			sql: "DELETE FROM lessons WHERE id = ?",
			args: [id],
		});
		return { changes: result.rowsAffected };
	},

	async bulkUpdate(
		filter: Record<string, unknown>,
		updates: Record<string, unknown>,
	) {
		const whereClause = Object.keys(filter)
			.map((key) => `${key} = ?`)
			.join(" AND ");
		const setClause = Object.keys(updates)
			.map((key) => `${key} = ?`)
			.join(", ");
		const values = [...Object.values(updates), ...Object.values(filter)];
		const result = await client.execute({
			sql: `UPDATE lessons SET ${setClause} WHERE ${whereClause}`,
			args: values as InValue[],
		});
		return { changes: result.rowsAffected };
	},

	async bulkDelete(filter: Record<string, unknown>) {
		const whereClause = Object.keys(filter)
			.map((key) => `${key} = ?`)
			.join(" AND ");
		const values = Object.values(filter);
		const result = await client.execute({
			sql: `DELETE FROM lessons WHERE ${whereClause}`,
			args: values as InValue[],
		});
		return { changes: result.rowsAffected };
	},

	async insertWithCourse(
		lesson: {
			id: string;
			title: string;
			date: string;
			dayOfWeek: string;
			time: string;
			location?: string; // ignored — location lives on courses now
			ageGroup: string;
			capacity: number;
			enrolledCount: number;
		},
		courseId: string,
	) {
		const result = await client.execute({
			sql: "INSERT INTO lessons (id, title, date, dayOfWeek, time, ageGroup, capacity, enrolledCount, courseId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			args: [
				lesson.id,
				lesson.title,
				lesson.date,
				lesson.dayOfWeek,
				lesson.time,
				lesson.ageGroup,
				lesson.capacity,
				lesson.enrolledCount,
				courseId,
			],
		});
		return { changes: result.rowsAffected };
	},

	async getByCourse(courseId: string) {
		const result = await client.execute({
			sql: `SELECT l.*, COALESCE(c.location, '') AS location
				FROM lessons l
				LEFT JOIN courses c ON l.courseId = c.id
				WHERE l.courseId = ?
				ORDER BY l.date, l.time`,
			args: [courseId],
		});
		return result.rows;
	},
};

// Database operations for Participants
export const ParticipantDB = {
	async insert(participant: {
		id: string;
		name: string;
		email: string;
		phone: string;
		ageGroup: string;
	}) {
		const result = await client.execute({
			sql: "INSERT INTO participants (id, name, email, phone, ageGroup) VALUES (?, ?, ?, ?, ?)",
			args: [
				participant.id,
				participant.name,
				participant.email,
				participant.phone,
				participant.ageGroup,
			],
		});
		return { changes: result.rowsAffected };
	},

	async getById(id: string) {
		const result = await client.execute({
			sql: "SELECT * FROM participants WHERE id = ?",
			args: [id],
		});
		return result.rows[0];
	},

	async getAll() {
		const result = await client.execute({
			sql: "SELECT * FROM participants",
			args: [],
		});
		return result.rows;
	},

	async getByEmail(email: string) {
		const result = await client.execute({
			sql: "SELECT * FROM participants WHERE email = ?",
			args: [email],
		});
		return result.rows[0];
	},

	async getRegistrationsByParticipantId(participantId: string) {
		const result = await client.execute({
			sql: "SELECT * FROM registrations WHERE participantId = ? ORDER BY id DESC",
			args: [participantId],
		});
		return result.rows;
	},

	async getRegistrationsWithLessonDetails(participantId: string) {
		const result = await client.execute({
			sql: `SELECT
				r.*,
				l.title as lessonTitle,
				l.date as lessonDate,
				l.time as lessonTime,
				l.dayOfWeek as lessonDayOfWeek,
				COALESCE(c.location, '') as lessonLocation,
				l.ageGroup as lessonAgeGroup,
				l.capacity as lessonCapacity,
				l.enrolledCount as lessonEnrolledCount
			FROM registrations r
			INNER JOIN lessons l ON r.lessonId = l.id
			LEFT JOIN courses c ON l.courseId = c.id
			WHERE r.participantId = ?
			ORDER BY l.date ASC, l.time ASC`,
			args: [participantId],
		});
		return result.rows;
	},

	async linkToCourse(participantId: string, courseId: string) {
		const result = await client.execute({
			sql: "INSERT OR IGNORE INTO course_participants (courseId, participantId) VALUES (?, ?)",
			args: [courseId, participantId],
		});
		return { changes: result.rowsAffected };
	},

	async getByCourse(courseId: string) {
		const result = await client.execute({
			sql: `SELECT p.* FROM participants p
			INNER JOIN course_participants cp ON p.id = cp.participantId
			WHERE cp.courseId = ?`,
			args: [courseId],
		});
		return result.rows;
	},

	async getCoursesForParticipant(participantId: string) {
		const result = await client.execute({
			sql: `SELECT c.* FROM courses c
			INNER JOIN course_participants cp ON c.id = cp.courseId
			WHERE cp.participantId = ?`,
			args: [participantId],
		});
		return result.rows;
	},
};

// Database operations for Registrations
export const RegistrationDB = {
	async insert(registration: {
		id: string;
		lessonId: string;
		participantId: string;
		status: string;
		missedLessonId?: string;
	}) {
		const result = await client.execute({
			sql: "INSERT INTO registrations (id, lessonId, participantId, status, missedLessonId) VALUES (?, ?, ?, ?, ?)",
			args: [
				registration.id,
				registration.lessonId,
				registration.participantId,
				registration.status,
				registration.missedLessonId || null,
			],
		});
		return { changes: result.rowsAffected };
	},

	async getByLessonId(lessonId: string) {
		const result = await client.execute({
			sql: "SELECT * FROM registrations WHERE lessonId = ?",
			args: [lessonId],
		});
		return result.rows;
	},

	async getById(id: string) {
		const result = await client.execute({
			sql: "SELECT * FROM registrations WHERE id = ?",
			args: [id],
		});
		return result.rows[0];
	},

	async update(id: string, updates: Record<string, unknown>) {
		const fields = Object.keys(updates)
			.map((key) => `${key} = ?`)
			.join(", ");
		const values = [...Object.values(updates), id];
		const result = await client.execute({
			sql: `UPDATE registrations SET ${fields} WHERE id = ?`,
			args: values as InValue[],
		});
		return { changes: result.rowsAffected };
	},

	async getByParticipantAndLesson(participantId: string, lessonId: string) {
		const result = await client.execute({
			sql: "SELECT * FROM registrations WHERE participantId = ? AND lessonId = ? LIMIT 1",
			args: [participantId, lessonId],
		});
		return result.rows[0];
	},

	async getByParticipantId(participantId: string) {
		const result = await client.execute({
			sql: "SELECT * FROM registrations WHERE participantId = ? ORDER BY registeredAt DESC",
			args: [participantId],
		});
		return result.rows;
	},

	async getAll() {
		const result = await client.execute({
			sql: "SELECT * FROM registrations",
			args: [],
		});
		return result.rows;
	},
};

// Database operations for Users
export const UserDB = {
	async insert(user: {
		id: string;
		email: string;
		passwordHash: string;
		name: string;
		role: string;
		participantId?: string;
	}) {
		const result = await client.execute({
			sql: "INSERT INTO users (id, email, passwordHash, name, role, participantId) VALUES (?, ?, ?, ?, ?, ?)",
			args: [
				user.id,
				user.email,
				user.passwordHash,
				user.name,
				user.role,
				user.participantId || null,
			],
		});
		return { changes: result.rowsAffected };
	},

	async getByEmail(email: string) {
		const result = await client.execute({
			sql: "SELECT * FROM users WHERE email = ?",
			args: [email],
		});
		return result.rows[0];
	},

	async getById(id: string) {
		const result = await client.execute({
			sql: "SELECT * FROM users WHERE id = ?",
			args: [id],
		});
		return result.rows[0];
	},

	async updateLastLogin(id: string) {
		const result = await client.execute({
			sql: "UPDATE users SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?",
			args: [id],
		});
		return { changes: result.rowsAffected };
	},

	async getAll() {
		const result = await client.execute({
			sql: "SELECT id, email, name, role, createdAt FROM users",
			args: [],
		});
		return result.rows;
	},

	async update(id: string, updates: Record<string, unknown>) {
		const fields = Object.keys(updates)
			.map((key) => `${key} = ?`)
			.join(", ");
		const values = [...Object.values(updates), id];
		const result = await client.execute({
			sql: `UPDATE users SET ${fields} WHERE id = ?`,
			args: values as InValue[],
		});
		return { changes: result.rowsAffected };
	},
};

// Database operations for Substitution Credits
export const CreditDB = {
	async insert(credit: {
		id: string;
		participantId: string;
		earnedFromRegistrationId: string | null;
		expiresAt: string;
	}) {
		await client.execute({
			sql: "INSERT INTO substitution_credits (id, participantId, earnedFromRegistrationId, expiresAt) VALUES (?, ?, ?, ?)",
			args: [
				credit.id,
				credit.participantId,
				credit.earnedFromRegistrationId,
				credit.expiresAt,
			],
		});
	},

	async getActiveByParticipant(participantId: string) {
		const now = new Date().toISOString();
		const result = await client.execute({
			sql: "SELECT * FROM substitution_credits WHERE participantId = ? AND usedOnRegistrationId IS NULL AND expiresAt > ? ORDER BY expiresAt ASC",
			args: [participantId, now],
		});
		return result.rows;
	},

	async markUsed(creditId: string, registrationId: string) {
		await client.execute({
			sql: "UPDATE substitution_credits SET usedOnRegistrationId = ?, usedAt = CURRENT_TIMESTAMP WHERE id = ?",
			args: [registrationId, creditId],
		});
	},

	async updateExpiry(creditId: string, newExpiresAt: string) {
		const result = await client.execute({
			sql: "UPDATE substitution_credits SET expiresAt = ? WHERE id = ?",
			args: [newExpiresAt, creditId],
		});
		return { changes: result.rowsAffected };
	},

	async getById(creditId: string) {
		const result = await client.execute({
			sql: "SELECT * FROM substitution_credits WHERE id = ?",
			args: [creditId],
		});
		return result.rows[0];
	},
};
