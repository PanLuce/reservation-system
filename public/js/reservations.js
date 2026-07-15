import { closeDayModalDirect, loadCalendar } from "./calendar.js";
import { state } from "./state.js";
import {
	API_URL,
	escapeHtml,
	localDateString,
	showNotification,
	withLoading,
} from "./utils.js";

export async function loadMyReservations() {
	if (!state.currentUser?.participantId) return;
	const pId = state.currentUser.participantId;

	await Promise.all([
		loadMyLessons(pId),
		loadSubstitutionCandidates(pId),
		loadCreditCount(pId),
	]);
}

export async function loadCreditCount(participantId) {
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

export async function loadMyLessons(participantId) {
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
					<button class="btn btn-danger" data-action="self-cancel" data-id="${r.id}"
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

export async function selfCancel(registrationId, triggerEl) {
	if (!state.currentUser?.participantId) return;
	if (!confirm("Odhlásit se z této lekce?")) return;

	const pId = state.currentUser.participantId;
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

export async function loadSubstitutionCandidates(participantId) {
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
					<button class="btn btn-primary" data-action="self-register" data-id="${l.id}"
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

export async function selfRegister(lessonId, triggerEl) {
	if (!state.currentUser?.participantId) return;
	const pId = state.currentUser.participantId;

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
