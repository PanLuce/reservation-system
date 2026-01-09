export class LessonCalendar {
    lessons = [];
    addLesson(lesson) {
        this.lessons.push(lesson);
    }
    getAllLessons() {
        return [...this.lessons];
    }
    getLessonsByDay(day) {
        return this.lessons.filter((lesson) => lesson.dayOfWeek === day);
    }
    getLessonById(id) {
        return this.lessons.find((lesson) => lesson.id === id);
    }
    updateLesson(id, updates) {
        const lesson = this.lessons.find((l) => l.id === id);
        if (lesson) {
            Object.assign(lesson, updates);
        }
    }
    bulkUpdateLessons(filter, updates) {
        let updateCount = 0;
        for (const lesson of this.lessons) {
            if (this.matchesFilter(lesson, filter)) {
                Object.assign(lesson, updates);
                updateCount++;
            }
        }
        return updateCount;
    }
    bulkDeleteLessons(filter) {
        const initialLength = this.lessons.length;
        this.lessons = this.lessons.filter((lesson) => !this.matchesFilter(lesson, filter));
        return initialLength - this.lessons.length;
    }
    matchesFilter(lesson, filter) {
        for (const key in filter) {
            if (lesson[key] !== filter[key]) {
                return false;
            }
        }
        return true;
    }
}
//# sourceMappingURL=calendar.js.map