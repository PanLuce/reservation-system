import { expect, test } from "@playwright/test";

// getLessonTileIcon is defined inline in app.js (browser-only).
// We reproduce the contract here to test the logic independently.

type TileIconResult = { icon: string; label: string; color?: string | null | undefined } | null;

function getLessonTileIcon(
	lesson: { id: string; title: string; enrolledCount: number; capacity: number; courseColor?: string | null },
	isParticipant: boolean,
	myRegisteredIds: Set<string>,
	subCandidateIds: Set<string>,
): TileIconResult {
	if (!isParticipant) {
		return { icon: "●", label: lesson.title, color: lesson.courseColor };
	}
	if (myRegisteredIds.has(lesson.id)) {
		return { icon: "❤️", label: `Moje lekce: ${lesson.title}` };
	}
	const isFull = lesson.enrolledCount >= lesson.capacity;
	if (isFull) {
		return { icon: "🚫", label: `Plná lekce: ${lesson.title}` };
	}
	if (subCandidateIds.has(lesson.id)) {
		return { icon: "✨", label: `Možná náhrada: ${lesson.title}` };
	}
	return null;
}

const baseLesson = { id: "l1", title: "Pondělní lekce", enrolledCount: 5, capacity: 10, courseColor: "#B3E5FC" };

test.describe("getLessonTileIcon", () => {
	test("admin always gets neutral dot regardless of registration state", () => {
		const result = getLessonTileIcon(baseLesson, false, new Set(["l1"]), new Set());
		expect(result?.icon).toBe("●");
	});

	test("participant registered → heart emoji", () => {
		const result = getLessonTileIcon(baseLesson, true, new Set(["l1"]), new Set());
		expect(result?.icon).toBe("❤️");
		expect(result?.label).toContain(baseLesson.title);
	});

	test("participant not registered, lesson full → no-entry emoji", () => {
		const full = { ...baseLesson, enrolledCount: 10, capacity: 10 };
		const result = getLessonTileIcon(full, true, new Set(), new Set());
		expect(result?.icon).toBe("🚫");
	});

	test("participant not registered, lesson not full, is a sub candidate → sparkle emoji", () => {
		const result = getLessonTileIcon(baseLesson, true, new Set(), new Set(["l1"]));
		expect(result?.icon).toBe("✨");
	});

	test("participant not registered, not full, not a sub candidate → null (hidden)", () => {
		const result = getLessonTileIcon(baseLesson, true, new Set(), new Set());
		expect(result).toBeNull();
	});

	test("registered takes priority over full (edge case: over-enrolled)", () => {
		const overEnrolled = { ...baseLesson, enrolledCount: 12, capacity: 10 };
		const result = getLessonTileIcon(overEnrolled, true, new Set(["l1"]), new Set());
		expect(result?.icon).toBe("❤️");
	});
});
