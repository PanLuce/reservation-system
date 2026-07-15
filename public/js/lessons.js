import { closeDayModalDirect, loadCalendar, openDayModal } from "./calendar.js";
import { API_URL, escapeHtml, showNotification, withLoading } from "./utils.js";

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
				showNotification(`Vytvořeno ${data.lessons.length} lekcí`);
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
