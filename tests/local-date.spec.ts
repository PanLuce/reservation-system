import { expect, test } from "@playwright/test";
import { localDateString } from "../src/types.js";

// REQUIREMENTS item 13: "today" must be computed in Europe/Prague, not UTC.
// Render runs in UTC, so between local midnight and 01:00–02:00 a UTC-derived
// date is still "yesterday" — causing off-by-one errors in past/future lesson
// comparisons. localDateString must return the Prague-local calendar date
// regardless of the server's timezone.

test.describe("localDateString (Europe/Prague)", () => {
	test("returns the Prague date, not the UTC date, after local midnight (summer, UTC+2)", () => {
		// 2026-07-14 23:30 UTC = 2026-07-15 01:30 in Prague
		const instant = new Date("2026-07-14T23:30:00Z");
		expect(localDateString(instant)).toBe("2026-07-15");
	});

	test("returns the Prague date after local midnight (winter, UTC+1)", () => {
		// 2026-01-14 23:30 UTC = 2026-01-15 00:30 in Prague
		const instant = new Date("2026-01-14T23:30:00Z");
		expect(localDateString(instant)).toBe("2026-01-15");
	});

	test("agrees with UTC during the middle of the day", () => {
		const instant = new Date("2026-07-14T10:00:00Z");
		expect(localDateString(instant)).toBe("2026-07-14");
	});

	test("returns ISO YYYY-MM-DD format", () => {
		expect(localDateString(new Date("2026-03-05T12:00:00Z"))).toBe(
			"2026-03-05",
		);
	});
});
