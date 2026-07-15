import { registerActions } from "./actions.js";
import { ensureCoursesCache, renderTransferDropdown } from "./courses.js";
import { API_URL, escapeHtml } from "./utils.js";

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

export async function loadParticipants() {
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

// Courses.js dispatches this after a transfer changes a participant's course
// membership, so the Děti tab's table (if open) reflects the new assignment.
document.addEventListener("participants:refresh", () => {
	loadParticipants();
});

registerActions("click", {
	"open-participant-detail": (el) => openParticipantDetail(el.dataset.id),
	"sort-participants": (el) => sortParticipants(el.dataset.key),
	"close-participant-modal-backdrop": closeParticipantModalOnBackdrop,
	"close-participant-modal": closeParticipantModal,
});
