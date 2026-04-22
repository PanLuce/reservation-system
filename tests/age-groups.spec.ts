import { expect, test } from "@playwright/test";
import {
	AGE_GROUP_NAMES,
	AGE_GROUPS,
	ageGroupToColor,
	isValidAgeGroup,
} from "../src/age-groups.js";
import { createCourse } from "../src/course.js";

test.describe("Age groups module", () => {
	test("exports 9 age groups", () => {
		expect(AGE_GROUPS).toHaveLength(9);
	});

	test("every age group has a valid hex color", () => {
		const hexRe = /^#([0-9A-F]{3}){1,2}$/i;
		for (const g of AGE_GROUPS) {
			expect(g.color).toMatch(hexRe);
		}
	});

	test("ageGroupToColor returns the right color for each group", () => {
		for (const g of AGE_GROUPS) {
			expect(ageGroupToColor(g.name)).toBe(g.color);
		}
	});

	test("ageGroupToColor returns a fallback for unknown group", () => {
		const fallback = ageGroupToColor("not a real group");
		expect(fallback).toMatch(/^#/);
	});

	test("isValidAgeGroup accepts all canonical names", () => {
		for (const name of AGE_GROUP_NAMES) {
			expect(isValidAgeGroup(name)).toBe(true);
		}
	});

	test("isValidAgeGroup rejects old English labels", () => {
		expect(isValidAgeGroup("1-2 years")).toBe(false);
		expect(isValidAgeGroup("3-12 months")).toBe(false);
		expect(isValidAgeGroup("2-3 years")).toBe(false);
		expect(isValidAgeGroup("3-4 years")).toBe(false);
	});

	test("isValidAgeGroup rejects garbage", () => {
		expect(isValidAgeGroup("")).toBe(false);
		expect(isValidAgeGroup("teenager")).toBe(false);
	});
});

test.describe("createCourse with derived color", () => {
	test("derives color from ageGroup when no color provided", () => {
		const course = createCourse({ name: "Test", ageGroup: "1 - 2 roky" });
		expect(course.color).toBe(ageGroupToColor("1 - 2 roky"));
	});

	test("accepts explicit valid color", () => {
		const course = createCourse({
			name: "Test",
			ageGroup: "2 - 3 roky",
			color: "#123456",
		});
		expect(course.color).toBe("#123456");
	});

	test("derives color when provided color is invalid hex", () => {
		const course = createCourse({
			name: "Test",
			ageGroup: "2 - 3 roky",
			color: "not-a-color",
		});
		expect(course.color).toBe(ageGroupToColor("2 - 3 roky"));
	});

	test("throws when ageGroup is invalid", () => {
		expect(() =>
			createCourse({ name: "Test", ageGroup: "1-2 years" }),
		).toThrow(/Invalid age group/);
	});

	test("throws when ageGroup is empty", () => {
		expect(() =>
			createCourse({ name: "Test", ageGroup: "" }),
		).toThrow(/required/);
	});
});
