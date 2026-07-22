import { registerActions } from "./actions.js";
import {
	closeDayModalDirect,
	loadCalendar,
	openDayModal,
	toggleDayLessonMembers,
} from "./calendar.js";
import { ensureCoursesCache } from "./courses.js";
import {
	API_URL,
	escapeHtml,
	hideInfoModal,
	showInfoModal,
	showNotification,
	withLoading,
} from "./utils.js";

export async function showAddLessonForm() {
	await populateLessonCourseSelect();
	document.getElementById("add-lesson-form").style.display = "block";
	document.getElementById("lessons-calendar-block").style.display = "none";
}

async function populateLessonCourseSelect() {
	try {
		const res = await fetch(`${API_URL}/courses`, { credentials: "include" });
		const courses = await res.json();
		const select = document.getElementById("lesson-course");
		select.innerHTML =
			'<option value="">-- Vyberte skupinku --</option>' +
			courses
				.map(
					(c) =>
						`<option value="${c.id}">[${c.ageGroup}] ${escapeHtml(c.name)}</option>`,
				)
				.join("");
	} catch (error) {
		console.error("Failed to load courses for lesson form", error);
	}
}

export function hideAddLessonForm() {
	document.getElementById("add-lesson-form").style.display = "none";
	document.querySelector("#add-lesson-form form").reset();
	document.getElementById("lessons-calendar-block").style.display = "";
}

// Add lesson (creates recurring lessons from startDate to endDate)
export async function addLesson(event) {
	event.preventDefault();
	const form = event.target;
	const formData = new FormData(form);

	const courseId = formData.get("courseId");
	const payload = {
		title: formData.get("title"),
		dayOfWeek: formData.get("dayOfWeek"),
		time: formData.get("time"),
		capacity: parseInt(formData.get("capacity"), 10),
		startDate: formData.get("startDate"),
		endDate: formData.get("endDate"),
	};

	await withLoading(event.submitter, async () => {
		try {
			const response = await fetch(
				`${API_URL}/courses/${courseId}/bulk-lessons`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify(payload),
				},
			);

			if (response.ok) {
				const data = await response.json();
				const enrolledSuffix = data.enrolled
					? `, přihlášeno ${data.enrolled} dětí`
					: "";
				showNotification(
					`Vytvořeno ${data.lessons.length} lekcí${enrolledSuffix}`,
				);
				hideAddLessonForm();
				loadCalendar();
			} else {
				const err = await response.json().catch(() => ({}));
				showNotification(err.error || "Chyba při přidávání lekcí", "error");
			}
		} catch (error) {
			showNotification("Chyba při přidávání lekcí", "error");
			console.error(error);
		}
	});
}

export async function deleteLesson(lessonId, triggerEl) {
	if (!confirm("Opravdu chcete smazat tuto lekci?")) {
		return;
	}

	await withLoading(triggerEl, async () => {
		try {
			const response = await fetch(`${API_URL}/lessons/${lessonId}`, {
				method: "DELETE",
			});

			if (response.ok) {
				showNotification("Lekce byla smazána");
				closeDayModalDirect();
				loadCalendar();
			} else {
				showNotification("Chyba při mazání lekce", "error");
			}
		} catch (error) {
			showNotification("Chyba při mazání lekce", "error");
			console.error(error);
		}
	});
}

let editingLessonDateStr = null;

export async function editLesson(lessonId) {
	const res = await fetch(`${API_URL}/lessons/${lessonId}`, {
		credentials: "include",
	});
	if (!res.ok) {
		showNotification("Nepodařilo se načíst lekci", "error");
		return;
	}
	const lesson = await res.json();
	editingLessonDateStr = lesson.date;
	document.getElementById("edit-lesson-id").value = lesson.id;
	document.getElementById("edit-lesson-title").value = lesson.title;
	document.getElementById("edit-lesson-time").value = lesson.time;
	document.getElementById("edit-lesson-capacity").value = lesson.capacity;
	document.getElementById("edit-lesson-modal").style.display = "flex";
}

export async function submitEditLesson(event) {
	event.preventDefault();
	const lessonId = document.getElementById("edit-lesson-id").value;
	const title = document.getElementById("edit-lesson-title").value.trim();
	const time = document.getElementById("edit-lesson-time").value;
	const capacity = Number(
		document.getElementById("edit-lesson-capacity").value,
	);

	try {
		const res = await fetch(`${API_URL}/lessons/${lessonId}`, {
			method: "PUT",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ title, time, capacity }),
		});
		if (!res.ok) {
			showNotification("Chyba při ukládání lekce", "error");
			return;
		}
		showNotification("Lekce byla uložena");
		closeEditLessonModal();
		await loadCalendar();
		if (editingLessonDateStr) {
			openDayModal(editingLessonDateStr);
		}
	} catch {
		showNotification("Chyba při ukládání lekce", "error");
	}
}

export function closeEditLessonModal() {
	document.getElementById("edit-lesson-modal").style.display = "none";
}

export function closeEditLessonModalOnBackdrop(el, event) {
	if (event.target === el) closeEditLessonModal();
}

// Cross-skupinka participant picker
let lessonPickerParticipantsCache = [];

export async function openLessonParticipantPicker(lessonId) {
	await ensureCoursesCache();
	let allParticipants;
	try {
		const res = await fetch(`${API_URL}/admin/participants`, {
			credentials: "include",
		});
		if (!res.ok) throw new Error();
		allParticipants = await res.json();
	} catch {
		showNotification("Nepodařilo se načíst účastníky", "error");
		return;
	}

	if (allParticipants.length === 0) {
		showInfoModal("Přidat dítě", "<p>Žádní účastníci k dispozici.</p>");
		return;
	}

	lessonPickerParticipantsCache = allParticipants;

	const listHtml = allParticipants
		.map((p) => {
			const skupinky =
				p.courses.map((c) => escapeHtml(c.name)).join(", ") || "—";
			return `<li style="padding:6px 0;border-bottom:1px solid #f0ebe3;display:flex;justify-content:space-between;align-items:center;">
				<span><strong>${escapeHtml(p.name)}</strong> <span style="color:#888;font-size:12px;">${escapeHtml(p.email)}</span><br><span style="font-size:12px;color:#aaa;">${skupinky}</span></span>
				<button class="btn btn-secondary" style="font-size:12px;padding:4px 10px;" data-action="confirm-add-participant-to-lesson" data-participant-id="${p.id}" data-lesson-id="${lessonId}">Přidat</button>
			</li>`;
		})
		.join("");

	document.getElementById("info-modal-title").textContent =
		"Přidat dítě na lekci";
	document.getElementById("info-modal-body").innerHTML =
		`<ul style="list-style:none;padding:0;margin:0;max-height:300px;overflow-y:auto;">${listHtml}</ul>`;
	document.getElementById("info-modal").style.display = "flex";
}

export function confirmAddParticipantToLesson(participantId, lessonId) {
	const participant = lessonPickerParticipantsCache.find(
		(p) => p.id === participantId,
	);
	const participantName = participant ? participant.name : "";
	const body = `
		<p style="margin-bottom:16px;">Přidat <strong>${escapeHtml(participantName)}</strong> na tuto lekci?</p>
		<div style="display:flex;gap:8px;">
			<button class="btn btn-primary" data-action="add-participant-to-lesson" data-participant-id="${participantId}" data-lesson-id="${lessonId}">Přidat</button>
			<button class="btn btn-secondary" data-action="open-lesson-participant-picker" data-id="${lessonId}">Zpět</button>
		</div>`;
	document.getElementById("info-modal-title").textContent = "Potvrdit přidání";
	document.getElementById("info-modal-body").innerHTML = body;
}

export async function addParticipantToLesson(participantId, lessonId) {
	hideInfoModal();
	try {
		const pRes = await fetch(`${API_URL}/admin/participants`, {
			credentials: "include",
		});
		const all = await pRes.json();
		const p = all.find((x) => x.id === participantId);
		if (!p) {
			showNotification("Účastník nenalezen", "error");
			return;
		}
		const res = await fetch(`${API_URL}/registrations`, {
			method: "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				lessonId,
				participant: {
					id: p.id,
					name: p.name,
					email: p.email,
					phone: p.phone ?? "",
					ageGroup: p.ageGroup,
				},
			}),
		});
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			showNotification(err.error || "Chyba při přidávání", "error");
			return;
		}
		showNotification("Dítě přidáno na lekci");
		const membersContainer = document.getElementById(
			`day-lesson-members-${lessonId}`,
		);
		if (membersContainer) {
			const list = membersContainer.querySelector("ul");
			if (list) list.remove();
			membersContainer.querySelector("span").textContent =
				"👶 Načíst účastníky ▾";
			toggleDayLessonMembers(lessonId);
		}
	} catch {
		showNotification("Chyba při přidávání", "error");
	}
}

registerActions("click", {
	"edit-lesson": (el) => editLesson(el.dataset.id),
	"delete-lesson": (el) => deleteLesson(el.dataset.id, el),
	"open-lesson-participant-picker": (el) =>
		openLessonParticipantPicker(el.dataset.id),
	"confirm-add-participant-to-lesson": (el) =>
		confirmAddParticipantToLesson(
			el.dataset.participantId,
			el.dataset.lessonId,
		),
	"add-participant-to-lesson": (el) =>
		addParticipantToLesson(el.dataset.participantId, el.dataset.lessonId),
});

registerActions("submit", {
	"add-lesson": (_form, event) => addLesson(event),
	"submit-edit-lesson": (_form, event) => submitEditLesson(event),
});
