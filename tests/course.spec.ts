import { test, expect } from "@playwright/test";
import { createCourse, type Course } from "../src/course.js";
import { CourseDB, initializeDatabase } from "../src/database.js";

test.describe("Course/Group Management - TDD", () => {
	test("should create a course with valid data", () => {
		// Arrange
		const courseData = {
			name: "Pondělí dopoledne - Batolata",
			ageGroup: "1-2 years",
			color: "#4CAF50",
			description: "Cvičení pro batolata v pondělí dopoledne",
		};

		// Act
		const course: Course = createCourse(courseData);

		// Assert
		expect(course).toBeDefined();
		expect(course.id).toBeDefined();
		expect(course.name).toBe(courseData.name);
		expect(course.ageGroup).toBe(courseData.ageGroup);
		expect(course.color).toBe(courseData.color);
		expect(course.description).toBe(courseData.description);
	});

	test("should fail to create course without required fields", () => {
		// Arrange
		const invalidCourseData = {
			name: "",
			ageGroup: "1-2 years",
			color: "#4CAF50",
		};

		// Act & Assert
		expect(() => createCourse(invalidCourseData)).toThrow(
			"Course name is required",
		);
	});

	test("should validate color format", () => {
		// Arrange
		const courseData = {
			name: "Test Course",
			ageGroup: "1-2 years",
			color: "invalid-color",
			description: "Test",
		};

		// Act & Assert
		expect(() => createCourse(courseData)).toThrow(
			"Color must be a valid hex color",
		);
	});
});

test.describe.serial("Course Database Operations - TDD", () => {
	test.beforeEach(() => {
		// Arrange - Initialize database and clean up for each test
		initializeDatabase();
		// Clean up all courses before each test
		const courses = CourseDB.getAll();
		for (const course of courses) {
			CourseDB.delete(course.id);
		}
	});

	test("should insert and retrieve course from database", () => {
		// Arrange
		const course = createCourse({
			name: "Pondělí dopoledne - Batolata",
			ageGroup: "1-2 years",
			color: "#4CAF50",
			description: "Cvičení pro batolata",
		});

		// Act
		CourseDB.insert(course);
		const retrieved = CourseDB.getById(course.id);

		// Assert
		expect(retrieved).toBeDefined();
		expect(retrieved.name).toBe(course.name);
		expect(retrieved.ageGroup).toBe(course.ageGroup);
		expect(retrieved.color).toBe(course.color);
	});

	test("should get all courses ordered by name", () => {
		// Arrange
		const course1 = createCourse({
			name: "Zebra Course",
			ageGroup: "1-2 years",
			color: "#FF0000",
		});
		const course2 = createCourse({
			name: "Alpha Course",
			ageGroup: "2-3 years",
			color: "#00FF00",
		});

		// Act
		CourseDB.insert(course1);
		CourseDB.insert(course2);
		const courses = CourseDB.getAll();

		// Assert
		expect(courses).toHaveLength(2);
		expect(courses[0].name).toBe("Alpha Course");
		expect(courses[1].name).toBe("Zebra Course");
	});

	test("should get courses by age group", () => {
		// Arrange
		const course1 = createCourse({
			name: "Course 1",
			ageGroup: "1-2 years",
			color: "#FF0000",
		});
		const course2 = createCourse({
			name: "Course 2",
			ageGroup: "2-3 years",
			color: "#00FF00",
		});
		const course3 = createCourse({
			name: "Course 3",
			ageGroup: "1-2 years",
			color: "#0000FF",
		});

		// Act
		CourseDB.insert(course1);
		CourseDB.insert(course2);
		CourseDB.insert(course3);
		const courses = CourseDB.getByAgeGroup("1-2 years");

		// Assert
		expect(courses).toHaveLength(2);
		expect(courses.every((c) => c.ageGroup === "1-2 years")).toBe(true);
	});

	test("should update course", () => {
		// Arrange
		const course = createCourse({
			name: "Original Name",
			ageGroup: "1-2 years",
			color: "#FF0000",
		});
		CourseDB.insert(course);

		// Act
		CourseDB.update(course.id, {
			name: "Updated Name",
			color: "#00FF00",
		});
		const updated = CourseDB.getById(course.id);

		// Assert
		expect(updated.name).toBe("Updated Name");
		expect(updated.color).toBe("#00FF00");
		expect(updated.ageGroup).toBe("1-2 years"); // Unchanged
	});

	test("should delete course", () => {
		// Arrange
		const course = createCourse({
			name: "To Delete",
			ageGroup: "1-2 years",
			color: "#FF0000",
		});
		CourseDB.insert(course);

		// Act
		CourseDB.delete(course.id);
		const deleted = CourseDB.getById(course.id);

		// Assert
		expect(deleted).toBeUndefined();
	});
});
