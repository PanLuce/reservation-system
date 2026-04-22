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

// Age groups cache
let ageGroups = [];

async function loadAgeGroups() {
	try {
		const res = await fetch(`${API_URL}/age-groups`, { credentials: "include" });
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
		ageGroups.map((g) => `<option value="${g.name}">${g.name}</option>`).join("");
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
let calendarCreditCount = 0; // active substitution credits for current participant

const CZECH_MONTHS = [
	"Leden","Únor","Březen","Duben","Květen","Červen",
	"Červenec","Srpen","Září","Říjen","Listopad","Prosinec",
];
const CZECH_DAYS_SHORT = ["Po","Út","St","Čt","Pá","So","Ne"];

async function loadCalendar() {
	try {
		const lessonsPromise = fetch(`${API_URL}/lessons`, { credentials: "include" }).then((r) => r.json());

		const pId = currentUser?.participantId;
		const subPromise = pId
			? fetch(`${API_URL}/participants/${pId}/substitution-candidates`, { credentials: "include" })
				.then((r) => r.ok ? r.json() : [])
				.catch(() => [])
			: Promise.resolve([]);
		const creditPromise = pId
			? fetch(`${API_URL}/participants/${pId}/credits`, { credentials: "include" })
				.then((r) => r.ok ? r.json() : { count: 0 })
				.catch(() => ({ count: 0 }))
			: Promise.resolve({ count: 0 });

		const [lessons, subCandidates, creditData] = await Promise.all([lessonsPromise, subPromise, creditPromise]);
		calendarLessons = lessons;
		calendarSubCandidateIds = new Set(subCandidates.map((l) => l.id));
		calendarCreditCount = creditData.count ?? 0;

		renderMonthCalendar(calendarYear, calendarMonth);
	} catch (error) {
		showNotification("Chyba při načítání lekcí", "error");
		console.error(error);
	}
}

function calendarPrevMonth() {
	calendarMonth--;
	if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
	renderMonthCalendar(calendarYear, calendarMonth);
}

function calendarNextMonth() {
	calendarMonth++;
	if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
	renderMonthCalendar(calendarYear, calendarMonth);
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
		(d) => `<div class="calendar-day-header">${d}</div>`
	).join("");

	for (let i = 0; i < startOffset; i++) {
		html += `<div class="calendar-day other-month"></div>`;
	}

	for (let day = 1; day <= daysInMonth; day++) {
		const dateStr = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
		const isToday = dateStr === todayStr;
		const lessons = byDate[dateStr] || [];

		const MAX_DOTS = 4;
		const dots = lessons.slice(0, MAX_DOTS).map(
			(l) => `<span class="calendar-dot" style="background:${l.courseColor || "#ccc"}" title="${l.title}"></span>`
		).join("");
		const overflow = lessons.length > MAX_DOTS
			? `<span class="calendar-dot-overflow">+${lessons.length - MAX_DOTS}</span>`
			: "";

		html += `
			<div class="calendar-day${isToday ? " today" : ""}" onclick="openDayModal('${dateStr}')">
				<div class="calendar-day-number">${day}</div>
				<div class="calendar-dots">${dots}${overflow}</div>
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
	document.getElementById("day-modal-body").innerHTML = renderDayLessons(lessons, dateStr);
	document.getElementById("day-modal").style.display = "flex";
}

function renderDayLessons(lessons, dateStr) {
	if (lessons.length === 0) {
		return '<p style="color:#999;text-align:center;padding:20px;">Žádné lekce tento den.</p>';
	}
	const isAdmin = currentUser && currentUser.role === "admin";
	const todayStr = new Date().toISOString().slice(0, 10);
	const canCancel = dateStr > todayStr;

	return lessons.map((l) => {
		const fillPercent = Math.min(100, (l.enrolledCount / l.capacity) * 100);
		const isFull = l.enrolledCount >= l.capacity;
		const colorDot = l.courseColor
			? `<span class="calendar-dot" style="background:${l.courseColor};width:12px;height:12px;"></span>`
			: "";

		let actions;
		if (isAdmin) {
			actions = `<button class="btn btn-danger" onclick="deleteLesson('${l.id}');closeDayModalDirect()">Smazat</button>`;
		} else if (calendarSubCandidateIds.has(l.id)) {
			const noCredit = calendarCreditCount <= 0;
			actions = `<button class="btn btn-primary" onclick="selfRegister('${l.id}')"
				${noCredit ? `disabled title="Potřebujete náhradu (aktuálně 0 kreditů)"` : ""}>
				Přihlásit jako náhrada
			</button>`;
		} else {
			actions = `<button class="btn btn-danger" onclick="selfCancel('${l.id}')"
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
					<span>👶 ${(l.ageGroup)}</span>
					<span>👥 ${l.enrolledCount}/${l.capacity}</span>
				</div>
				<div class="capacity-bar" style="margin:8px 0;">
					<div class="capacity-bar-track">
						<div class="capacity-bar-fill ${isFull ? "full" : ""}" style="width:${fillPercent}%"></div>
					</div>
				</div>
				<div class="day-lesson-actions">${actions}</div>
			</div>`;
	}).join("");
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
						`<option value="${c.id}">[${(c.ageGroup)}] ${c.name}</option>`,
				)
				.join("");
	} catch (error) {
		console.error("Failed to load courses for lesson form", error);
	}
}

function hideAddLessonForm() {
	document.getElementById("add-lesson-form").style.display = "none";
	document.querySelector("#add-lesson-form form").reset();
}

// Add lesson
async function addLesson(event) {
	event.preventDefault();
	const form = event.target;
	const formData = new FormData(form);

	const lessonData = {
		title: formData.get("title"),
		dayOfWeek: formData.get("dayOfWeek"),
		time: formData.get("time"),
		location: formData.get("location"),
		ageGroup: formData.get("ageGroup"),
		capacity: parseInt(formData.get("capacity"), 10),
		courseId: formData.get("courseId"),
	};

	try {
		const response = await fetch(`${API_URL}/lessons`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(lessonData),
		});

		if (response.ok) {
			showNotification("Lekce byla úspěšně přidána!");
			hideAddLessonForm();
			loadCalendar();
		} else {
			showNotification("Chyba při přidávání lekce", "error");
		}
	} catch (error) {
		showNotification("Chyba při přidávání lekce", "error");
		console.error(error);
	}
}

// Delete lesson
async function deleteLesson(lessonId) {
	if (!confirm("Opravdu chcete smazat tuto lekci?")) {
		return;
	}

	try {
		const response = await fetch(`${API_URL}/lessons/${lessonId}`, {
			method: "DELETE",
		});

		if (response.ok) {
			showNotification("Lekce byla smazána");
			loadCalendar();
		} else {
			showNotification("Chyba při mazání lekce", "error");
		}
	} catch (error) {
		showNotification("Chyba při mazání lekce", "error");
		console.error(error);
	}
}

// Upload Excel
async function uploadExcel(event) {
	event.preventDefault();
	const form = event.target;
	const formData = new FormData(form);

	try {
		const response = await fetch(`${API_URL}/excel/import`, {
			method: "POST",
			body: formData,
		});

		const result = await response.json();

		if (response.ok) {
			showNotification(result.message);
			form.reset();
			loadCalendar();
		} else {
			showNotification(result.error || "Chyba při nahrávání souboru", "error");
		}
	} catch (error) {
		showNotification("Chyba při nahrávání souboru", "error");
		console.error(error);
	}
}

async function uploadCoursesExcel(event) {
	event.preventDefault();
	const form = event.target;
	const formData = new FormData(form);

	try {
		const response = await fetch(`${API_URL}/admin/courses/import`, {
			method: "POST",
			credentials: "include",
			body: formData,
		});

		const result = await response.json();
		const resultsEl = document.getElementById("courses-excel-results");

		if (response.ok) {
			const errors = (result.perRow || []).filter((r) => !r.ok);
			if (errors.length > 0) {
				const errList = errors.map((r) => `${r.name}: ${r.error}`).join("<br>");
				if (resultsEl) resultsEl.innerHTML = `<div class="error-list" style="margin-top:12px;color:#c62828;">${errList}</div>`;
				showNotification(`Nahrání dokončeno s ${errors.length} chybami`, "error");
			} else {
				if (resultsEl) resultsEl.innerHTML = "";
				showNotification(`Skupinky nahrány: ${result.processed}`);
			}
			form.reset();
			loadCourses();
		} else {
			showNotification(result.error || "Chyba při nahrávání souboru", "error");
		}
	} catch (error) {
		showNotification("Chyba při nahrávání souboru", "error");
		console.error(error);
	}
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
	loadCalendar();
	loadAgeGroups();
});

// ─── Skupinky (Courses) ───────────────────────────────────────────────────────

async function loadCourses() {
	try {
		const res = await fetch(`${API_URL}/courses`, { credentials: "include" });
		const courses = await res.json();
		const container = document.getElementById("courses-list");

		if (courses.length === 0) {
			container.innerHTML =
				'<p style="text-align:center;color:#999;padding:40px;">Žádné skupinky. Přidejte první skupinku!</p>';
			return;
		}

		container.innerHTML = courses.map(renderCourseCard).join("");
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
					<strong>👶 Věk:</strong> ${(course.ageGroup)}
				</div>
				${course.description ? `<div class="lesson-info-item"><strong>📝</strong> ${course.description}</div>` : ""}
			</div>
			${
				isAdmin
					? `
			<div class="lesson-actions">
				<button class="btn btn-secondary" onclick="editCourse('${course.id}')">Upravit</button>
				<button class="btn btn-danger" onclick="deleteCourse('${course.id}')">Smazat</button>
			</div>`
					: ""
			}
		</div>`;
}

function showAddCourseForm() {
	document.getElementById("course-form-title").textContent = "Nová skupinka";
	document.getElementById("course-edit-id").value = "";
	document.getElementById("course-name").value = "";
	document.getElementById("course-age-group").value = "";
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

	let hasError = false;
	if (!name) {
		document.getElementById("course-name-error").textContent =
			"Název je povinný";
		hasError = true;
	}
	if (hasError) return;

	try {
		const url = id ? `${API_URL}/courses/${id}` : `${API_URL}/courses`;
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
}

async function deleteCourse(id) {
	if (!confirm("Opravdu smazat tuto skupinku?")) return;
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
}

function clearCourseErrors() {
	document.getElementById("course-name-error").textContent = "";
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
					<button class="btn btn-danger" onclick="selfCancel('${r.id}')"
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

async function selfCancel(registrationId) {
	if (!currentUser || !currentUser.participantId) return;
	if (!confirm("Odhlásit se z této lekce?")) return;

	const pId = currentUser.participantId;
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
					<button class="btn btn-primary" onclick="selfRegister('${l.id}')">Přihlásit jako náhrada</button>
				</div>
			</div>`,
			)
			.join("");
	} catch (error) {
		showNotification("Chyba při načítání náhrad", "error");
		console.error(error);
	}
}

async function selfRegister(lessonId) {
	if (!currentUser || !currentUser.participantId) return;
	const pId = currentUser.participantId;

	try {
		const res = await fetch(`${API_URL}/participants/${pId}/register-lesson`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ lessonId }),
		});
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
}
