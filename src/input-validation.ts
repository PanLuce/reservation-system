const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: unknown): email is string {
	return typeof email === "string" && EMAIL_PATTERN.test(email);
}

export function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

export function validateParticipantInput(participant: {
	name?: unknown;
	email?: unknown;
}): string | null {
	if (!isNonEmptyString(participant.name)) {
		return "Participant name is required";
	}
	if (!isValidEmail(participant.email)) {
		return "A valid participant email is required";
	}
	return null;
}
