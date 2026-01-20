/**
 * Course (Kurz) represents a group of lessons with shared characteristics
 */
export type Course = {
	id: string;
	name: string;
	ageGroup: string;
	color: string;
	description?: string;
	createdAt?: Date;
};

type CourseInput = {
	name: string;
	ageGroup: string;
	color: string;
	description?: string;
};

/**
 * Creates a new course with validation
 */
export function createCourse(input: CourseInput): Course {
	// ✨ Clean Code Suggestion: Validate inputs at the boundary
	if (!input.name || input.name.trim() === "") {
		throw new Error("Course name is required");
	}

	if (!input.ageGroup || input.ageGroup.trim() === "") {
		throw new Error("Age group is required");
	}

	// 📘 Clean Code Principle: Validate format early to fail fast
	if (!isValidHexColor(input.color)) {
		throw new Error("Color must be a valid hex color");
	}

	// Generate unique ID
	const id = `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

	return {
		id,
		name: input.name.trim(),
		ageGroup: input.ageGroup.trim(),
		color: input.color,
		description: input.description?.trim(),
		createdAt: new Date(),
	};
}

/**
 * Validates hex color format (#RRGGBB or #RGB)
 */
function isValidHexColor(color: string): boolean {
	return /^#([0-9A-F]{3}){1,2}$/i.test(color);
}
