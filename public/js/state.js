export const state = {
	currentUser: null,
	ageGroups: [],
	programsCache: [],
	allCoursesCache: [],
	selectedParticipantId: null,
};

export function getActiveParticipantId() {
	return state.selectedParticipantId;
}
