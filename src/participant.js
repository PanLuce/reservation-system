export function createParticipant(input) {
    return {
        id: generateId(),
        ...input,
    };
}
function generateId() {
    return `participant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
//# sourceMappingURL=participant.js.map