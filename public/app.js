const API_URL = "http://localhost:3000/api";

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
		document
			.querySelectorAll(".tab")
			.forEach((t) => t.classList.remove("active"));
		tab.classList.add("active");

		// Update content
		document.querySelectorAll(".tab-content").forEach((content) => {
			content.classList.remove("active");
		});
		document.getElementById(targetTab).classList.add("active");

		// Load data for specific tabs
		if (targetTab === "lessons") {
			loadLessons();
		} else if (targetTab === "register") {
			loadLessonSelect();
		} else if (targetTab === "excel") {
			loadExcelLessonSelect();
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
function showAddLessonForm() {
	document.getElementById("add-lesson-form").style.display = "block";
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

// Load lesson select options
async function loadLessonSelect() {
	try {
		const response = await fetch(`${API_URL}/lessons`);
		const lessons = await response.json();

		const select = document.getElementById("lesson-select");
		select.innerHTML =
			'<option value="">-- Vyberte lekci --</option>' +
			lessons
				.map(
					(lesson) =>
						`<option value="${lesson.id}">${lesson.title} - ${translateDay(lesson.dayOfWeek)} ${lesson.time}</option>`,
				)
				.join("");
	} catch (error) {
		console.error(error);
	}
}

// Load lesson select for Excel
async function loadExcelLessonSelect() {
	try {
		const response = await fetch(`${API_URL}/lessons`);
		const lessons = await response.json();

		const select = document.getElementById("excel-lesson-select");
		select.innerHTML =
			'<option value="">-- Vyberte lekci --</option>' +
			lessons
				.map(
					(lesson) =>
						`<option value="${lesson.id}">${lesson.title} - ${translateDay(lesson.dayOfWeek)} ${lesson.time}</option>`,
				)
				.join("");
	} catch (error) {
		console.error(error);
	}
}

// Register participant
async function registerParticipant(event) {
	event.preventDefault();
	const form = event.target;
	const formData = new FormData(form);

	const registrationData = {
		lessonId: formData.get("lessonId"),
		participant: {
			name: formData.get("name"),
			email: formData.get("email"),
			phone: formData.get("phone"),
			ageGroup: formData.get("ageGroup"),
		},
	};

	try {
		const response = await fetch(`${API_URL}/registrations`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(registrationData),
		});

		const result = await response.json();

		if (response.ok) {
			if (result.status === "confirmed") {
				showNotification("Účastník byl úspěšně zaregistrován!");
			} else if (result.status === "waitlist") {
				showNotification(
					"Lekce je plná. Účastník byl přidán na čekací listinu.",
					"info",
				);
			}
			form.reset();
			loadLessons();
		} else {
			showNotification("Chyba při registraci účastníka", "error");
		}
	} catch (error) {
		showNotification("Chyba při registraci účastníka", "error");
		console.error(error);
	}
}

// Load substitution lessons
async function loadSubstitutionLessons() {
	const ageGroup = document.getElementById("sub-age-group").value;
	const container = document.getElementById("substitution-lessons");

	if (!ageGroup) {
		container.innerHTML = "";
		return;
	}

	try {
		const response = await fetch(
			`${API_URL}/substitutions/${encodeURIComponent(ageGroup)}`,
		);
		const lessons = await response.json();

		if (lessons.length === 0) {
			container.innerHTML =
				'<p style="text-align: center; color: #999; padding: 20px;">Žádné dostupné náhradní lekce pro tuto věkovou skupinu.</p>';
			return;
		}

		container.innerHTML = `
            <h3 style="margin-top: 20px; margin-bottom: 15px;">Dostupné náhradní lekce:</h3>
            <div class="lessons-grid">
                ${lessons
									.map((lesson) => {
										const fillPercent =
											(lesson.enrolledCount / lesson.capacity) * 100;
										const available = lesson.capacity - lesson.enrolledCount;

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
                                    <strong>✅ Volná místa:</strong> ${available}
                                </div>
                            </div>
                            <div class="capacity-bar">
                                <div class="capacity-bar-label">
                                    <span>Obsazenost</span>
                                    <span><strong>${lesson.enrolledCount}/${lesson.capacity}</strong></span>
                                </div>
                                <div class="capacity-bar-track">
                                    <div class="capacity-bar-fill" style="width: ${fillPercent}%"></div>
                                </div>
                            </div>
                        </div>
                    `;
									})
									.join("")}
            </div>
        `;
	} catch (error) {
		showNotification("Chyba při načítání náhradních lekcí", "error");
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
