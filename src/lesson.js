export function createLesson(input) {
    return {
        id: generateId(),
        ...input,
        enrolledCount: 0,
    };
}
function generateId() {
    return `lesson_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
//# sourceMappingURL=lesson.js.map