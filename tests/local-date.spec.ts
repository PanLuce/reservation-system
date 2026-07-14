import { expect, test } from "@playwright/test";
import { isAfterMidnightCutoff } from "../src/registration-rules.js";
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

test.describe("isAfterMidnightCutoff (Europe/Prague)", () => {
	// The cutoff is midnight Prague at the start of the lesson day: a lesson
	// tomorrow is still cancellable, a lesson today or in the past is not. These
	// pin `now` to the tricky window (already past Prague midnight, still on the
	// previous UTC day) so a UTC-based regression can never slip back in.
	// 2026-07-14 22:30 UTC = 2026-07-15 00:30 Prague → Prague "today" is 07-15.
	const now = new Date("2026-07-14T22:30:00Z");

	test("lesson tomorrow (Prague) is NOT past cutoff — cancellable", () => {
		expect(isAfterMidnightCutoff("2026-07-16", now)).toBe(false);
	});

	test("lesson today (Prague) IS past cutoff — not cancellable", () => {
		expect(isAfterMidnightCutoff("2026-07-15", now)).toBe(true);
	});

	test("lesson yesterday (Prague) IS past cutoff", () => {
		expect(isAfterMidnightCutoff("2026-07-14", now)).toBe(true);
	});

	test("uses Prague date, not UTC: a lesson on the UTC-today date is already past cutoff", () => {
		// 2026-07-14 is UTC's "today" at this instant, but Prague is on 07-15, so
		// a lesson dated 07-14 is in Prague's past → cutoff passed.
		expect(isAfterMidnightCutoff("2026-07-14", now)).toBe(true);
	});
});
