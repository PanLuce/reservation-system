import { expect, test } from "@playwright/test";
import { createLesson } from "../src/lesson.js";

test.describe("Lesson Management", () => {
	test("should create a lesson with valid data", () => {
		// Arrange
		const lessonInput = {
			title: "Cvičení pro maminky s dětmi",
			dayOfWeek: "Monday",
			time: "10:00",
			location: "CVČ Vietnamská",
			ageGroup: "3-12 months",
			capacity: 10,
		};

		// Act
		const lesson = createLesson(lessonInput);

		// Assert
		expect(lesson).toBeDefined();
		expect(lesson.id).toBeDefined();
		expect(lesson.title).toBe("Cvičení pro maminky s dětmi");
		expect(lesson.dayOfWeek).toBe("Monday");
		expect(lesson.time).toBe("10:00");
		expect(lesson.location).toBe("CVČ Vietnamská");
		expect(lesson.ageGroup).toBe("3-12 months");
		expect(lesson.capacity).toBe(10);
		expect(lesson.enrolledCount).toBe(0);
	});
});
