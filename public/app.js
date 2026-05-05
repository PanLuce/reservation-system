// ─── Global loading feedback ─────────────────────────────────────────────────

let inFlight = 0;
let globalProgressBar = null;

function updateBusy() {
	const busy = inFlight > 0;
	document.body.classList.toggle("is-busy", busy);
	if (globalProgressBar) globalProgressBar.hidden = !busy;
}

(function wrapFetch() {
	if (window.fetch.__wrapped) return;
	const _fetch = window.fetch;
	window.fetch = function (...args) {
		inFlight++;
		updateBusy();
		return _fetch.apply(this, args).finally(() => {
			inFlight--;
			updateBusy();
		});
	};
	window.fetch.__wrapped = true;
})();

const API_URL = `${window.location.origin}/api`;

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
		document.getElementById("user-role").textContent =
			currentUser.role === "admin" ? "👑 Admin" : "👤 Účastník";
		document.getElementById("user-role").style.background =
			currentUser.role === "admin" ? "#fff3cd" : "#e8f5e9";

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
	triggerEl.innerHTML = originalText + '<span class="spinner"></span>';
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

// Load user info on page load
loadCurrentUser();

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

function closeInfoModalOnBackdrop(event) {
	if (event.target === event.currentTarget) {
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
		return { icon: "❤️", label: `Moje lekce: ${lesson.title}` };
	}
	const isFull = lesson.enrolledCount >= lesson.capacity;
	if (isFull) {
		return { icon: "🚫", label: `Plná lekce: ${lesson.title}` };
	}
	if (calendarSubCandidateIds.has(lesson.id)) {
		return { icon: "✨", label: `Možná náhrada: ${lesson.title}` };
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
	const todayStr = new Date().toISOString().slice(0, 10);

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
			<div class="calendar-day${isToday ? " today" : ""}" onclick="openDayModal('${dateStr}')">
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
	const todayStr = new Date().toISOString().slice(0, 10);
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
				actions = `<button class="btn btn-danger" onclick="deleteLesson('${l.id}', this)">Smazat</button>`;
			} else if (calendarSubCandidateIds.has(l.id)) {
				const noCredit = calendarCreditCount <= 0;
				actions = `<button class="btn btn-primary" onclick="selfRegister('${l.id}', this)"
				${noCredit ? `disabled title="Potřebujete náhradu (aktuálně 0 kreditů)"` : ""}>
				Přihlásit jako náhrada
			</button>`;
			} else {
				actions = `<button class="btn btn-danger" onclick="selfCancel('${l.id}', this)"
				${canCancel ? "" : "disabled title='Nelze odhlásit po půlnoci před lekcí'"}>
				Odhlásit
			</button>`;
			}

			return `
			<div class="day-lesson-row">
				<div class="day-lesson-title">
					${colorDot}
					${l.title}
					${l.courseName ? `<span style="font-size:0.8rem;font-weight:400;color:#888;">(${l.courseName})</span>` : ""}
				</div>
				<div class="day-lesson-meta">
					<span>🕐 ${l.time}</span>
					<span>📍 ${l.location}</span>
					<span>👶 ${l.ageGroup}</span>
					<span>👥 ${l.enrolledCount}/${l.capacity}</span>
				</div>
				<div class="capacity-bar" style="margin:8px 0;">
					<div class="capacity-bar-track">
						<div class="capacity-bar-fill ${isFull ? "full" : ""}" style="width:${fillPercent}%"></div>
					</div>
				</div>
				<div class="day-lesson-actions">${actions}</div>
			</div>`;
		})
		.join("");
}

function closeDayModal(event) {
	if (event.target === document.getElementById("day-modal")) {
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
					(c) => `<option value="${c.id}">[${c.ageGroup}] ${c.name}</option>`,
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

// Initialize
document.addEventListener("DOMContentLoaded", () => {
	globalProgressBar = document.getElementById("global-progress");
	loadCalendar();
	loadAgeGroups();
});

// ─── Skupinky (Courses) ───────────────────────────────────────────────────────

async function loadCourses() {
	try {
		const res = await fetch(`${API_URL}/courses`, { credentials: "include" });
		if (!res.ok) throw new Error(`Failed to load courses: ${res.status}`);
		const courses = await res.json();
		if (!Array.isArray(courses)) throw new Error("Invalid courses response");
		const container = document.getElementById("courses-list");

		if (courses.length === 0) {
			container.innerHTML =
				'<p style="text-align:center;color:#999;padding:40px;">Žádné skupinky. Přidejte první skupinku!</p>';
			return;
		}

		container.innerHTML = courses.map(renderCourseCard).join("");
		for (const course of courses) {
			loadCourseMembers(course.id);
		}
	} catch (error) {
		showNotification("Chyba při načítání skupinek", "error");
		console.error(error);
	}
}

function renderCourseCard(course) {
	const isAdmin = currentUser && currentUser.role === "admin";
	return `
		<div class="lesson-card" id="course-card-${course.id}">
			<div class="course-card-header">
				<span class="color-swatch" style="background:${course.color}"></span>
				<h3 style="margin:0">${course.name}</h3>
			</div>
			<div class="lesson-info">
				<div class="lesson-info-item">
					<strong>👶 Věk:</strong> ${course.ageGroup}
				</div>
				${course.location ? `<div class="lesson-info-item"><strong>📍</strong> ${course.location}</div>` : ""}
			</div>
			<div class="course-members" id="course-members-${course.id}">
				<span style="color:#aaa;font-size:13px;">Načítám maminky…</span>
			</div>
			${
				isAdmin
					? `
			<div class="lesson-actions">
				<button class="btn btn-primary" onclick="showAddMomModal('${course.id}')">+ Přidat maminku</button>
				<button class="btn btn-secondary" onclick="editCourse('${course.id}')">Upravit</button>
				<button class="btn btn-danger" onclick="deleteCourse('${course.id}', this)">Smazat</button>
			</div>`
					: ""
			}
		</div>`;
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
		const summary = `<span style="font-size:13px;cursor:pointer;color:#555;" onclick="toggleMembersList('${courseId}')">👩 ${members.length} mamink${members.length === 1 ? "a" : members.length < 5 ? "y" : ""} ▾</span>`;
		const listItems = members
			.map(
				(m) =>
					`<li style="font-size:12px;color:#444;">${m.name} <span style="color:#999;">${m.email}</span></li>`,
			)
			.join("");
		container.innerHTML = `${summary}<ul id="course-members-list-${courseId}" style="display:none;margin:4px 0 0 0;padding-left:16px;list-style:disc;">${listItems}</ul>`;
	} catch {
		// silently ignore — members list is non-critical
	}
}

function toggleMembersList(courseId) {
	const list = document.getElementById(`course-members-list-${courseId}`);
	if (list)
		list.style.display = list.style.display === "none" ? "block" : "none";
}

function showAddCourseForm() {
	document.getElementById("course-form-title").textContent = "Nová skupinka";
	document.getElementById("course-edit-id").value = "";
	document.getElementById("course-name").value = "";
	document.getElementById("course-age-group").value = "";
	document.getElementById("course-location").value = "";
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
				body: JSON.stringify({ name, ageGroup, location }),
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

// ─── Moje rezervace (Participant self-service) ────────────────────────────────

async function loadMyReservations() {
	if (!currentUser || !currentUser.participantId) return;
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
		const now = new Date().toISOString().slice(0, 10);

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
				<h3>${r.lessonTitle || "Lekce"}</h3>
				<div class="lesson-info">
					<div class="lesson-info-item"><strong>📅 Datum:</strong> ${r.lessonDate}</div>
					<div class="lesson-info-item"><strong>🕐 Čas:</strong> ${r.lessonTime || ""}</div>
					<div class="lesson-info-item"><strong>📍 Místo:</strong> ${r.lessonLocation || ""}</div>
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
	if (!currentUser || !currentUser.participantId) return;
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

		container.innerHTML = lessons
			.map(
				(l) => `
			<div class="lesson-card">
				<h3>${l.title}</h3>
				<div class="lesson-info">
					<div class="lesson-info-item"><strong>📅 Datum:</strong> ${l.date}</div>
					<div class="lesson-info-item"><strong>🕐 Čas:</strong> ${l.time}</div>
					<div class="lesson-info-item"><strong>📍 Místo:</strong> ${l.location}</div>
					<div class="lesson-info-item"><strong>👥 Volná místa:</strong> ${l.capacity - l.enrolledCount}</div>
				</div>
				<div class="lesson-actions">
					<button class="btn btn-primary" onclick="selfRegister('${l.id}', this)">Přihlásit jako náhrada</button>
				</div>
			</div>`,
			)
			.join("");
	} catch (error) {
		showNotification("Chyba při načítání náhrad", "error");
		console.error(error);
	}
}

// ─── ODS two-step importer ────────────────────────────────────────────────────

let odsCandidates = [];

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
			odsCandidates = data.candidates || [];
			await renderOdsPreview();
			document.getElementById("ods-step2").style.display = "block";
			document
				.getElementById("ods-step2")
				.scrollIntoView({ behavior: "smooth" });
		} catch (error) {
			showNotification("Chyba při nahrávání souboru", "error");
			console.error(error);
		}
	});
}

async function renderOdsPreview() {
	const container = document.getElementById("ods-blocks-container");

	// Load existing skupinky for the dropdown
	let courses = [];
	try {
		const res = await fetch(`${API_URL}/courses`, { credentials: "include" });
		courses = await res.json();
	} catch {}

	const courseOptions = courses
		.map((c) => `<option value="${c.id}">[${c.ageGroup}] ${c.name}</option>`)
		.join("");

	if (odsCandidates.length === 0) {
		container.innerHTML = "<p>Žádní kandidáti nenalezeni.</p>";
		return;
	}

	const rows = odsCandidates
		.map(
			(c, i) => `
		<tr>
			<td style="padding:6px 4px;"><input type="checkbox" id="ods-candidate-${i}" checked></td>
			<td style="padding:6px 4px;"><input type="text" id="ods-kidname-${i}" value="${c.kidName}" style="font-size:13px;width:100%;border:1px solid #ddd;border-radius:4px;padding:2px 6px;"></td>
			<td style="padding:6px 4px;"><input type="email" id="ods-email-${i}" value="${c.parentEmail}" style="font-size:13px;width:100%;border:1px solid #ddd;border-radius:4px;padding:2px 6px;"></td>
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
	odsCandidates.forEach((_, i) => {
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

	const candidates = odsCandidates
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
	odsCandidates = [];
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

function closeAddMomModal(event) {
	if (event.target === document.getElementById("add-mom-modal")) {
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
						? "Maminka přidána a přihlášena na lekce"
						: "Maminka již existuje — přihlášena na lekce",
					"success",
				);
				closeAddMomModalDirect();
				loadCourses();
				loadCalendar();
			} else {
				const data = await res.json();
				showNotification(data.error || "Chyba při přidávání maminky", "error");
			}
		} catch (error) {
			showNotification("Chyba při přidávání maminky", "error");
			console.error(error);
		}
	});
}

async function selfRegister(lessonId, triggerEl) {
	if (!currentUser || !currentUser.participantId) return;
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
