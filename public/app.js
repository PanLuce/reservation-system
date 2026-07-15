import { registerActions } from "./js/actions.js";
import { handleLogout, loadAgeGroups, loadCurrentUser } from "./js/auth.js";
import {
	calendarNextMonth,
	calendarPrevMonth,
	closeDayModal,
	closeDayModalDirect,
	loadCalendar,
	openDayModal,
	toggleDayLessonMembers,
} from "./js/calendar.js";
import {
	closeAddMomModal,
	closeAddMomModalDirect,
	ensureCoursesCache,
	hideAddCourseForm,
	hideAddProgramForm,
	loadCourses,
	renderTransferDropdown,
	showAddCourseForm,
	showAddProgramForm,
	submitAddMom,
	submitCourseForm,
	submitProgramForm,
} from "./js/courses.js";
import {
	closeEditLessonModal,
	closeEditLessonModalOnBackdrop,
	hideAddLessonForm,
	showAddLessonForm,
} from "./js/lessons.js";
import {
	resetOdsImport,
	submitOdsImport,
	uploadOdsForPreview,
} from "./js/ods-import.js";
import {
	loadMyReservations,
	selfCancel,
	selfRegister,
} from "./js/reservations.js";
import { API_URL, escapeHtml, hideInfoModal } from "./js/utils.js";

// User is loaded in DOMContentLoaded before calendar to ensure participantId is set

// Tab switching
document.querySelectorAll(".tab").forEach((tab) => {
	tab.addEventListener("click", () => {
		const targetTab = tab.dataset.tab;

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

// Courses.js dispatches this after a transfer changes a participant's course
// membership, so the Děti tab's table (if open) reflects the new assignment.
document.addEventListener("participants:refresh", () => {
	loadParticipants();
});

// ─── Děti tab ────────────────────────────────────────────────────────────────

let participantsCache = [];
let participantsSortKey = null;
let participantsSortDir = 1; // 1 = asc, -1 = desc

function renderParticipantsTable(participants) {
	const container = document.getElementById("participants-list");
	if (!container) return;

	if (participants.length === 0) {
		container.innerHTML =
			'<p style="text-align:center;color:#999;padding:40px;">Žádní účastníci.</p>';
		return;
	}

	const sorted = participantsSortKey
		? [...participants].sort((a, b) => {
				const av = (a[participantsSortKey] ?? "").toLowerCase();
				const bv = (b[participantsSortKey] ?? "").toLowerCase();
				return av.localeCompare(bv) * participantsSortDir;
			})
		: [...participants];

	const rows = sorted
		.map((p) => {
			const courseItems =
				p.courses.length > 0
					? p.courses
							.map(
								(c) =>
									`<li style="margin-bottom:2px;">${renderTransferDropdown(p.id, c.id)} <span style="color:#888;">zbývá ${c.remainingLessons} lekcí</span></li>`,
							)
							.join("")
					: '<li style="color:#aaa;">—</li>';
			return `<tr style="border-bottom:1px solid #f0ebe3;cursor:pointer;" data-action="open-participant-detail" data-id="${p.id}">
				<td style="padding:10px 8px;font-weight:500;">${escapeHtml(p.name)}</td>
				<td style="padding:10px 8px;color:#666;">${escapeHtml(p.email)}</td>
				<td style="padding:10px 8px;font-size:13px;"><ul style="list-style:none;padding:0;margin:0;">${courseItems}</ul></td>
			</tr>`;
		})
		.join("");

	const indicator = (key) =>
		key === participantsSortKey
			? participantsSortDir === 1
				? " ▲"
				: " ▼"
			: "";

	container.innerHTML = `<table style="width:100%;border-collapse:collapse;">
		<thead>
			<tr style="background:#faf7f4;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;color:#666;">
				<th style="padding:8px;text-align:left;cursor:pointer;user-select:none;" data-action="sort-participants" data-key="name">Jméno${indicator("name")}</th>
				<th style="padding:8px;text-align:left;cursor:pointer;user-select:none;" data-action="sort-participants" data-key="email">Email${indicator("email")}</th>
				<th style="padding:8px;text-align:left;">Skupinky</th>
			</tr>
		</thead>
		<tbody>${rows}</tbody>
	</table>`;
}

function sortParticipants(key) {
	if (participantsSortKey === key) {
		participantsSortDir *= -1;
	} else {
		participantsSortKey = key;
		participantsSortDir = 1;
	}
	renderParticipantsTable(participantsCache);
}

async function loadParticipants() {
	const container = document.getElementById("participants-list");
	if (!container) return;
	container.innerHTML =
		'<p style="color:#aaa;text-align:center;padding:20px;">Načítám…</p>';

	await ensureCoursesCache();

	try {
		const res = await fetch(`${API_URL}/admin/participants`, {
			credentials: "include",
		});
		if (!res.ok) throw new Error("Failed to load participants");
		participantsCache = await res.json();
		renderParticipantsTable(participantsCache);
	} catch (error) {
		container.innerHTML =
			'<p style="color:#dc3545;text-align:center;padding:20px;">Chyba při načítání.</p>';
		console.error(error);
	}
}

async function openParticipantDetail(participantId) {
	document.getElementById("participant-modal-title").textContent =
		"Detail dítěte";
	document.getElementById("participant-modal-body").innerHTML =
		'<p style="color:#aaa;">Načítám…</p>';
	document.getElementById("participant-modal").style.display = "flex";

	try {
		const res = await fetch(`${API_URL}/admin/participants`, {
			credentials: "include",
		});
		if (!res.ok) throw new Error("Failed");
		const all = await res.json();
		const p = all.find((x) => x.id === participantId);
		if (!p) {
			document.getElementById("participant-modal-body").innerHTML =
				"<p>Účastník nenalezen.</p>";
			return;
		}

		const courseRows = p.courses
			.map(
				(c) =>
					`<li style="margin-bottom:4px;">${escapeHtml(c.name)} <span style="color:#888;">(věk: ${c.ageGroup})</span> — zbývá <strong>${c.remainingLessons}</strong> lekcí</li>`,
			)
			.join("");

		document.getElementById("participant-modal-body").innerHTML = `
			<div style="margin-bottom:12px;">
				<strong>${escapeHtml(p.name)}</strong><br>
				<span style="color:#666;">${escapeHtml(p.email)}</span>
				${p.phone ? `<br><span style="color:#888;font-size:13px;">${escapeHtml(p.phone)}</span>` : ""}
			</div>
			<div style="margin-bottom:8px;font-size:13px;color:#666;">Věková skupina: ${p.ageGroup}</div>
			${courseRows.length > 0 ? `<h4 style="margin:12px 0 8px;font-weight:600;">Skupinky</h4><ul style="padding-left:16px;">${courseRows}</ul>` : "<p style='color:#aaa;'>Žádné skupinky.</p>"}
		`;
		document.getElementById("participant-modal-title").textContent = p.name;
	} catch {
		document.getElementById("participant-modal-body").innerHTML =
			"<p style='color:#dc3545;'>Chyba při načítání.</p>";
	}
}

function closeParticipantModal() {
	document.getElementById("participant-modal").style.display = "none";
}

function closeParticipantModalOnBackdrop(el, event) {
	if (event.target === el) {
		closeParticipantModal();
	}
}

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
	"close-participant-modal-backdrop": closeParticipantModalOnBackdrop,
	"close-participant-modal": closeParticipantModal,
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
	"open-participant-detail": (el) => openParticipantDetail(el.dataset.id),
	"sort-participants": (el) => sortParticipants(el.dataset.key),
});
