import { ageGroupToColor, isValidAgeGroup } from "./age-groups.js";

export type Course = {
	id: string;
	name: string;
	ageGroup: string;
	color: string;
	location: string;
	description?: string;
	createdAt?: Date;
};

type CourseInput = {
	name: string;
	ageGroup: string;
	location?: string;
	color?: string;
	description?: string;
};

export function createCourse(input: CourseInput): Course {
	if (!input.name || input.name.trim() === "") {
		throw new Error("Course name is required");
	}

	if (!input.ageGroup || input.ageGroup.trim() === "") {
		throw new Error("Age group is required");
	}

	if (!isValidAgeGroup(input.ageGroup.trim())) {
		throw new Error(`Invalid age group: "${input.ageGroup}"`);
	}

	const color =
		input.color && isValidHexColor(input.color)
			? input.color
			: ageGroupToColor(input.ageGroup.trim());

	const id = `course_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	const trimmedDescription = input.description?.trim();

	return {
		id,
		name: input.name.trim(),
		ageGroup: input.ageGroup.trim(),
		color,
		location: (input.location ?? "").trim(),
		...(trimmedDescription !== undefined && {
			description: trimmedDescription,
		}),
		createdAt: new Date(),
	};
}

function isValidHexColor(color: string): boolean {
	return /^#([0-9A-F]{3}){1,2}$/i.test(color);
}
