import type { Client } from "@libsql/client";
import type { SessionData } from "express-session";
import { Store } from "express-session";

export class LibSQLSessionStore extends Store {
	private db: Client;

	constructor(db: Client) {
		super();
		this.db = db;
	}

	get(
		sid: string,
		callback: (err: unknown, session?: SessionData | null) => void,
	): void {
		this.db
			.execute({
				sql: "SELECT sess FROM sessions WHERE sid = ? AND expired > ?",
				args: [sid, new Date().toISOString()],
			})
			.then((result) => {
				const row = result.rows[0];
				if (!row) {
					return callback(null, null);
				}
				const session = JSON.parse(row.sess as string) as SessionData;
				callback(null, session);
			})
			.catch((err) => callback(err));
	}

	set(
		sid: string,
		session: SessionData,
		callback?: (err?: unknown) => void,
	): void {
		const maxAge = session.cookie.maxAge ?? 86400000; // default 24h
		const expired = new Date(Date.now() + maxAge).toISOString();
		const sess = JSON.stringify(session);

		// Clean up expired sessions, then upsert
		this.db
			.execute({
				sql: "DELETE FROM sessions WHERE expired <= ?",
				args: [new Date().toISOString()],
			})
			.then(() =>
				this.db.execute({
					sql: "INSERT OR REPLACE INTO sessions (sid, sess, expired) VALUES (?, ?, ?)",
					args: [sid, sess, expired],
				}),
			)
			.then(() => callback?.())
			.catch((err) => callback?.(err));
	}

	destroy(sid: string, callback?: (err?: unknown) => void): void {
		this.db
			.execute({
				sql: "DELETE FROM sessions WHERE sid = ?",
				args: [sid],
			})
			.then(() => callback?.())
			.catch((err) => callback?.(err));
	}

	touch(sid: string, session: SessionData, callback?: () => void): void {
		const maxAge = session.cookie.maxAge ?? 86400000;
		const expired = new Date(Date.now() + maxAge).toISOString();

		this.db
			.execute({
				sql: "UPDATE sessions SET expired = ? WHERE sid = ?",
				args: [expired, sid],
			})
			.then(() => callback?.())
			.catch(() => callback?.());
	}
}
