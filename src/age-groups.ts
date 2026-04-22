export const AGE_GROUPS = [
	{ name: "3-6 měsíců", color: "#FFE0B2" },
	{ name: "6-9 měsíců (do lezení)", color: "#FFF9C4" },
	{ name: "lezoucí děti", color: "#DCEDC8" },
	{ name: "první krůčky - 1,5 roku", color: "#C8E6C9" },
	{ name: "1 - 2 roky", color: "#B3E5FC" },
	{ name: "1,5 - 2,5 roky", color: "#B2EBF2" },
	{ name: "1,5 - 3 roky", color: "#D1C4E9" },
	{ name: "2 - 3 roky", color: "#F8BBD0" },
	{ name: "2,5 - 4 roky", color: "#FFCCBC" },
] as const;

export type AgeGroupName = (typeof AGE_GROUPS)[number]["name"];

export const AGE_GROUP_NAMES: string[] = AGE_GROUPS.map((g) => g.name);

export function ageGroupToColor(name: string): string {
	const found = AGE_GROUPS.find((g) => g.name === name);
	return found?.color ?? "#B3E5FC";
}

export function isValidAgeGroup(name: string): name is AgeGroupName {
	return AGE_GROUP_NAMES.includes(name);
}

// Migration map from old English labels to new Czech labels (one-time DB migration).
export const AGE_GROUP_MIGRATION: Record<string, string> = {
	"3-12 months": "6-9 měsíců (do lezení)",
	"1-2 years": "1 - 2 roky",
	"2-3 years": "2 - 3 roky",
	"3-4 years": "2,5 - 4 roky",
};
