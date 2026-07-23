import { expect, test } from "@playwright/test";

// getLessonTileIcon is defined in public/js/calendar.js (browser-only).
// We reproduce the contract here to test the logic independently.
//
// Requirement: parents must see every lesson on the calendar, exactly like
// admins do (colored pill per lesson) — no per-participant hiding or
// alternate icons on the grid itself.

type TileIconResult = {
	pill: true;
	color: string;
	tooltip: string;
};

function getLessonTileIcon(lesson: {
	id: string;
	title: string;
	enrolledCount: number;
	capacity: number;
	courseColor?: string | null;
}): TileIconResult {
	const color = lesson.courseColor || "#B3E5FC";
	return { pill: true, color, tooltip: lesson.title };
}

const baseLesson = {
	id: "l1",
	title: "Pondělní lekce",
	enrolledCount: 5,
	capacity: 10,
	courseColor: "#B3E5FC",
};

test.describe("getLessonTileIcon", () => {
	test("always returns a pill, regardless of registration state", () => {
		const result = getLessonTileIcon(baseLesson);
		expect(result.pill).toBe(true);
		expect(result.color).toBe(baseLesson.courseColor);
	});

	test("full lesson still renders a pill, not a no-entry icon", () => {
		const full = { ...baseLesson, enrolledCount: 10, capacity: 10 };
		const result = getLessonTileIcon(full);
		expect(result.pill).toBe(true);
	});

	test("lesson with no course color falls back to the default pill color", () => {
		const uncolored = { ...baseLesson, courseColor: null };
		const result = getLessonTileIcon(uncolored);
		expect(result.color).toBe("#B3E5FC");
	});

	test("over-enrolled lesson still renders a pill", () => {
		const overEnrolled = { ...baseLesson, enrolledCount: 12, capacity: 10 };
		const result = getLessonTileIcon(overEnrolled);
		expect(result.pill).toBe(true);
	});
});
