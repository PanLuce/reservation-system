import { expect, test } from "@playwright/test";
import bcrypt from "bcrypt";
import { LessonCalendarDB } from "../src/calendar-db.js";
import {
	initializeDatabase,
	ParticipantDB,
	resetDatabaseForTests,
	UserDB,
} from "../src/database.js";
import { createLesson } from "../src/lesson.js";
import { createParticipant } from "../src/participant.js";
import { RegistrationManagerDB } from "../src/registration-db.js";

import { BASE } from "./helpers/base.js";

function inDays(n: number): { date: string; dayOfWeek: string } {
	const d = new Date();
	d.setDate(d.getDate() + n);
	const days = [
		"Sunday",
		"Monday",
		"Tuesday",
		"Wednesday",
		"Thursday",
		"Friday",
		"Saturday",
	];
	return { date: d.toISOString().slice(0, 10), dayOfWeek: days[d.getDay()]! };
}

test.describe
	.serial("Kid selector — parent with multiple participants", () => {
		test.beforeEach(async () => {
			process.env.ADMIN_EMAIL_SEED = "admin@centrumrubacek.cz";
			process.env.ADMIN_PASSWORD_SEED = "admin123";
			await initializeDatabase();
			await resetDatabaseForTests();
		});

		test("selector lists both siblings and switching changes the shown lessons", async ({
			page,
		}) => {
			const anezka = createParticipant({
				name: "Anežka",
				email: "selector-sourozenci@test.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			const betka = createParticipant({
				name: "Bětka",
				email: "selector-sourozenci@test.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(anezka);
			await ParticipantDB.insert(betka);

			await UserDB.insert({
				id: "selector_sourozenci_mom",
				email: "selector-sourozenci@test.cz",
				passwordHash: await bcrypt.hash("mompass123", 10),
				name: "Maminka Sourozenců",
				role: "participant",
			});

			const calendar = new LessonCalendarDB();
			const rm = new RegistrationManagerDB();

			const anezkaDate = inDays(7);
			const anezkaLesson = createLesson({
				title: "Lekce Anežky",
				date: anezkaDate.date,
				dayOfWeek: anezkaDate.dayOfWeek,
				time: "10:00",
				ageGroup: "1 - 2 roky",
				capacity: 8,
			});
			await calendar.addLesson(anezkaLesson);
			await rm.registerParticipant(anezkaLesson.id, anezka);

			const betkaDate = inDays(9);
			const betkaLesson = createLesson({
				title: "Lekce Bětky",
				date: betkaDate.date,
				dayOfWeek: betkaDate.dayOfWeek,
				time: "14:00",
				ageGroup: "1 - 2 roky",
				capacity: 8,
			});
			await calendar.addLesson(betkaLesson);
			await rm.registerParticipant(betkaLesson.id, betka);

			await page.goto(`${BASE}/login.html`);
			await page.fill("#login-email", "selector-sourozenci@test.cz");
			await page.fill("#login-password", "mompass123");
			await page.click('button[type="submit"]');
			await page.waitForURL(`${BASE}/`, { timeout: 10000 });

			await page.click('[data-tab="my-reservations"]');

			const selector = page.locator("#participant-selector");
			await expect(selector).toBeVisible();
			const optionTexts = await selector.locator("option").allTextContents();
			expect(optionTexts.sort()).toEqual(["Anežka", "Bětka"]);

			await expect(page.locator("#my-lessons-list")).toContainText(
				"Lekce Anežky",
			);
			await expect(page.locator("#my-lessons-list")).not.toContainText(
				"Lekce Bětky",
			);

			await selector.selectOption({ label: "Bětka" });

			await expect(page.locator("#my-lessons-list")).toContainText(
				"Lekce Bětky",
			);
			await expect(page.locator("#my-lessons-list")).not.toContainText(
				"Lekce Anežky",
			);
		});

		test("parent with a single kid sees no selector", async ({ page }) => {
			const jedinacek = createParticipant({
				name: "Jedináček",
				email: "selector-jedinacek@test.cz",
				phone: "",
				ageGroup: "1 - 2 roky",
			});
			await ParticipantDB.insert(jedinacek);

			await UserDB.insert({
				id: "selector_jedinacek_rodic",
				email: "selector-jedinacek@test.cz",
				passwordHash: await bcrypt.hash("rodic123", 10),
				name: "Rodič Jedináčka",
				role: "participant",
			});

			await page.goto(`${BASE}/login.html`);
			await page.fill("#login-email", "selector-jedinacek@test.cz");
			await page.fill("#login-password", "rodic123");
			await page.click('button[type="submit"]');
			await page.waitForURL(`${BASE}/`, { timeout: 10000 });

			await page.click('[data-tab="my-reservations"]');

			await expect(page.locator("#participant-selector-wrap")).toBeHidden();
		});
	});
