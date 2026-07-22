import bcrypt from "bcrypt";
import { ParticipantDB, UserDB } from "./database.js";

export type User = {
	id: string;
	email: string;
	name: string;
	role: "admin" | "participant";
	participantId?: string;
	participants?: { id: string; name: string }[];
};

export type LoginResult =
	| { success: true; user: User }
	| { success: false; error: string };

export class AuthService {
	async login(email: string, password: string): Promise<LoginResult> {
		const user = (await UserDB.getByEmail(email)) as
			| Record<string, unknown>
			| undefined;

		if (!user) {
			return { success: false, error: "Invalid email or password" };
		}

		const passwordMatch = await bcrypt.compare(
			password,
			user.passwordHash as string,
		);

		if (!passwordMatch) {
			return { success: false, error: "Invalid email or password" };
		}

		// Update last login
		await UserDB.updateLastLogin(user.id as string);

		// Return user without password
		const participantId = user.participantId as string | undefined;
		return {
			success: true,
			user: {
				id: user.id as string,
				email: user.email as string,
				name: user.name as string,
				role: user.role as "admin" | "participant",
				...(participantId !== undefined && { participantId }),
			},
		};
	}

	async register(
		email: string,
		password: string,
		name: string,
		role: "admin" | "participant" = "participant",
		participantId?: string,
	): Promise<LoginResult> {
		// Check if user already exists
		const existingUser = await UserDB.getByEmail(email);
		if (existingUser) {
			return { success: false, error: "User already exists" };
		}

		// Hash password
		const passwordHash = await bcrypt.hash(password, 10);

		// Create user
		const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

		await UserDB.insert({
			id: userId,
			email,
			passwordHash,
			name,
			role,
			...(participantId !== undefined && { participantId }),
		});

		return {
			success: true,
			user: {
				id: userId,
				email,
				name,
				role,
				...(participantId !== undefined && { participantId }),
			},
		};
	}

	async verifyToken(userId: string): Promise<User | null> {
		const user = (await UserDB.getById(userId)) as
			| Record<string, unknown>
			| undefined;

		if (!user) {
			return null;
		}

		const siblings = (await ParticipantDB.getAllByEmail(
			user.email as string,
		)) as Record<string, unknown>[];
		const participants = siblings.map((p) => ({
			id: p.id as string,
			name: p.name as string,
		}));

		const participantId =
			(user.participantId as string | undefined) ?? participants[0]?.id;
		return {
			id: user.id as string,
			email: user.email as string,
			name: user.name as string,
			role: user.role as "admin" | "participant",
			...(participantId !== undefined && { participantId }),
			participants,
		};
	}
}
