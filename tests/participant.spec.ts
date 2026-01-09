import { expect, test } from "@playwright/test";
import { createParticipant } from "../src/participant";

test.describe("Participant Management", () => {
	test("should create a participant with valid data", () => {
		// Arrange
		const participantInput = {
			name: "Jana Nováková",
			email: "jana@example.cz",
			phone: "+420 777 888 999",
			ageGroup: "3-12 months",
		};

		// Act
		const participant = createParticipant(participantInput);

		// Assert
		expect(participant).toBeDefined();
		expect(participant.id).toBeDefined();
		expect(participant.name).toBe("Jana Nováková");
		expect(participant.email).toBe("jana@example.cz");
		expect(participant.phone).toBe("+420 777 888 999");
		expect(participant.ageGroup).toBe("3-12 months");
	});
});
