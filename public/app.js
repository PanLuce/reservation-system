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

		// Hide admin-only features for participants
		if (currentUser.role !== "admin") {
			hideAdminFeatures();
		}
	} catch (error) {
		console.error("Failed to load user:", error);
		window.location.href = "/login.html";
	}
}

// Hide admin-only features
function hideAdminFeatures() {
	// Hide "Add Lesson" button
	const addLessonBtn = document.querySelector(
		'[onclick="showAddLessonForm()"]',
	);
	if (addLessonBtn) addLessonBtn.style.display = "none";

	// Hide "Add Skupinka" button
	document.querySelectorAll(".admin-only").forEach((el) => {
		el.style.display = "none";
	});

	// Hide edit/delete buttons for lessons (will be done in loadLessons function)

	// Hide Excel import tab
	const excelTab = document.querySelector('[data-tab="excel"]');
	if (excelTab) excelTab.style.display = "none";
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
			loadLessons();
		} else if (targetTab === "courses") {
			loadCourses();
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

// Load lessons
async function loadLessons() {
	try {
		const response = await fetch(`${API_URL}/lessons`);
		const lessons = await response.json();

		const container = document.getElementById("lessons-list");

		if (lessons.length === 0) {
			container.innerHTML =
				'<p style="text-align: center; color: #999; padding: 40px;">Žádné lekce k zobrazení. Přidejte první lekci!</p>';
			return;
		}

		container.innerHTML = lessons
			.map((lesson) => {
				const fillPercent = (lesson.enrolledCount / lesson.capacity) * 100;
				const isFull = lesson.enrolledCount >= lesson.capacity;
				const isAdmin = currentUser && currentUser.role === "admin";

				return `
                <div class="lesson-card">
                    <h3>${lesson.title}</h3>
                    <div class="lesson-info">
                        <div class="lesson-info-item">
                            <strong>📅 Den:</strong> ${translateDay(lesson.dayOfWeek)}
                        </div>
                        <div class="lesson-info-item">
                            <strong>🕐 Čas:</strong> ${lesson.time}
                        </div>
                        <div class="lesson-info-item">
                            <strong>📍 Místo:</strong> ${lesson.location}
                        </div>
                        <div class="lesson-info-item">
                            <strong>👶 Věk:</strong> ${translateAgeGroup(lesson.ageGroup)}
                        </div>
                    </div>
                    <div class="capacity-bar">
                        <div class="capacity-bar-label">
                            <span>Obsazenost</span>
                            <span><strong>${lesson.enrolledCount}/${lesson.capacity}</strong></span>
                        </div>
                        <div class="capacity-bar-track">
                            <div class="capacity-bar-fill ${isFull ? "full" : ""}" style="width: ${fillPercent}%"></div>
                        </div>
                    </div>
                    ${
											isAdmin
												? `
                    <div class="lesson-actions">
                        <button class="btn btn-danger" onclick="deleteLesson('${lesson.id}')">Smazat</button>
                    </div>
                    `
												: ""
										}
                </div>
            `;
			})
			.join("");
	} catch (error) {
		showNotification("Chyba při načítání lekcí", "error");
		console.error(error);
	}
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

// Translate age groups
function translateAgeGroup(ageGroup) {
	const groups = {
		"3-12 months": "3-12 měsíců",
		"1-2 years": "1-2 roky",
		"2-3 years": "2-3 roky",
		"3-4 years": "3-4 roky",
	};
	return groups[ageGroup] || ageGroup;
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
						`<option value="${c.id}">[${translateAgeGroup(c.ageGroup)}] ${c.name}</option>`,
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
			loadLessons();
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
			loadLessons();
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
			loadLessons();
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
	loadLessons();
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
					<strong>👶 Věk:</strong> ${translateAgeGroup(course.ageGroup)}
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
	document.getElementById("course-age-group").value = "3-12 months";
	document.getElementById("course-color").value = "#4CAF50";
	document.getElementById("course-color-picker").value = "#4CAF50";
	document.getElementById("course-description").value = "";
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
		document.getElementById("course-color").value = course.color;
		document.getElementById("course-color-picker").value = course.color;
		document.getElementById("course-description").value =
			course.description || "";
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
	const color = document.getElementById("course-color").value.trim();
	const description = document
		.getElementById("course-description")
		.value.trim();

	let hasError = false;
	if (!name) {
		document.getElementById("course-name-error").textContent =
			"Název je povinný";
		hasError = true;
	}
	if (!/^#([0-9A-Fa-f]{3}){1,2}$/.test(color)) {
		document.getElementById("course-color-error").textContent =
			"Barva musí být platný hex kód (např. #FF6B6B)";
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
			body: JSON.stringify({ name, ageGroup, color, description }),
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

function syncColorHex(value) {
	document.getElementById("course-color").value = value;
}

function syncColorPicker(value) {
	if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(value)) {
		document.getElementById("course-color-picker").value = value;
	}
}

function clearCourseErrors() {
	document.getElementById("course-name-error").textContent = "";
	document.getElementById("course-color-error").textContent = "";
}
