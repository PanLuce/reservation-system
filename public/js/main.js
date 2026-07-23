import { registerActions } from "./actions.js";
import { handleLogout, loadAgeGroups, loadCurrentUser } from "./auth.js";
import {
	calendarNextMonth,
	calendarPrevMonth,
	closeDayModal,
	closeDayModalDirect,
	loadCalendar,
	openDayModal,
	toggleDayLessonMembers,
} from "./calendar.js";
import {
	abortPendingTransfer,
	closeAddMomModal,
	closeAddMomModalDirect,
	hideAddCourseForm,
	hideAddProgramForm,
	loadCourses,
	showAddCourseForm,
	showAddProgramForm,
	submitAddMom,
	submitCourseForm,
	submitProgramForm,
} from "./courses.js";
import {
	closeEditLessonModal,
	closeEditLessonModalOnBackdrop,
	hideAddLessonForm,
	showAddLessonForm,
} from "./lessons.js";
import {
	resetOdsImport,
	submitOdsImport,
	uploadOdsForPreview,
} from "./ods-import.js";
import { loadParticipants } from "./participants.js";
import {
	loadMyReservations,
	selectParticipant,
	selfCancel,
	selfRegister,
} from "./reservations.js";
import { hideInfoModal } from "./utils.js";

// Closes any create/edit form or floating modal left open from a previous
// tab, so switching tabs never leaves stale edit state behind.
function resetAllOpenForms() {
	hideAddProgramForm();
	hideAddCourseForm();
	hideAddLessonForm();
	closeEditLessonModal();
	closeAddMomModalDirect();
	closeDayModalDirect();
	hideInfoModal();
	abortPendingTransfer();
	resetOdsImport();
}

// Tab switching
document.querySelectorAll(".tab").forEach((tab) => {
	tab.addEventListener("click", () => {
		const targetTab = tab.dataset.tab;

		resetAllOpenForms();

		// Update tabs
		document.querySelectorAll(".tab").forEach((t) => {
			t.classList.remove("active");
		});
		tab.classList.add("active");

		// Update content
		document.querySelectorAll(".tab-content").forEach((content) => {
			content.classList.remove("active");
		});
		document.getElementById(targetTab).classList.add("active");

		// Load data for specific tabs
		if (targetTab === "lessons") {
			loadCalendar();
		} else if (targetTab === "courses") {
			loadCourses();
		} else if (targetTab === "my-reservations") {
			loadMyReservations();
		} else if (targetTab === "participants") {
			loadParticipants();
		}
	});
});

function closeInfoModalOnBackdrop(el, event) {
	if (event.target === el) {
		hideInfoModal();
	}
}

// Initialize — load user first so calendar has state.currentUser.participantId for substitution fetch
document.addEventListener("DOMContentLoaded", async () => {
	await loadCurrentUser();
	loadCalendar();
	loadAgeGroups();
});

// ─── Static action registrations (public/index.html) ──────────────────────────
registerActions("click", {
	logout: handleLogout,
	"show-add-lesson-form": showAddLessonForm,
	"hide-add-lesson-form": hideAddLessonForm,
	"calendar-prev-month": calendarPrevMonth,
	"calendar-next-month": calendarNextMonth,
	"close-add-mom-modal-backdrop": closeAddMomModal,
	"close-add-mom-modal": closeAddMomModalDirect,
	"close-day-modal-backdrop": closeDayModal,
	"close-day-modal": closeDayModalDirect,
	"show-add-program-form": showAddProgramForm,
	"show-add-course-form": showAddCourseForm,
	"hide-add-program-form": hideAddProgramForm,
	"hide-add-course-form": hideAddCourseForm,
	"reset-ods-import": resetOdsImport,
	"submit-ods-import": submitOdsImport,
	"close-edit-lesson-modal-backdrop": closeEditLessonModalOnBackdrop,
	"close-edit-lesson-modal": closeEditLessonModal,
	"close-info-modal-backdrop": closeInfoModalOnBackdrop,
	"hide-info-modal": hideInfoModal,
});

registerActions("submit", {
	"add-mom": (_form, event) => submitAddMom(event),
	"submit-program-form": (_form, event) => submitProgramForm(event),
	"submit-course-form": (_form, event) => submitCourseForm(event),
	"upload-ods-preview": (_form, event) => uploadOdsForPreview(event),
});

// ─── Calendar / day modal / reservations action registrations ─────────────────
registerActions("click", {
	"open-day-modal": (el) => openDayModal(el.dataset.date),
	"self-register": (el) => selfRegister(el.dataset.id, el),
	"self-cancel": (el) => selfCancel(el.dataset.id, el),
	"toggle-day-lesson-members": (el) => toggleDayLessonMembers(el.dataset.id),
});

registerActions("change", {
	"select-participant": (el) => selectParticipant(el),
});
