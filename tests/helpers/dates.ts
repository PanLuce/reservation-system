import { localDateString } from "../../src/types.js";

// Prague-local relative dates for tests. Reuses the production localDateString
// (Europe/Prague) as the single source of truth so tests agree with the server's
// midnight-cutoff logic regardless of the machine's timezone (dev = Prague,
// CI/Render = UTC). Computing relative dates via new Date().toISOString() is UTC
// and goes off-by-one against Prague between local midnight and 01:00–02:00.

/** Today's date in Europe/Prague, as YYYY-MM-DD. */
export function today(): string {
	return localDateString();
}

/**
 * The Prague-local date n days from today, as YYYY-MM-DD. Anchors on today's
 * Prague date, then steps whole days at UTC noon (DST-safe: noon ± an hour never
 * crosses a day boundary), and re-derives the Prague date of the result.
 */
export function daysFromToday(n: number): string {
	const [y, m, d] = today().split("-").map(Number);
	const anchor = new Date(
		Date.UTC(y as number, (m as number) - 1, d as number, 12),
	);
	anchor.setUTCDate(anchor.getUTCDate() + n);
	return localDateString(anchor);
}

/** Tomorrow's date in Europe/Prague, as YYYY-MM-DD. */
export function tomorrow(): string {
	return daysFromToday(1);
}

/** Yesterday's date in Europe/Prague, as YYYY-MM-DD. */
export function yesterday(): string {
	return daysFromToday(-1);
}
