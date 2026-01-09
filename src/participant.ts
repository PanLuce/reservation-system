export type Participant = {
	id: string;
	name: string;
	email: string;
	phone: string;
	ageGroup: string;
};

export type ParticipantInput = Omit<Participant, "id">;

export function createParticipant(input: ParticipantInput): Participant {
	return {
		id: generateId(),
		...input,
	};
}

function generateId(): string {
	return `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
