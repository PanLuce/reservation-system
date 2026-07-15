const API_URL = `${window.location.origin}/api`;

function localDateString(date = new Date()) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// ─── Event delegation dispatcher ───────────────────────────────────────────────
// Replaces inline onclick=/onchange=/onsubmit= attributes so the CSP can drop
// script-src-attr 'unsafe-inline'. Elements opt in via data-action/data-change/
// data-submit; handlers receive (el, event) where el is the matched element.
const clickActions = {};
const changeActions = {};
const submitActions = {};

function registerActions(kind, map) {
	Object.assign(
		{ click: clickActions, change: changeActions, submit: submitActions }[kind],
		map,
	);
}

document.addEventListener("click", (event) => {
	const el = event.target.closest("[data-action]");
	if (!el) return;
	const fn = clickActions[el.dataset.action];
	if (fn) fn(el, event);
	else if (el.dataset.action !== "none") {
		console.error(`Unregistered action: ${el.dataset.action}`);
	}
});

document.addEventListener("change", (event) => {
	const el = event.target.closest("[data-change]");
	if (!el) return;
	const fn = changeActions[el.dataset.change];
	if (fn) fn(el, event);
	else console.error(`Unregistered change action: ${el.dataset.change}`);
});

document.addEventListener("submit", (event) => {
	const form = event.target.closest("form[data-submit]");
	if (!form) return;
	const fn = submitActions[form.dataset.submit];
	if (fn) fn(form, event);
	else console.error(`Unregistered submit action: ${form.dataset.submit}`);
});

// Current user state
let currentUser = null;

// Load current user on page load
async function loadCurrentUser() {
	try {
		const response = await fetch(`${API_URL}/auth/me`, {
			credentials: "include",
		});

		if (!response.ok) {
			window.location.href = "/login.html";
			return;
		}

		const data = await response.json();
		currentUser = data.user;

		// Update UI with user info
		document.getElementById("user-name").textContent = currentUser.name;
		const roleEl = document.getElementById("user-role");
		roleEl.textContent =
			currentUser.role === "admin" ? "👑 Admin" : "👤 Účastník";
		roleEl.className = `role-badge role-badge--${currentUser.role === "admin" ? "admin" : "participant"}`;

		if (currentUser.role !== "admin") {
			hideAdminFeatures();
		} else {
			hideParticipantFeatures();
		}
	} catch (error) {
		console.error("Failed to load user:", error);
		window.location.href = "/login.html";
	}
}

// Hide admin-only features and show participant-only features
function hideAdminFeatures() {
	document.querySelectorAll(".admin-only").forEach((el) => {
		el.classList.add("hidden");
	});

	document.querySelectorAll(".participant-only").forEach((el) => {
		el.classList.remove("hidden");
	});
}

// Hide participant-only features (for admin view)
function hideParticipantFeatures() {
	document.querySelectorAll(".participant-only").forEach((el) => {
		el.classList.add("hidden");
	});
}

// Logout function
async function handleLogout() {
	try {
		await fetch(`${API_URL}/auth/logout`, {
			method: "POST",
			credentials: "include",
		});
		window.location.href = "/login.html";
	} catch (error) {
		console.error("Logout failed:", error);
		// Redirect anyway
		window.location.href = "/login.html";
	}
}

// Disable button + show spinner for the duration of an async operation.
async function withLoading(triggerEl, asyncFn) {
	if (!triggerEl) return asyncFn();
	const originalText = triggerEl.innerHTML;
	triggerEl.disabled = true;
	triggerEl.innerHTML = `${originalText}<span class="spinner"></span>`;
	try {
		return await asyncFn();
	} finally {
		triggerEl.disabled = false;
		triggerEl.innerHTML = originalText;
	}
}

// Age groups cache
let ageGroups = [];

async function loadAgeGroups() {
	try {
		const res = await fetch(`${API_URL}/age-groups`, {
			credentials: "include",
		});
		ageGroups = await res.json();
		populateAgeGroupSelect(document.getElementById("course-age-group"));
		populateAgeGroupSelect(document.getElementById("lesson-age-group"));
		populateAgeGroupSelect(document.getElementById("program-age-group"));
	} catch (e) {
		console.error("Failed to load age groups", e);
	}
}

function populateAgeGroupSelect(selectEl) {
	if (!selectEl) return;
	const current = selectEl.value;
	selectEl.innerHTML =
		'<option value="">-- Věková skupina --</option>' +
		ageGroups
			.map((g) => `<option value="${g.name}">${g.name}</option>`)
			.join("");
	if (current) selectEl.value = current;
}

function populateProgramSelect(selectEl) {
	if (!selectEl) return;
	const current = selectEl.value;
	selectEl.innerHTML =
		'<option value="">-- Bez kurzu --</option>' +
		programsCache
			.map(
				(k) =>
					`<option value="${k.id}">${escapeHtml(k.name)} (${k.ageGroup})</option>`,
			)
			.join("");
	selectEl.value = current;
}

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

// ─── Info Modal ───────────────────────────────────────────────────────────────

function showInfoModal(title, htmlBody) {
	document.getElementById("info-modal-title").textContent = title;
	document.getElementById("info-modal-body").innerHTML = htmlBody;
	document.getElementById("info-modal").style.display = "flex";
}

function hideInfoModal() {
	document.getElementById("info-modal").style.display = "none";
}

function closeInfoModalOnBackdrop(el, event) {
	if (event.target === el) {
		hideInfoModal();
	}
}

// Show notification
function showNotification(message, type = "success") {
	const notification = document.getElementById("notification");
	notification.textContent = message;
	notification.className = `notification ${type} show`;

	setTimeout(() => {
		notification.classList.remove("show");
	}, 3000);
}

// ─── Calendar state ───────────────────────────────────────────────────────────

let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth(); // 0-indexed
let calendarLessons = []; // cached from last fetch
let calendarSubCandidateIds = new Set(); // lessonIds eligible for substitution
let calendarMyRegisteredIds = new Set(); // lessonIds the current participant is confirmed/registered for
let calendarCreditCount = 0; // active substitution credits for current participant

const CZECH_MONTHS = [
	"Leden",
	"Únor",
	"Březen",
	"Duben",
	"Květen",
	"Červen",
	"Červenec",
	"Srpen",
	"Září",
	"Říjen",
	"Listopad",
	"Prosinec",
];
const CZECH_DAYS_SHORT = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

async function loadCalendar() {
	try {
		const lessonsPromise = fetch(`${API_URL}/lessons`, {
			credentials: "include",
		}).then((r) => r.json());

		const pId = currentUser?.participantId;
		const subPromise = pId
			? fetch(`${API_URL}/participants/${pId}/substitution-candidates`, {
					credentials: "include",
				})
					.then((r) => (r.ok ? r.json() : []))
					.catch(() => [])
			: Promise.resolve([]);
		const registrationsPromise = pId
			? fetch(`${API_URL}/participants/${pId}/registrations`, {
					credentials: "include",
				})
					.then((r) => (r.ok ? r.json() : []))
					.catch(() => [])
			: Promise.resolve([]);
		const creditPromise = pId
			? fetch(`${API_URL}/participants/${pId}/credits`, {
					credentials: "include",
				})
					.then((r) => (r.ok ? r.json() : { count: 0 }))
					.catch(() => ({ count: 0 }))
			: Promise.resolve({ count: 0 });

		const [lessons, subCandidates, registrations, creditData] =
			await Promise.all([
				lessonsPromise,
				subPromise,
				registrationsPromise,
				creditPromise,
			]);
		calendarLessons = lessons;
		calendarSubCandidateIds = new Set(subCandidates.map((l) => l.id));
		calendarMyRegisteredIds = new Set(
			registrations
				.filter((r) => r.status !== "cancelled")
				.map((r) => r.lessonId),
		);
		calendarCreditCount = creditData.count ?? 0;

		renderMonthCalendar(calendarYear, calendarMonth);
	} catch (error) {
		showNotification("Chyba při načítání lekcí", "error");
		console.error(error);
	}
}

function calendarPrevMonth() {
	calendarMonth--;
	if (calendarMonth < 0) {
		calendarMonth = 11;
		calendarYear--;
	}
	renderMonthCalendar(calendarYear, calendarMonth);
}

function calendarNextMonth() {
	calendarMonth++;
	if (calendarMonth > 11) {
		calendarMonth = 0;
		calendarYear++;
	}
	renderMonthCalendar(calendarYear, calendarMonth);
}

function escapeHtml(str) {
	return String(str ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function lessonPillTooltip(lesson) {
	const name = lesson.courseName || lesson.title;
	const time = lesson.time || "";
	const capacity = `${lesson.enrolledCount ?? 0}/${lesson.capacity ?? "?"}`;
	return `${name} • ${time} • ${capacity} obsazeno`;
}

function getLessonTileIcon(lesson, isParticipant) {
	if (!isParticipant) {
		const color = lesson.courseColor || "#B3E5FC";
		const tooltip = escapeHtml(lessonPillTooltip(lesson));
		return { pill: true, color, tooltip };
	}
	if (calendarMyRegisteredIds.has(lesson.id)) {
		return { icon: "❤️", label: `Moje lekce: ${escapeHtml(lesson.title)}` };
	}
	const isFull = lesson.enrolledCount >= lesson.capacity;
	if (isFull) {
		return { icon: "🚫", label: `Plná lekce: ${escapeHtml(lesson.title)}` };
	}
	if (calendarSubCandidateIds.has(lesson.id)) {
		return {
			icon: "✨",
			label: `Možná náhrada: ${escapeHtml(lesson.title)}`,
		};
	}
	return null;
}

function renderMonthCalendar(year, month) {
	document.getElementById("calendar-month-label").textContent =
		`${CZECH_MONTHS[month]} ${year}`;

	const byDate = {};
	for (const l of calendarLessons) {
		if (!byDate[l.date]) byDate[l.date] = [];
		byDate[l.date].push(l);
	}

	const firstDay = new Date(year, month, 1);
	const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const todayStr = localDateString();

	let html = CZECH_DAYS_SHORT.map(
		(d) => `<div class="calendar-day-header">${d}</div>`,
	).join("");

	for (let i = 0; i < startOffset; i++) {
		html += `<div class="calendar-day other-month"></div>`;
	}

	for (let day = 1; day <= daysInMonth; day++) {
		const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
		const isToday = dateStr === todayStr;
		const lessons = byDate[dateStr] || [];

		const MAX_ICONS = 4;
		const isParticipant = currentUser && currentUser.role !== "admin";
		const hasMine =
			isParticipant && lessons.some((l) => calendarMyRegisteredIds.has(l.id));
		const hasSub =
			isParticipant &&
			!hasMine &&
			lessons.some(
				(l) =>
					calendarSubCandidateIds.has(l.id) &&
					(l.enrolledCount ?? 0) < (l.capacity ?? 0),
			);
		const icons = lessons
			.slice(0, MAX_ICONS)
			.map((l) => {
				const badge = getLessonTileIcon(l, isParticipant);
				if (!badge) return "";
				if (badge.pill) {
					return `<span class="calendar-pill" style="background:${badge.color};" title="${badge.tooltip}"></span>`;
				}
				return `<span class="calendar-icon" title="${badge.label}">${badge.icon}</span>`;
			})
			.filter(Boolean)
			.join("");
		const overflow =
			lessons.length > MAX_ICONS
				? `<span class="calendar-dot-overflow">+${lessons.length - MAX_ICONS}</span>`
				: "";

		html += `
			<div class="calendar-day${isToday ? " today" : ""}${hasSub ? " has-substitution" : ""}" onclick="openDayModal('${dateStr}')">
				<div class="calendar-day-number">${day}</div>
				<div class="calendar-icons">${icons}${overflow}</div>
			</div>`;
	}

	const totalCells = startOffset + daysInMonth;
	const trailingCells = (7 - (totalCells % 7)) % 7;
	for (let i = 0; i < trailingCells; i++) {
		html += `<div class="calendar-day other-month"></div>`;
	}

	document.getElementById("calendar-grid").innerHTML = html;
}

function openDayModal(dateStr) {
	const lessons = calendarLessons.filter((l) => l.date === dateStr);
	const [year, month, day] = dateStr.split("-");
	document.getElementById("day-modal-title").textContent =
		`${parseInt(day, 10)}. ${parseInt(month, 10)}. ${year}`;
	document.getElementById("day-modal-body").innerHTML = renderDayLessons(
		lessons,
		dateStr,
	);
	document.getElementById("day-modal").style.display = "flex";
}

function renderDayLessons(lessons, dateStr) {
	if (lessons.length === 0) {
		return '<p style="color:#999;text-align:center;padding:20px;">Žádné lekce tento den.</p>';
	}
	const isAdmin = currentUser && currentUser.role === "admin";
	const todayStr = localDateString();
	const canCancel = dateStr > todayStr;

	return lessons
		.map((l) => {
			const fillPercent = Math.min(100, (l.enrolledCount / l.capacity) * 100);
			const isFull = l.enrolledCount >= l.capacity;
			const colorDot = l.courseColor
				? `<span class="calendar-dot" style="background:${l.courseColor};width:12px;height:12px;"></span>`
				: "";

			let actions;
			if (isAdmin) {
				actions = `<button class="btn btn-secondary" onclick="editLesson('${l.id}')">Upravit</button>
				<button class="btn btn-danger" onclick="deleteLesson('${l.id}', this)">Smazat</button>`;
			} else if (calendarSubCandidateIds.has(l.id)) {
				const noCredit = calendarCreditCount <= 0;
				let subDisabled = "";
				if (!canCancel) {
					subDisabled = `disabled title="Nelze se přihlásit jako náhrada po půlnoci před lekcí"`;
				} else if (noCredit) {
					subDisabled = `disabled title="Potřebujete náhradu (aktuálně 0 kreditů)"`;
				}
				actions = `<button class="btn btn-primary" onclick="selfRegister('${l.id}', this)"
				${subDisabled}>
				Přihlásit jako náhrada
			</button>`;
			} else {
				actions = `<button class="btn btn-danger" onclick="selfCancel('${l.id}', this)"
				${canCancel ? "" : "disabled title='Nelze odhlásit po půlnoci před lekcí'"}>
				Odhlásit
			</button>`;
			}

			const participantsBlock = isAdmin
				? `<div id="day-lesson-members-${l.id}" style="margin:6px 0 2px;">
					<span style="font-size:13px;cursor:pointer;color:#555;" onclick="toggleDayLessonMembers('${l.id}')">👶 Načíst účastníky ▾</span>
					<button class="btn btn-secondary" style="font-size:11px;padding:3px 8px;margin-left:8px;" onclick="openLessonParticipantPicker('${l.id}')">+ Přidat dítě</button>
				</div>`
				: "";

			return `
			<div class="day-lesson-row">
				<div class="day-lesson-title">
					${colorDot}
					${escapeHtml(l.title)}
					${l.courseName ? `<span style="font-size:0.8rem;font-weight:400;color:#888;">(${escapeHtml(l.courseName)})</span>` : ""}
				</div>
				<div class="day-lesson-meta">
					<span>🕐 ${escapeHtml(l.time)}</span>
					<span>📍 ${escapeHtml(l.location)}</span>
					<span>👶 ${l.ageGroup}</span>
					<span>👥 ${l.enrolledCount}/${l.capacity}</span>
				</div>
				<div class="capacity-bar" style="margin:8px 0;">
					<div class="capacity-bar-track">
						<div class="capacity-bar-fill ${isFull ? "full" : ""}" style="width:${fillPercent}%"></div>
					</div>
				</div>
				${participantsBlock}
				<div class="day-lesson-actions">${actions}</div>
			</div>`;
		})
		.join("");
}

function closeDayModal(el, event) {
	if (event.target === el) {
		document.getElementById("day-modal").style.display = "none";
	}
}

function closeDayModalDirect() {
	document.getElementById("day-modal").style.display = "none";
}

// Translate day names
function translateDay(day) {
	const days = {
		Monday: "Pondělí",
		Tuesday: "Úterý",
		Wednesday: "Středa",
		Thursday: "Čtvrtek",
		Friday: "Pátek",
	};
	return days[day] || day;
}

// Show/hide add lesson form
async function showAddLessonForm() {
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

function hideAddLessonForm() {
	document.getElementById("add-lesson-form").style.display = "none";
	document.querySelector("#add-lesson-form form").reset();
	document.getElementById("lessons-calendar-block").style.display = "";
}

// Add lesson (creates recurring lessons from startDate to endDate)
async function addLesson(event) {
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

// Delete lesson
async function deleteLesson(lessonId, triggerEl) {
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

// Edit lesson
let editingLessonDateStr = null;

async function editLesson(lessonId) {
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

async function submitEditLesson(event) {
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

function closeEditLessonModal() {
	document.getElementById("edit-lesson-modal").style.display = "none";
}

function closeEditLessonModalOnBackdrop(el, event) {
	if (event.target === el) closeEditLessonModal();
}

// Cross-skupinka participant picker
let lessonPickerParticipantsCache = [];

async function openLessonParticipantPicker(lessonId) {
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
				<button class="btn btn-secondary" style="font-size:12px;padding:4px 10px;" onclick="confirmAddParticipantToLesson('${p.id}','${lessonId}')">Přidat</button>
			</li>`;
		})
		.join("");

	document.getElementById("info-modal-title").textContent =
		"Přidat dítě na lekci";
	document.getElementById("info-modal-body").innerHTML =
		`<ul style="list-style:none;padding:0;margin:0;max-height:300px;overflow-y:auto;">${listHtml}</ul>`;
	document.getElementById("info-modal").style.display = "flex";
}

function confirmAddParticipantToLesson(participantId, lessonId) {
	const participant = lessonPickerParticipantsCache.find(
		(p) => p.id === participantId,
	);
	const participantName = participant ? participant.name : "";
	const body = `
		<p style="margin-bottom:16px;">Přidat <strong>${escapeHtml(participantName)}</strong> na tuto lekci?</p>
		<div style="display:flex;gap:8px;">
			<button class="btn btn-primary" onclick="addParticipantToLesson('${participantId}','${lessonId}')">Přidat</button>
			<button class="btn btn-secondary" onclick="openLessonParticipantPicker('${lessonId}')">Zpět</button>
		</div>`;
	document.getElementById("info-modal-title").textContent = "Potvrdit přidání";
	document.getElementById("info-modal-body").innerHTML = body;
}

async function addParticipantToLesson(participantId, lessonId) {
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

// Initialize — load user first so calendar has currentUser.participantId for substitution fetch
document.addEventListener("DOMContentLoaded", async () => {
	await loadCurrentUser();
	loadCalendar();
	loadAgeGroups();
});

// ─── Skupinky (Courses) ───────────────────────────────────────────────────────

// Cache of all programs (populated in loadPrograms; used for grouping + the course form select)
let programsCache = [];

async function loadPrograms() {
	try {
		const res = await fetch(`${API_URL}/programs`, { credentials: "include" });
		if (!res.ok) throw new Error(`Failed to load programs: ${res.status}`);
		const programs = await res.json();
		if (!Array.isArray(programs)) throw new Error("Invalid programs response");
		programsCache = programs;
	} catch (error) {
		programsCache = [];
		console.error(error);
	}
}

async function loadCourses() {
	try {
		await loadPrograms();
		const res = await fetch(`${API_URL}/courses`, { credentials: "include" });
		if (!res.ok) throw new Error(`Failed to load courses: ${res.status}`);
		const courses = await res.json();
		if (!Array.isArray(courses)) throw new Error("Invalid courses response");
		allCoursesCache = courses;
		populateProgramSelect(document.getElementById("course-program"));
		const container = document.getElementById("courses-list");

		if (courses.length === 0 && programsCache.length === 0) {
			container.innerHTML =
				'<p style="text-align:center;color:#999;padding:40px;">Žádné skupinky. Přidejte první skupinku!</p>';
			return;
		}

		container.innerHTML = renderCoursesGroupedByProgram(courses);
		for (const course of courses) {
			loadCourseMembers(course.id);
		}
	} catch (error) {
		showNotification("Chyba při načítání skupinek", "error");
		console.error(error);
	}
}

function renderCoursesGroupedByProgram(courses) {
	const isAdmin = currentUser && currentUser.role === "admin";
	const sections = programsCache.map((program) => {
		const members = courses.filter((c) => c.programId === program.id);
		return renderProgramSection(program, members, isAdmin);
	});

	const unassigned = courses.filter(
		(c) => !c.programId || !programsCache.some((k) => k.id === c.programId),
	);
	if (unassigned.length > 0) {
		sections.push(renderUnassignedSection(unassigned));
	}

	return sections.join("");
}

function renderProgramSection(program, members, isAdmin) {
	const cards = members.length
		? members.map(renderCourseCard).join("")
		: '<p style="color:#aaa;font-size:13px;padding:8px 0;">Zatím žádné skupinky v tomto kurzu.</p>';
	const adminActions = isAdmin
		? `<span class="program-actions">
				<button class="btn btn-secondary" onclick="editProgram('${program.id}')">Upravit kurz</button>
				<button class="btn btn-danger" onclick="deleteProgram('${program.id}', this)">Smazat kurz</button>
			</span>`
		: "";
	return `
		<section class="program-section" data-program-id="${program.id}">
			<div class="program-header">
				<span class="color-swatch" style="background:${program.color}"></span>
				<h3 style="margin:0">${escapeHtml(program.name)}</h3>
				<span style="color:#888;font-size:13px;">${program.ageGroup}</span>
				${adminActions}
			</div>
			<div class="lessons-grid">${cards}</div>
		</section>`;
}

function renderUnassignedSection(courses) {
	return `
		<section class="program-section" data-program-id="none">
			<div class="program-header">
				<h3 style="margin:0">Bez kurzu</h3>
			</div>
			<div class="lessons-grid">${courses.map(renderCourseCard).join("")}</div>
		</section>`;
}

function renderCourseCard(course) {
	const isAdmin = currentUser && currentUser.role === "admin";
	return `
		<div class="lesson-card" id="course-card-${course.id}">
			<div class="course-card-header">
				<span class="color-swatch" style="background:${course.color}"></span>
				<h3 style="margin:0">${escapeHtml(course.name)}</h3>
			</div>
			<div class="lesson-info">
				<div class="lesson-info-item">
					<strong>👶 Věk:</strong> ${course.ageGroup}
				</div>
				${course.location ? `<div class="lesson-info-item"><strong>📍</strong> ${escapeHtml(course.location)}</div>` : ""}
			</div>
			<div class="course-members" id="course-members-${course.id}">
				<span style="color:#aaa;font-size:13px;">Načítám maminky…</span>
			</div>
			${
				isAdmin
					? `
			<div class="lesson-actions">
				<button class="btn btn-primary" onclick="showAddMomModal('${course.id}')">+ Přidat dítě</button>
				<button class="btn btn-secondary" onclick="editCourse('${course.id}')">Upravit</button>
				<button class="btn btn-danger" onclick="deleteCourse('${course.id}', this)">Smazat</button>
			</div>`
					: ""
			}
		</div>`;
}

// Cache of all courses (populated in loadCourses; used for transfer dropdowns)
let allCoursesCache = [];

async function ensureCoursesCache() {
	if (allCoursesCache.length > 0) return;
	try {
		const res = await fetch(`${API_URL}/courses`, { credentials: "include" });
		if (res.ok) {
			const courses = await res.json();
			if (Array.isArray(courses)) allCoursesCache = courses;
		}
	} catch {
		// Cache stays empty; dropdowns will have no options
	}
}

async function loadCourseMembers(courseId) {
	try {
		const res = await fetch(`${API_URL}/courses/${courseId}/participants`, {
			credentials: "include",
		});
		if (!res.ok) return;
		const members = await res.json();
		const container = document.getElementById(`course-members-${courseId}`);
		if (!container) return;
		if (members.length === 0) {
			container.innerHTML =
				'<span style="color:#aaa;font-size:13px;">Žádné maminky</span>';
			return;
		}
		const count = members.length;
		const suffix = count === 1 ? "a" : count < 5 ? "y" : "";
		const summary = `<span style="font-size:13px;cursor:pointer;color:#555;" onclick="toggleMembersList('${courseId}')">👩 ${count} mamink${suffix} ▾</span>`;
		const listItems = members.map((m) => renderMemberRow(m, courseId)).join("");
		container.innerHTML = `${summary}<ul id="course-members-list-${courseId}" style="display:none;margin:4px 0 0 0;padding-left:16px;list-style:disc;">${listItems}</ul>`;
	} catch {
		// silently ignore — members list is non-critical
	}
}

function renderTransferDropdown(participantId, fromCourseId) {
	const current = allCoursesCache.find((c) => c.id === fromCourseId);
	const others = allCoursesCache.filter((c) => c.id !== fromCourseId);
	if (!current && others.length === 0) return "";
	const courseLabel = (c) =>
		c.location
			? `${escapeHtml(c.name)} (${c.ageGroup}, ${escapeHtml(c.location)})`
			: `${escapeHtml(c.name)} (${c.ageGroup})`;
	const currentOpt = current
		? `<option value="${current.id}" selected>${courseLabel(current)}</option>`
		: "";
	const otherOpts = others
		.map((c) => `<option value="${c.id}">${courseLabel(c)}</option>`)
		.join("");
	return `<select class="transfer-select" onclick="event.stopPropagation()" onchange="initiateTransferWithConfirm('${participantId}', '${fromCourseId}', this)">${currentOpt}${otherOpts}</select>`;
}

function renderMemberRow(m, currentCourseId) {
	const remaining =
		m.remainingLessons !== undefined
			? ` · <span style="color:#888;">zbývá ${m.remainingLessons} lekcí</span>`
			: "";
	return `<li style="font-size:12px;color:#444;margin-bottom:4px;">
		<span style="cursor:pointer;text-decoration:underline;color:#534445;" onclick="openParticipantDetail('${m.id}')">${escapeHtml(m.name)}</span>
		<span style="color:#999;">${escapeHtml(m.email)}</span>${remaining}
		${renderTransferDropdown(m.id, currentCourseId)}
	</li>`;
}

function toggleMembersList(courseId) {
	const list = document.getElementById(`course-members-list-${courseId}`);
	if (list)
		list.style.display = list.style.display === "none" ? "block" : "none";
}

function initiateTransferWithConfirm(participantId, fromCourseId, selectEl) {
	const toCourseId = selectEl.value;
	if (!toCourseId || toCourseId === fromCourseId) {
		selectEl.value = fromCourseId;
		return;
	}
	const fromName =
		allCoursesCache.find((c) => c.id === fromCourseId)?.name ?? fromCourseId;
	const toName =
		allCoursesCache.find((c) => c.id === toCourseId)?.name ?? toCourseId;
	const body = `
		<p style="margin-bottom:16px;">Přesunout dítě ze skupinky <strong>${escapeHtml(fromName)}</strong> do skupinky <strong>${escapeHtml(toName)}</strong>?</p>
		<div style="display:flex;gap:8px;flex-wrap:wrap;">
			<button class="btn btn-primary" onclick="hideInfoModal();initiateTransfer('${participantId}','${fromCourseId}',document.querySelector('[data-transfer-select-id=\\'${participantId}-${fromCourseId}\\']'))">Přesunout</button>
			<button class="btn btn-secondary" onclick="hideInfoModal();document.querySelector('[data-transfer-select-id=\\'${participantId}-${fromCourseId}\\']').value='${fromCourseId}'">Zrušit</button>
		</div>`;
	selectEl.setAttribute(
		"data-transfer-select-id",
		`${participantId}-${fromCourseId}`,
	);
	selectEl.dataset.pendingToCourseId = toCourseId;
	document.getElementById("info-modal-title").textContent = "Přesunout dítě";
	document.getElementById("info-modal-body").innerHTML = body;
	document.getElementById("info-modal").style.display = "flex";
}

async function initiateTransfer(participantId, fromCourseId, selectEl) {
	const toCourseId = selectEl
		? selectEl.dataset.pendingToCourseId || selectEl.value
		: null;
	if (!toCourseId) return;
	selectEl.value = "";

	try {
		const res = await fetch(
			`${API_URL}/admin/participants/${participantId}/transfer-course`,
			{
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fromCourseId, toCourseId }),
			},
		);
		if (!res.ok) {
			showNotification("Chyba při přesunu", "error");
			return;
		}
		const data = await res.json();

		if (!data.conflict) {
			await executeTransfer(
				participantId,
				fromCourseId,
				toCourseId,
				data.futureInNew,
			);
			return;
		}

		showTransferMismatchModal(
			participantId,
			fromCourseId,
			toCourseId,
			data.remainingInOld,
			data.futureInNew,
		);
	} catch {
		showNotification("Chyba při přesunu", "error");
	}
}

function showTransferMismatchModal(
	participantId,
	fromCourseId,
	toCourseId,
	remainingInOld,
	futureInNew,
) {
	const body = `
		<p style="margin-bottom:16px;">Dítě má <strong>${remainingInOld}</strong> zbývajících lekcí v aktuální skupince,
		ale nová skupinka má <strong>${futureInNew}</strong> budoucích lekcí.</p>
		<p style="margin-bottom:20px;color:#666;font-size:13px;">Na kolik lekcí nové skupinky ji chcete zaregistrovat?</p>
		<div style="display:flex;gap:8px;flex-wrap:wrap;">
			<button class="btn btn-primary" onclick="confirmTransfer('${participantId}','${fromCourseId}','${toCourseId}',${remainingInOld})">
				Registrovat na prvních ${remainingInOld}
			</button>
			<button class="btn btn-secondary" onclick="confirmTransfer('${participantId}','${fromCourseId}','${toCourseId}',${futureInNew})">
				Registrovat na všech ${futureInNew}
			</button>
			<button class="btn btn-danger" onclick="hideInfoModal()">Zrušit</button>
		</div>`;
	document.getElementById("info-modal-title").textContent =
		"Nesoulad počtu lekcí";
	document.getElementById("info-modal-body").innerHTML = body;
	document.getElementById("info-modal").style.display = "flex";
}

async function confirmTransfer(
	participantId,
	fromCourseId,
	toCourseId,
	registerCount,
) {
	hideInfoModal();
	await executeTransfer(participantId, fromCourseId, toCourseId, registerCount);
}

async function executeTransfer(
	participantId,
	fromCourseId,
	toCourseId,
	registerCount,
) {
	try {
		const res = await fetch(
			`${API_URL}/admin/participants/${participantId}/transfer-course`,
			{
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fromCourseId, toCourseId, registerCount }),
			},
		);
		if (!res.ok) {
			showNotification("Přesun se nezdařil", "error");
			return;
		}
		showNotification("Dítě bylo přesunuto");
		loadCourses();
		if (document.getElementById("participants-list")) {
			loadParticipants();
		}
	} catch {
		showNotification("Přesun se nezdařil", "error");
	}
}

function showAddCourseForm() {
	document.getElementById("course-form-title").textContent = "Nová skupinka";
	document.getElementById("course-edit-id").value = "";
	document.getElementById("course-name").value = "";
	document.getElementById("course-age-group").value = "";
	document.getElementById("course-location").value = "";
	populateProgramSelect(document.getElementById("course-program"));
	document.getElementById("course-program").value = "";
	clearCourseErrors();
	document.getElementById("add-course-form").style.display = "block";
}

function hideAddCourseForm() {
	document.getElementById("add-course-form").style.display = "none";
	clearCourseErrors();
}

async function editCourse(id) {
	try {
		const res = await fetch(`${API_URL}/courses/${id}`, {
			credentials: "include",
		});
		const course = await res.json();
		document.getElementById("course-form-title").textContent =
			"Upravit skupinku";
		document.getElementById("course-edit-id").value = course.id;
		document.getElementById("course-name").value = course.name;
		document.getElementById("course-age-group").value = course.ageGroup;
		document.getElementById("course-location").value = course.location || "";
		populateProgramSelect(document.getElementById("course-program"));
		document.getElementById("course-program").value = course.programId || "";
		clearCourseErrors();
		document.getElementById("add-course-form").style.display = "block";
		document.getElementById("add-course-form").scrollIntoView({
			behavior: "smooth",
		});
	} catch (error) {
		showNotification("Chyba při načítání skupinky", "error");
	}
}

async function submitCourseForm(event) {
	event.preventDefault();
	clearCourseErrors();

	const id = document.getElementById("course-edit-id").value;
	const name = document.getElementById("course-name").value.trim();
	const ageGroup = document.getElementById("course-age-group").value;
	const location = document.getElementById("course-location").value.trim();
	const programId = document.getElementById("course-program").value || null;

	let hasError = false;
	if (!name) {
		document.getElementById("course-name-error").textContent =
			"Název je povinný";
		hasError = true;
	}
	if (!location) {
		document.getElementById("course-location-error").textContent =
			"Místo je povinné";
		hasError = true;
	}
	if (hasError) return;

	await withLoading(event.submitter, async () => {
		try {
			const url = id ? `${API_URL}/courses/${id}` : `${API_URL}/courses`;
			const method = id ? "PUT" : "POST";
			const res = await fetch(url, {
				method,
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ name, ageGroup, location, programId }),
			});

			if (!res.ok) {
				const data = await res.json();
				showNotification(data.error || "Chyba při ukládání", "error");
				return;
			}

			hideAddCourseForm();
			showNotification(
				id ? "Skupinka byla upravena" : "Skupinka byla přidána",
				"success",
			);
			loadCourses();
		} catch (error) {
			showNotification("Chyba při ukládání skupinky", "error");
			console.error(error);
		}
	});
}

async function deleteCourse(id, triggerEl) {
	if (!confirm("Opravdu smazat tuto skupinku?")) return;
	await withLoading(triggerEl, async () => {
		try {
			const res = await fetch(`${API_URL}/courses/${id}`, {
				method: "DELETE",
				credentials: "include",
			});
			if (!res.ok) {
				const data = await res.json();
				showNotification(data.error || "Chyba při mazání", "error");
				return;
			}
			showNotification("Skupinka byla smazána", "success");
			loadCourses();
		} catch (error) {
			showNotification("Chyba při mazání skupinky", "error");
			console.error(error);
		}
	});
}

function clearCourseErrors() {
	document.getElementById("course-name-error").textContent = "";
	document.getElementById("course-location-error").textContent = "";
}

// ─── Programs / Kurzy (parent grouping of Skupinky) ───────────────────────────

function showAddProgramForm() {
	document.getElementById("program-form-title").textContent = "Nový kurz";
	document.getElementById("program-edit-id").value = "";
	document.getElementById("program-name").value = "";
	document.getElementById("program-age-group").value = "";
	document.getElementById("program-name-error").textContent = "";
	document.getElementById("add-program-form").style.display = "block";
}

function hideAddProgramForm() {
	document.getElementById("add-program-form").style.display = "none";
	document.getElementById("program-name-error").textContent = "";
}

async function editProgram(id) {
	try {
		const res = await fetch(`${API_URL}/programs/${id}`, {
			credentials: "include",
		});
		const program = await res.json();
		document.getElementById("program-form-title").textContent = "Upravit kurz";
		document.getElementById("program-edit-id").value = program.id;
		document.getElementById("program-name").value = program.name;
		document.getElementById("program-age-group").value = program.ageGroup;
		document.getElementById("program-name-error").textContent = "";
		document.getElementById("add-program-form").style.display = "block";
		document.getElementById("add-program-form").scrollIntoView({
			behavior: "smooth",
		});
	} catch (error) {
		showNotification("Chyba při načítání kurzu", "error");
		console.error(error);
	}
}

async function submitProgramForm(event) {
	event.preventDefault();
	document.getElementById("program-name-error").textContent = "";

	const id = document.getElementById("program-edit-id").value;
	const name = document.getElementById("program-name").value.trim();
	const ageGroup = document.getElementById("program-age-group").value;

	if (!name) {
		document.getElementById("program-name-error").textContent =
			"Název je povinný";
		return;
	}

	await withLoading(event.submitter, async () => {
		try {
			const url = id ? `${API_URL}/programs/${id}` : `${API_URL}/programs`;
			const method = id ? "PUT" : "POST";
			const res = await fetch(url, {
				method,
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ name, ageGroup }),
			});

			if (!res.ok) {
				const data = await res.json();
				showNotification(data.error || "Chyba při ukládání", "error");
				return;
			}

			hideAddProgramForm();
			showNotification(id ? "Kurz byl upraven" : "Kurz byl přidán", "success");
			loadCourses();
		} catch (error) {
			showNotification("Chyba při ukládání kurzu", "error");
			console.error(error);
		}
	});
}

async function deleteProgram(id, triggerEl) {
	if (
		!confirm(
			"Opravdu smazat tento kurz? Skupinky v něm zůstanou zachovány, jen ztratí zařazení.",
		)
	)
		return;
	await withLoading(triggerEl, async () => {
		try {
			const res = await fetch(`${API_URL}/programs/${id}`, {
				method: "DELETE",
				credentials: "include",
			});
			if (!res.ok) {
				const data = await res.json();
				showNotification(data.error || "Chyba při mazání", "error");
				return;
			}
			showNotification("Kurz byl smazán", "success");
			loadCourses();
		} catch (error) {
			showNotification("Chyba při mazání kurzu", "error");
			console.error(error);
		}
	});
}

// ─── Moje rezervace (Participant self-service) ────────────────────────────────

async function loadMyReservations() {
	if (!currentUser?.participantId) return;
	const pId = currentUser.participantId;

	await Promise.all([
		loadMyLessons(pId),
		loadSubstitutionCandidates(pId),
		loadCreditCount(pId),
	]);
}

async function loadCreditCount(participantId) {
	try {
		const res = await fetch(
			`${API_URL}/participants/${participantId}/credits`,
			{
				credentials: "include",
			},
		);
		if (!res.ok) return;
		const data = await res.json();
		const el = document.getElementById("nahrad-count");
		if (el) {
			el.textContent =
				data.count > 0 ? `Náhrady: ${data.count}` : "Žádné aktivní náhrady";
		}
	} catch {
		// non-fatal
	}
}

async function loadMyLessons(participantId) {
	try {
		const res = await fetch(
			`${API_URL}/participants/${participantId}/registrations`,
			{ credentials: "include" },
		);
		const registrations = await res.json();

		const container = document.getElementById("my-lessons-list");
		const now = localDateString();

		const upcoming = registrations.filter(
			(r) => r.lessonDate >= now && r.status !== "cancelled",
		);

		if (upcoming.length === 0) {
			container.innerHTML =
				'<p style="text-align:center;color:#999;padding:20px;">Žádné nadcházející lekce.</p>';
			return;
		}

		container.innerHTML = upcoming
			.map((r) => {
				const canCancel = r.lessonDate > now;
				return `
			<div class="lesson-card">
				<h3>${escapeHtml(r.lessonTitle || "Lekce")}</h3>
				<div class="lesson-info">
					<div class="lesson-info-item"><strong>📅 Datum:</strong> ${r.lessonDate}</div>
					<div class="lesson-info-item"><strong>🕐 Čas:</strong> ${escapeHtml(r.lessonTime || "")}</div>
					<div class="lesson-info-item"><strong>📍 Místo:</strong> ${escapeHtml(r.lessonLocation || "")}</div>
					<div class="lesson-info-item"><strong>👥 Obsazeno:</strong> ${r.lessonEnrolledCount}/${r.lessonCapacity}</div>
				</div>
				<div class="lesson-actions">
					<button class="btn btn-danger" onclick="selfCancel('${r.id}', this)"
						${canCancel ? "" : "disabled title='Nelze odhlásit po půlnoci před lekcí'"}>
						Odhlásit
					</button>
				</div>
			</div>`;
			})
			.join("");
	} catch (error) {
		showNotification("Chyba při načítání rezervací", "error");
		console.error(error);
	}
}

async function selfCancel(registrationId, triggerEl) {
	if (!currentUser?.participantId) return;
	if (!confirm("Odhlásit se z této lekce?")) return;

	const pId = currentUser.participantId;
	await withLoading(triggerEl, async () => {
		try {
			const res = await fetch(
				`${API_URL}/participants/${pId}/cancel-registration`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({ registrationId }),
				},
			);
			if (res.ok) {
				showNotification("Odhlášení proběhlo úspěšně");
				loadMyReservations();
			} else {
				const data = await res.json();
				showNotification(data.error || "Nelze se odhlásit", "error");
			}
		} catch (error) {
			showNotification("Chyba při odhlašování", "error");
			console.error(error);
		}
	});
}

async function loadSubstitutionCandidates(participantId) {
	try {
		const res = await fetch(
			`${API_URL}/participants/${participantId}/substitution-candidates`,
			{ credentials: "include" },
		);
		const lessons = await res.json();

		const container = document.getElementById("substitution-candidates-list");

		if (lessons.length === 0) {
			container.innerHTML =
				'<p style="text-align:center;color:#999;padding:20px;">Žádné dostupné náhrady.</p>';
			return;
		}

		const todayStr = localDateString();
		container.innerHTML = lessons
			.map(
				(l) => `
			<div class="lesson-card">
				<h3>${escapeHtml(l.title)}</h3>
				<div class="lesson-info">
					<div class="lesson-info-item"><strong>📅 Datum:</strong> ${l.date}</div>
					<div class="lesson-info-item"><strong>🕐 Čas:</strong> ${escapeHtml(l.time)}</div>
					<div class="lesson-info-item"><strong>📍 Místo:</strong> ${escapeHtml(l.location)}</div>
					<div class="lesson-info-item"><strong>👥 Volná místa:</strong> ${l.capacity - l.enrolledCount}</div>
				</div>
				<div class="lesson-actions">
					<button class="btn btn-primary" onclick="selfRegister('${l.id}', this)"
						${l.date > todayStr ? "" : "disabled title='Nelze se přihlásit jako náhrada po půlnoci před lekcí'"}>
						Přihlásit jako náhrada
					</button>
				</div>
			</div>`,
			)
			.join("");
	} catch (error) {
		showNotification("Chyba při načítání náhrad", "error");
		console.error(error);
	}
}

// ─── ODS three-step importer ─────────────────────────────────────────────────

let odsParsed = { sheets: [] };
let odsSelectedSheetIndex = null;

async function uploadOdsForPreview(event) {
	event.preventDefault();
	const fileInput = document.getElementById("ods-file-input");
	if (!fileInput.files || fileInput.files.length === 0) return;

	const formData = new FormData();
	formData.append("file", fileInput.files[0]);

	await withLoading(event.submitter, async () => {
		try {
			const res = await fetch(`${API_URL}/admin/participants-import/preview`, {
				method: "POST",
				credentials: "include",
				body: formData,
			});

			if (!res.ok) {
				showNotification("Chyba při nahrávání souboru", "error");
				return;
			}

			const data = await res.json();
			odsParsed = { sheets: data.sheets || [] };
			odsSelectedSheetIndex = null;
			renderOdsSheetPicker();
			document.getElementById("ods-step-sheet").style.display = "block";
			document.getElementById("ods-step2").style.display = "none";
			document
				.getElementById("ods-step-sheet")
				.scrollIntoView({ behavior: "smooth" });
		} catch (error) {
			showNotification("Chyba při nahrávání souboru", "error");
			console.error(error);
		}
	});
}

function renderOdsSheetPicker() {
	const list = document.getElementById("ods-sheet-list");
	list.innerHTML = odsParsed.sheets
		.map((s, i) => {
			const location = s.detectedLocation
				? ` — ${escapeHtml(s.detectedLocation)}`
				: "";
			const count = s.candidates.length;
			return `<button type="button" class="btn btn-secondary" data-sheet-index="${i}"
				style="display:block;margin-bottom:8px;text-align:left;width:100%;"
				onclick="selectOdsSheet(${i})">
				${escapeHtml(s.sheetName)}${location}
				<span style="font-size:12px;color:#888;margin-left:8px;">(${count} kandidát${count === 1 ? "" : "i/ů"})</span>
			</button>`;
		})
		.join("");
}

function selectOdsSheet(index) {
	odsSelectedSheetIndex = index;
	renderOdsPreview();
	document.getElementById("ods-step2").style.display = "block";
	document.getElementById("ods-step2").scrollIntoView({ behavior: "smooth" });
}

async function renderOdsPreview() {
	const container = document.getElementById("ods-blocks-container");
	const candidates =
		odsSelectedSheetIndex !== null
			? odsParsed.sheets[odsSelectedSheetIndex]?.candidates || []
			: [];

	// Load existing skupinky for the dropdown
	let courses = [];
	try {
		const res = await fetch(`${API_URL}/courses`, { credentials: "include" });
		courses = await res.json();
	} catch {}

	const courseOptions = courses
		.map(
			(c) =>
				`<option value="${c.id}">[${c.ageGroup}] ${escapeHtml(c.name)}</option>`,
		)
		.join("");

	if (candidates.length === 0) {
		container.innerHTML = "<p>Žádní kandidáti nenalezeni.</p>";
		return;
	}

	const rows = candidates
		.map(
			(c, i) => `
		<tr>
			<td style="padding:6px 4px;"><input type="checkbox" id="ods-candidate-${i}" checked></td>
			<td style="padding:6px 4px;"><input type="text" id="ods-kidname-${i}" value="${escapeHtml(c.kidName)}" style="font-size:13px;width:100%;border:1px solid #ddd;border-radius:4px;padding:2px 6px;"></td>
			<td style="padding:6px 4px;"><input type="email" id="ods-email-${i}" value="${escapeHtml(c.parentEmail)}" style="font-size:13px;width:100%;border:1px solid #ddd;border-radius:4px;padding:2px 6px;"></td>
		</tr>`,
		)
		.join("");

	container.innerHTML = `
		<div class="form-group" style="margin-bottom:12px;">
			<label style="font-weight:bold;">Přiřadit do skupinky:</label>
			<select id="ods-target-course" style="font-size:13px;margin-top:4px;" required>
				<option value="">-- Vyberte skupinku --</option>
				${courseOptions}
			</select>
		</div>
		<div style="margin-bottom:8px;font-size:13px;color:#555;">
			<label><input type="checkbox" id="ods-select-all" checked onchange="toggleAllCandidates(this.checked)"> Vybrat vše</label>
		</div>
		<div style="overflow-x:auto;">
			<table style="width:100%;border-collapse:collapse;font-size:13px;">
				<thead>
					<tr style="background:#f5f5f5;">
						<th style="padding:6px 4px;text-align:left;width:32px;"></th>
						<th style="padding:6px 4px;text-align:left;">Jméno dítěte</th>
						<th style="padding:6px 4px;text-align:left;">Email rodiče</th>
					</tr>
				</thead>
				<tbody>${rows}</tbody>
			</table>
		</div>`;
}

function toggleAllCandidates(checked) {
	const sheet =
		odsSelectedSheetIndex !== null
			? odsParsed.sheets[odsSelectedSheetIndex]?.candidates || []
			: [];
	sheet.forEach((_, i) => {
		const el = document.getElementById(`ods-candidate-${i}`);
		if (el) el.checked = checked;
	});
}

async function submitOdsImport(triggerEl) {
	const courseId = document.getElementById("ods-target-course")?.value;
	if (!courseId) {
		showNotification("Vyberte skupinku", "error");
		return;
	}

	const sheetCandidates =
		odsSelectedSheetIndex !== null
			? odsParsed.sheets[odsSelectedSheetIndex]?.candidates || []
			: [];

	const candidates = sheetCandidates
		.map((_, i) => {
			const checked = document.getElementById(`ods-candidate-${i}`)?.checked;
			if (!checked) return null;
			const kidName = document
				.getElementById(`ods-kidname-${i}`)
				?.value?.trim();
			const parentEmail = document
				.getElementById(`ods-email-${i}`)
				?.value?.trim();
			if (!parentEmail) return null;
			return { kidName: kidName || parentEmail, parentEmail };
		})
		.filter(Boolean);

	if (candidates.length === 0) {
		showNotification("Vyberte alespoň jednoho kandidáta", "error");
		return;
	}

	await withLoading(triggerEl, async () => {
		try {
			const res = await fetch(`${API_URL}/admin/participants-import/commit`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ courseId, candidates }),
			});

			const data = await res.json();
			const resultsEl = document.getElementById("ods-commit-results");

			if (res.ok) {
				const summary = `✅ Importováno: ${data.processed}, nových: ${data.created}, přeskočeno: ${data.skipped}`;
				if (resultsEl)
					resultsEl.innerHTML = `<div class="info-box" style="margin-top:12px;">${summary}</div>`;
				showInfoModal("Import dokončen", `<p>${summary}</p>`);
				showNotification(
					`Import dokončen: ${data.processed} účastník(ů)`,
					"success",
				);
				loadCourses();
				loadCalendar();
			} else {
				showNotification(data.error || "Chyba při importu", "error");
			}
		} catch (error) {
			showNotification("Chyba při importu", "error");
			console.error(error);
		}
	});
}

function resetOdsImport() {
	odsParsed = { sheets: [] };
	odsSelectedSheetIndex = null;
	document.getElementById("ods-step-sheet").style.display = "none";
	document.getElementById("ods-sheet-list").innerHTML = "";
	document.getElementById("ods-step2").style.display = "none";
	document.getElementById("ods-blocks-container").innerHTML = "";
	document.getElementById("ods-commit-results").innerHTML = "";
	document.getElementById("ods-file-input").value = "";
}

// ─── Add Mom to Course modal ──────────────────────────────────────────────────

function showAddMomModal(courseId) {
	document.getElementById("add-mom-course-id").value = courseId;
	document.getElementById("add-mom-name").value = "";
	document.getElementById("add-mom-email").value = "";
	document.getElementById("add-mom-phone").value = "";
	document.getElementById("add-mom-modal").style.display = "flex";
}

function closeAddMomModal(el, event) {
	if (event.target === el) {
		document.getElementById("add-mom-modal").style.display = "none";
	}
}

function closeAddMomModalDirect() {
	document.getElementById("add-mom-modal").style.display = "none";
}

async function submitAddMom(event) {
	event.preventDefault();
	const courseId = document.getElementById("add-mom-course-id").value;
	const name = document.getElementById("add-mom-name").value.trim();
	const email = document.getElementById("add-mom-email").value.trim();
	const phone = document.getElementById("add-mom-phone").value.trim();

	await withLoading(event.submitter, async () => {
		try {
			const res = await fetch(`${API_URL}/courses/${courseId}/participants`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ name, email, ...(phone ? { phone } : {}) }),
			});

			if (res.ok) {
				const data = await res.json();
				showNotification(
					data.created
						? "Dítě přidáno a přihlášeno na lekce"
						: "Dítě již existuje — přihlášeno na lekce",
					"success",
				);
				closeAddMomModalDirect();
				loadCourses();
				loadCalendar();
			} else {
				const data = await res.json();
				showNotification(data.error || "Chyba při přidávání dítěte", "error");
			}
		} catch (error) {
			showNotification("Chyba při přidávání dítěte", "error");
			console.error(error);
		}
	});
}

async function selfRegister(lessonId, triggerEl) {
	if (!currentUser?.participantId) return;
	const pId = currentUser.participantId;

	await withLoading(triggerEl, async () => {
		try {
			const res = await fetch(
				`${API_URL}/participants/${pId}/register-lesson`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({ lessonId }),
				},
			);
			if (res.ok) {
				showNotification("Přihlášení proběhlo úspěšně");
				closeDayModalDirect();
				loadCalendar();
				loadMyReservations();
			} else {
				const data = await res.json();
				showNotification(data.error || "Nelze se přihlásit", "error");
			}
		} catch (error) {
			showNotification("Chyba při přihlašování", "error");
			console.error(error);
		}
	});
}

// ─── Day-lesson participant list ──────────────────────────────────────────────

async function toggleDayLessonMembers(lessonId) {
	const container = document.getElementById(`day-lesson-members-${lessonId}`);
	if (!container) return;

	const existingList = container.querySelector("ul");
	if (existingList) {
		existingList.style.display =
			existingList.style.display === "none" ? "block" : "none";
		return;
	}

	container.querySelector("span").textContent = "Načítám…";

	try {
		const res = await fetch(`${API_URL}/lessons/${lessonId}/participants`, {
			credentials: "include",
		});
		if (!res.ok) {
			container.querySelector("span").textContent = "Nepodařilo se načíst";
			return;
		}
		const members = await res.json();

		if (members.length === 0) {
			container.innerHTML =
				'<span style="font-size:13px;color:#aaa;">Žádní účastníci</span>';
			return;
		}

		const count = members.length;
		const summary = `<span style="font-size:13px;cursor:pointer;color:#555;" onclick="toggleDayLessonMembers('${lessonId}')">👩 ${count} účastník${count === 1 ? "" : "ů"} ▾</span>`;
		const listHtml = members
			.map(
				(m) => `<li style="font-size:12px;color:#444;margin-bottom:2px;">
					<span style="cursor:pointer;text-decoration:underline;color:#534445;" onclick="openParticipantDetail('${m.id}')">${escapeHtml(m.name)}</span>
					<span style="color:#999;">${escapeHtml(m.email)}</span>
					${m.remainingLessons !== undefined ? ` · <span style="color:#888;">zbývá ${m.remainingLessons} lekcí</span>` : ""}
				</li>`,
			)
			.join("");
		container.innerHTML = `${summary}<ul style="margin:4px 0 0 0;padding-left:16px;list-style:disc;">${listHtml}</ul>`;
	} catch {
		container.querySelector("span").textContent = "Chyba při načítání";
	}
}

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
			return `<tr style="border-bottom:1px solid #f0ebe3;cursor:pointer;" onclick="openParticipantDetail('${p.id}')">
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
				<th style="padding:8px;text-align:left;cursor:pointer;user-select:none;" onclick="sortParticipants('name')">Jméno${indicator("name")}</th>
				<th style="padding:8px;text-align:left;cursor:pointer;user-select:none;" onclick="sortParticipants('email')">Email${indicator("email")}</th>
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
	"add-lesson": (_form, event) => addLesson(event),
	"add-mom": (_form, event) => submitAddMom(event),
	"submit-program-form": (_form, event) => submitProgramForm(event),
	"submit-course-form": (_form, event) => submitCourseForm(event),
	"upload-ods-preview": (_form, event) => uploadOdsForPreview(event),
	"submit-edit-lesson": (_form, event) => submitEditLesson(event),
});
