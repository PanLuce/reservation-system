import { renderParticipantSelector } from "./reservations.js";
import { state } from "./state.js";
import { API_URL } from "./utils.js";

export async function loadCurrentUser() {
	try {
		const response = await fetch(`${API_URL}/auth/me`, {
			credentials: "include",
		});

		if (!response.ok) {
			window.location.href = "/login.html";
			return;
		}

		const data = await response.json();
		state.currentUser = data.user;
		state.selectedParticipantId =
			data.user.participants?.[0]?.id ?? data.user.participantId ?? null;
		renderParticipantSelector();

		// Update UI with user info
		document.getElementById("user-name").textContent = state.currentUser.name;
		const roleEl = document.getElementById("user-role");
		roleEl.textContent =
			state.currentUser.role === "admin" ? "👑 Admin" : "👤 Účastník";
		roleEl.className = `role-badge role-badge--${state.currentUser.role === "admin" ? "admin" : "participant"}`;

		if (state.currentUser.role !== "admin") {
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
export function hideAdminFeatures() {
	document.querySelectorAll(".admin-only").forEach((el) => {
		el.classList.add("hidden");
	});

	document.querySelectorAll(".participant-only").forEach((el) => {
		el.classList.remove("hidden");
	});
}

// Hide participant-only features (for admin view)
export function hideParticipantFeatures() {
	document.querySelectorAll(".participant-only").forEach((el) => {
		el.classList.add("hidden");
	});
}

export async function handleLogout() {
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

export async function loadAgeGroups() {
	try {
		const res = await fetch(`${API_URL}/age-groups`, {
			credentials: "include",
		});
		state.ageGroups = await res.json();
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
		state.ageGroups
			.map((g) => `<option value="${g.name}">${g.name}</option>`)
			.join("");
	if (current) selectEl.value = current;
}
