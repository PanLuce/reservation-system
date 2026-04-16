import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Client, createClient, type InValue } from "@libsql/client";
import bcrypt from "bcrypt";
import { logger } from "./logger.js";

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
	// PRAGMAs must be set outside of batch (transaction)
	await client.execute("PRAGMA foreign_keys = ON");
	await client.execute("PRAGMA journal_mode = WAL");
	await client.execute("PRAGMA busy_timeout = 5000");

	await client.batch(
		[
			{
				sql: `CREATE TABLE IF NOT EXISTS courses (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				ageGroup TEXT NOT NULL,
				color TEXT NOT NULL,
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
				location TEXT NOT NULL,
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
				courseId TEXT,
				createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
				FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE SET NULL
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
				sql: "CREATE INDEX IF NOT EXISTS idx_participants_courseId ON participants(courseId)",
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
		],
		"write",
	);

	logger.info("Database initialized successfully");
}

export async function resetDatabaseForTests() {
	await client.batch(
		[
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

		const mondayDate = nextMonday.toISOString().split("T")[0]!;
		const tuesdayDate = nextTuesday.toISOString().split("T")[0]!;
		const wednesdayDate = nextWednesday.toISOString().split("T")[0]!;

		const sampleLessons: InValue[][] = [
			[
				"lesson_1",
				"Cvičení pro maminky s dětmi - Pondělí dopoledne",
				mondayDate,
				"Monday",
				"10:00",
				"CVČ Vietnamská",
				"3-12 months",
				10,
				3,
			],
			[
				"lesson_2",
				"Cvičení pro maminky s dětmi - Úterý odpoledne",
				tuesdayDate,
				"Tuesday",
				"14:00",
				"CVČ Jeremiáše",
				"1-2 years",
				12,
				8,
			],
			[
				"lesson_3",
				"Cvičení pro maminky s dětmi - Středa dopoledne",
				wednesdayDate,
				"Wednesday",
				"10:00",
				"DK Poklad",
				"2-3 years",
				15,
				12,
			],
		];

		for (const lesson of sampleLessons) {
			await client.execute({
				sql: "INSERT INTO lessons (id, title, date, dayOfWeek, time, location, ageGroup, capacity, enrolledCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
				args: lesson,
			});
		}

		logger.info("Sample data seeded successfully");
	}

	await ensureAdminUser();
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

	async insert(course: {
		id: string;
		name: string;
		ageGroup: string;
		color: string;
		description?: string;
	}) {
		const result = await client.execute({
			sql: "INSERT INTO courses (id, name, ageGroup, color, description) VALUES (?, ?, ?, ?, ?)",
			args: [
				course.id,
				course.name,
				course.ageGroup,
				course.color,
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
			sql: "SELECT * FROM lessons ORDER BY dayOfWeek, time",
			args: [],
		});
		return result.rows;
	},

	async getById(id: string) {
		const result = await client.execute({
			sql: "SELECT * FROM lessons WHERE id = ?",
			args: [id],
		});
		return result.rows[0];
	},

	async getByDay(dayOfWeek: string) {
		const result = await client.execute({
			sql: "SELECT * FROM lessons WHERE dayOfWeek = ?",
			args: [dayOfWeek],
		});
		return result.rows;
	},

	async insert(lesson: {
		id: string;
		title: string;
		date: string;
		dayOfWeek: string;
		time: string;
		location: string;
		ageGroup: string;
		capacity: number;
		enrolledCount: number;
	}) {
		const result = await client.execute({
			sql: "INSERT INTO lessons (id, title, date, dayOfWeek, time, location, ageGroup, capacity, enrolledCount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
			args: [
				lesson.id,
				lesson.title,
				lesson.date,
				lesson.dayOfWeek,
				lesson.time,
				lesson.location,
				lesson.ageGroup,
				lesson.capacity,
				lesson.enrolledCount,
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
			location: string;
			ageGroup: string;
			capacity: number;
			enrolledCount: number;
		},
		courseId: string,
	) {
		const result = await client.execute({
			sql: "INSERT INTO lessons (id, title, date, dayOfWeek, time, location, ageGroup, capacity, enrolledCount, courseId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
			args: [
				lesson.id,
				lesson.title,
				lesson.date,
				lesson.dayOfWeek,
				lesson.time,
				lesson.location,
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
			sql: "SELECT * FROM lessons WHERE courseId = ? ORDER BY date, time",
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
				l.location as lessonLocation,
				l.ageGroup as lessonAgeGroup,
				l.capacity as lessonCapacity,
				l.enrolledCount as lessonEnrolledCount
			FROM registrations r
			INNER JOIN lessons l ON r.lessonId = l.id
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
