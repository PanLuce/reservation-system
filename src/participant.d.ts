export type Participant = {
    id: string;
    name: string;
    email: string;
    phone: string;
    ageGroup: string;
};
export type ParticipantInput = Omit<Participant, "id">;
export declare function createParticipant(input: ParticipantInput): Participant;
//# sourceMappingURL=participant.d.ts.map