import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "reservations.db");

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
	fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
export const db = new Database(dbPath);

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Initialize database schema
export function initializeDatabase() {
	// Lessons table
	db.exec(`
    CREATE TABLE IF NOT EXISTS lessons (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      dayOfWeek TEXT NOT NULL,
      time TEXT NOT NULL,
      location TEXT NOT NULL,
      ageGroup TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      enrolledCount INTEGER NOT NULL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

	// Participants table
	db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      ageGroup TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

	// Users table for authentication
	db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'participant')),
      participantId TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastLogin DATETIME,
      FOREIGN KEY (participantId) REFERENCES participants(id) ON DELETE SET NULL
    )
  `);

	// Registrations table
	db.exec(`
    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      lessonId TEXT NOT NULL,
      participantId TEXT NOT NULL,
      registeredAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL CHECK(status IN ('confirmed', 'waitlist', 'cancelled')),
      missedLessonId TEXT,
      FOREIGN KEY (lessonId) REFERENCES lessons(id) ON DELETE CASCADE,
      FOREIGN KEY (participantId) REFERENCES participants(id) ON DELETE CASCADE
    )
  `);

	// Indexes for performance
	db.exec(`
    CREATE INDEX IF NOT EXISTS idx_lessons_dayOfWeek ON lessons(dayOfWeek);
    CREATE INDEX IF NOT EXISTS idx_lessons_ageGroup ON lessons(ageGroup);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_registrations_lessonId ON registrations(lessonId);
    CREATE INDEX IF NOT EXISTS idx_registrations_participantId ON registrations(participantId);
    CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
  `);

	console.log("✅ Database initialized");
}

// Seed sample data
export function seedSampleData() {
	const countStmt = db.prepare("SELECT COUNT(*) as count FROM lessons");
	const result = countStmt.get() as { count: number };

	if (result.count === 0) {
		console.log("📝 Seeding sample data...");

		const insertLesson = db.prepare(`
      INSERT INTO lessons (id, title, dayOfWeek, time, location, ageGroup, capacity, enrolledCount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

		const sampleLessons = [
			[
				"lesson_1",
				"Cvičení pro maminky s dětmi - Pondělí dopoledne",
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
				"Wednesday",
				"10:00",
				"DK Poklad",
				"2-3 years",
				15,
				12,
			],
		];

		for (const lesson of sampleLessons) {
			insertLesson.run(...lesson);
		}

		// Create default admin user
		const userCountStmt = db.prepare("SELECT COUNT(*) as count FROM users");
		const userResult = userCountStmt.get() as { count: number };

		if (userResult.count === 0) {
			const adminPassword = "admin123"; // Change this in production!
			const passwordHash = bcrypt.hashSync(adminPassword, 10);

			const insertUser = db.prepare(`
        INSERT INTO users (id, email, passwordHash, name, role)
        VALUES (?, ?, ?, ?, ?)
      `);

			insertUser.run(
				"admin_1",
				"admin@centrumrubacek.cz",
				passwordHash,
				"Admin",
				"admin",
			);

			console.log("👤 Default admin user created:");
			console.log("   Email: admin@centrumrubacek.cz");
			console.log("   Password: admin123");
		}

		console.log("✅ Sample data seeded");
	}
}

// Database operations for Lessons
export const LessonDB = {
	getAll() {
		const stmt = db.prepare("SELECT * FROM lessons ORDER BY dayOfWeek, time");
		return stmt.all();
	},

	getById(id: string) {
		const stmt = db.prepare("SELECT * FROM lessons WHERE id = ?");
		return stmt.get(id);
	},

	getByDay(dayOfWeek: string) {
		const stmt = db.prepare("SELECT * FROM lessons WHERE dayOfWeek = ?");
		return stmt.all(dayOfWeek);
	},

	insert(lesson: {
		id: string;
		title: string;
		dayOfWeek: string;
		time: string;
		location: string;
		ageGroup: string;
		capacity: number;
		enrolledCount: number;
	}) {
		const stmt = db.prepare(`
      INSERT INTO lessons (id, title, dayOfWeek, time, location, ageGroup, capacity, enrolledCount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
		return stmt.run(
			lesson.id,
			lesson.title,
			lesson.dayOfWeek,
			lesson.time,
			lesson.location,
			lesson.ageGroup,
			lesson.capacity,
			lesson.enrolledCount,
		);
	},

	update(id: string, updates: Partial<Record<string, unknown>>) {
		const fields = Object.keys(updates)
			.map((key) => `${key} = ?`)
			.join(", ");
		const values = [...Object.values(updates), id];
		const stmt = db.prepare(`UPDATE lessons SET ${fields} WHERE id = ?`);
		return stmt.run(...values);
	},

	delete(id: string) {
		const stmt = db.prepare("DELETE FROM lessons WHERE id = ?");
		return stmt.run(id);
	},

	bulkUpdate(
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
		const stmt = db.prepare(
			`UPDATE lessons SET ${setClause} WHERE ${whereClause}`,
		);
		return stmt.run(...values);
	},

	bulkDelete(filter: Record<string, unknown>) {
		const whereClause = Object.keys(filter)
			.map((key) => `${key} = ?`)
			.join(" AND ");
		const values = Object.values(filter);
		const stmt = db.prepare(`DELETE FROM lessons WHERE ${whereClause}`);
		return stmt.run(...values);
	},
};

// Database operations for Participants
export const ParticipantDB = {
	insert(participant: {
		id: string;
		name: string;
		email: string;
		phone: string;
		ageGroup: string;
	}) {
		const stmt = db.prepare(`
      INSERT INTO participants (id, name, email, phone, ageGroup)
      VALUES (?, ?, ?, ?, ?)
    `);
		return stmt.run(
			participant.id,
			participant.name,
			participant.email,
			participant.phone,
			participant.ageGroup,
		);
	},

	getById(id: string) {
		const stmt = db.prepare("SELECT * FROM participants WHERE id = ?");
		return stmt.get(id);
	},

	getAll() {
		const stmt = db.prepare("SELECT * FROM participants");
		return stmt.all();
	},
};

// Database operations for Registrations
export const RegistrationDB = {
	insert(registration: {
		id: string;
		lessonId: string;
		participantId: string;
		status: string;
		missedLessonId?: string;
	}) {
		const stmt = db.prepare(`
      INSERT INTO registrations (id, lessonId, participantId, status, missedLessonId)
      VALUES (?, ?, ?, ?, ?)
    `);
		return stmt.run(
			registration.id,
			registration.lessonId,
			registration.participantId,
			registration.status,
			registration.missedLessonId || null,
		);
	},

	getByLessonId(lessonId: string) {
		const stmt = db.prepare("SELECT * FROM registrations WHERE lessonId = ?");
		return stmt.all(lessonId);
	},

	getById(id: string) {
		const stmt = db.prepare("SELECT * FROM registrations WHERE id = ?");
		return stmt.get(id);
	},

	update(id: string, updates: Record<string, unknown>) {
		const fields = Object.keys(updates)
			.map((key) => `${key} = ?`)
			.join(", ");
		const values = [...Object.values(updates), id];
		const stmt = db.prepare(`UPDATE registrations SET ${fields} WHERE id = ?`);
		return stmt.run(...values);
	},

	getAll() {
		const stmt = db.prepare("SELECT * FROM registrations");
		return stmt.all();
	},
};

// Database operations for Users
export const UserDB = {
	insert(user: {
		id: string;
		email: string;
		passwordHash: string;
		name: string;
		role: string;
		participantId?: string;
	}) {
		const stmt = db.prepare(`
      INSERT INTO users (id, email, passwordHash, name, role, participantId)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
		return stmt.run(
			user.id,
			user.email,
			user.passwordHash,
			user.name,
			user.role,
			user.participantId || null,
		);
	},

	getByEmail(email: string) {
		const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
		return stmt.get(email);
	},

	getById(id: string) {
		const stmt = db.prepare("SELECT * FROM users WHERE id = ?");
		return stmt.get(id);
	},

	updateLastLogin(id: string) {
		const stmt = db.prepare(
			"UPDATE users SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?",
		);
		return stmt.run(id);
	},

	getAll() {
		const stmt = db.prepare(
			"SELECT id, email, name, role, createdAt FROM users",
		);
		return stmt.all();
	},

	update(id: string, updates: Record<string, unknown>) {
		const fields = Object.keys(updates)
			.map((key) => `${key} = ?`)
			.join(", ");
		const values = [...Object.values(updates), id];
		const stmt = db.prepare(`UPDATE users SET ${fields} WHERE id = ?`);
		return stmt.run(...values);
	},
};
