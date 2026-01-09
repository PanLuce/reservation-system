import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";
import { ExcelParticipantLoader } from "../src/excel-loader";

// Helper function to create Excel buffer from data
function createExcelBuffer(data: Record<string, unknown>[]): Buffer {
	const worksheet = XLSX.utils.json_to_sheet(data);
	const workbook = XLSX.utils.book_new();
	XLSX.utils.book_append_sheet(workbook, worksheet, "Participants");
	return Buffer.from(
		XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }),
	);
}

test.describe("Excel Participant Loader", () => {
	test("should parse participants from Excel buffer", () => {
		// Arrange
		const loader = new ExcelParticipantLoader();

		const data = [
			{
				name: "Jana Nováková",
				email: "jana@example.cz",
				phone: "+420777888999",
				ageGroup: "3-12 months",
			},
			{
				name: "Petr Svoboda",
				email: "petr@example.cz",
				phone: "+420666555444",
				ageGroup: "1-2 years",
			},
			{
				name: "Marie Dvořáková",
				email: "marie@example.cz",
				phone: "+420555444333",
				ageGroup: "2-3 years",
			},
		];

		const buffer = createExcelBuffer(data);

		// Act
		const participants = loader.parseParticipantsFromBuffer(buffer);

		// Assert
		expect(participants).toHaveLength(3);
		expect(participants[0].name).toBe("Jana Nováková");
		expect(participants[0].email).toBe("jana@example.cz");
		expect(participants[0].phone).toBe("+420777888999");
		expect(participants[0].ageGroup).toBe("3-12 months");

		expect(participants[1].name).toBe("Petr Svoboda");
		expect(participants[2].name).toBe("Marie Dvořáková");
	});

	test("should handle empty Excel file", () => {
		// Arrange
		const loader = new ExcelParticipantLoader();
		const buffer = createExcelBuffer([]);

		// Act
		const participants = loader.parseParticipantsFromBuffer(buffer);

		// Assert
		expect(participants).toHaveLength(0);
	});

	test("should skip invalid rows with missing required fields", () => {
		// Arrange
		const loader = new ExcelParticipantLoader();
		const data = [
			{
				name: "Jana Nováková",
				email: "jana@example.cz",
				phone: "+420777888999",
				ageGroup: "3-12 months",
			},
			{
				name: "",
				email: "missing-name@example.cz",
				phone: "+420666555444",
				ageGroup: "1-2 years",
			},
			{
				name: "Valid Person",
				email: "valid@example.cz",
				phone: "+420555444333",
				ageGroup: "2-3 years",
			},
		];

		const buffer = createExcelBuffer(data);

		// Act
		const participants = loader.parseParticipantsFromBuffer(buffer);

		// Assert
		expect(participants).toHaveLength(2); // Only 2 valid rows
		expect(participants[0].name).toBe("Jana Nováková");
		expect(participants[1].name).toBe("Valid Person");
	});
});
