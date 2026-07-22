import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";
import {
	initializeDatabase,
	ParticipantDB,
	resetDatabaseForTests,
	UserDB,
} from "../src/database.js";
import { createParticipant } from "../src/participant.js";

import { BASE } from "./helpers/base.js";

async function loginAs(email: string, password: string): Promise<string> {
	const res = await fetch(`${BASE}/api/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});
	return res.headers.get("set-cookie") ?? "";
}

test.describe
	.serial("GET /api/auth/me — sibling participants", () => {
		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();
		});

		test("returns both siblings sharing the parent's login email", async () => {
			const anezka = createParticipant({
				name: "Anežka",
				email: "sourozenci-me@test.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			const betka = createParticipant({
				name: "Bětka",
				email: "sourozenci-me@test.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(anezka);
			await ParticipantDB.insert(betka);

			await UserDB.insert({
				id: "sourozenci_mom",
				email: "sourozenci-me@test.cz",
				passwordHash: await bcrypt.hash("mompass123", 10),
				name: "Maminka Sourozenců",
				role: "participant",
			});

			const cookie = await loginAs("sourozenci-me@test.cz", "mompass123");
			const res = await fetch(`${BASE}/api/auth/me`, {
				headers: { Cookie: cookie },
			});

			expect(res.status).toBe(200);
			const data = (await res.json()) as {
				user: { participants?: { id: string; name: string }[] };
			};
			expect(data.user.participants).toHaveLength(2);
			const names = data.user.participants?.map((p) => p.name).sort();
			expect(names).toEqual(["Anežka", "Bětka"]);
		});

		test("parent with a single kid still gets a one-item participants array", async () => {
			const jedinacek = createParticipant({
				name: "Jedináček",
				email: "jedinacek@test.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(jedinacek);

			await UserDB.insert({
				id: "jedinacek_rodic",
				email: "jedinacek@test.cz",
				passwordHash: await bcrypt.hash("rodic123", 10),
				name: "Rodič Jedináčka",
				role: "participant",
			});

			const cookie = await loginAs("jedinacek@test.cz", "rodic123");
			const res = await fetch(`${BASE}/api/auth/me`, {
				headers: { Cookie: cookie },
			});

			const data = (await res.json()) as {
				user: { participants?: { id: string; name: string }[] };
			};
			expect(data.user.participants).toHaveLength(1);
			expect(data.user.participants?.[0]?.name).toBe("Jedináček");
		});
	});
