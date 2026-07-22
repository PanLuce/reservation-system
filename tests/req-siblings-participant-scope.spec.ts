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
	.serial("requireParticipantScope — sibling membership", () => {
		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();
		});

		test("mom can reach the registrations endpoint for BOTH siblings sharing her email", async () => {
			const anezka = createParticipant({
				name: "Anežka",
				email: "scope-sourozenci@test.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			const betka = createParticipant({
				name: "Bětka",
				email: "scope-sourozenci@test.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(anezka);
			await ParticipantDB.insert(betka);

			await UserDB.insert({
				id: "scope_sourozenci_mom",
				email: "scope-sourozenci@test.cz",
				passwordHash: await bcrypt.hash("mompass123", 10),
				name: "Maminka Sourozenců",
				role: "participant",
			});

			const cookie = await loginAs("scope-sourozenci@test.cz", "mompass123");

			for (const kid of [anezka, betka]) {
				const res = await fetch(
					`${BASE}/api/participants/${kid.id}/registrations`,
					{ headers: { Cookie: cookie } },
				);
				expect(res.status).toBe(200);
			}
		});

		test("mom is denied access to an unrelated participant's registrations", async () => {
			const stranger = createParticipant({
				name: "Cizí Dítě",
				email: "jiny-rodic@test.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(stranger);

			await UserDB.insert({
				id: "scope_solo_mom",
				email: "scope-solo@test.cz",
				passwordHash: await bcrypt.hash("solopass123", 10),
				name: "Sólo Maminka",
				role: "participant",
			});

			const cookie = await loginAs("scope-solo@test.cz", "solopass123");
			const res = await fetch(
				`${BASE}/api/participants/${stranger.id}/registrations`,
				{ headers: { Cookie: cookie } },
			);
			expect(res.status).toBe(403);
		});
	});
