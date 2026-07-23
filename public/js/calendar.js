import { getActiveParticipantId, state } from "./state.js";
import {
	API_URL,
	escapeHtml,
	localDateString,
	showNotification,
} from "./utils.js";

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

export async function loadCalendar() {
	try {
		const lessonsPromise = fetch(`${API_URL}/lessons`, {
			credentials: "include",
		}).then((r) => r.json());

		const pId = getActiveParticipantId();
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

export function calendarPrevMonth() {
	calendarMonth--;
	if (calendarMonth < 0) {
		calendarMonth = 11;
		calendarYear--;
	}
	renderMonthCalendar(calendarYear, calendarMonth);
}

export function calendarNextMonth() {
	calendarMonth++;
	if (calendarMonth > 11) {
		calendarMonth = 0;
		calendarYear++;
	}
	renderMonthCalendar(calendarYear, calendarMonth);
}

function lessonPillTooltip(lesson) {
	const name = lesson.courseName || lesson.title;
	const time = lesson.time || "";
	const capacity = `${lesson.enrolledCount ?? 0}/${lesson.capacity ?? "?"}`;
	return `${name} • ${time} • ${capacity} obsazeno`;
}

function getLessonTileIcon(lesson) {
	const color = lesson.courseColor || "#B3E5FC";
	const tooltip = escapeHtml(lessonPillTooltip(lesson));
	return { pill: true, color, tooltip };
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
		const icons = lessons
			.slice(0, MAX_ICONS)
			.map((l) => {
				const badge = getLessonTileIcon(l);
				return `<span class="calendar-pill" style="background:${badge.color};" title="${badge.tooltip}"></span>`;
			})
			.join("");
		const overflow =
			lessons.length > MAX_ICONS
				? `<span class="calendar-dot-overflow">+${lessons.length - MAX_ICONS}</span>`
				: "";

		html += `
			<div class="calendar-day${isToday ? " today" : ""}" data-action="open-day-modal" data-date="${dateStr}">
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

export function openDayModal(dateStr) {
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
	const isAdmin = state.currentUser && state.currentUser.role === "admin";
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
				actions = `<button class="btn btn-secondary" data-action="edit-lesson" data-id="${l.id}">Upravit</button>
				<button class="btn btn-danger" data-action="delete-lesson" data-id="${l.id}">Smazat</button>`;
			} else if (calendarMyRegisteredIds.has(l.id)) {
				actions = `<button class="btn btn-danger" data-action="self-cancel" data-id="${l.id}"
				${canCancel ? "" : "disabled title='Nelze odhlásit po půlnoci před lekcí'"}>
				Odhlásit
			</button>`;
			} else if (calendarSubCandidateIds.has(l.id)) {
				const noCredit = calendarCreditCount <= 0;
				let subDisabled = "";
				if (!canCancel) {
					subDisabled = `disabled title="Nelze se přihlásit jako náhrada po půlnoci před lekcí"`;
				} else if (noCredit) {
					subDisabled = `disabled title="Potřebujete náhradu (aktuálně 0 kreditů)"`;
				}
				actions = `<button class="btn btn-primary" data-action="self-register" data-id="${l.id}"
				${subDisabled}>
				Přihlásit jako náhrada
			</button>`;
			} else {
				actions = "";
			}

			const participantsBlock = isAdmin
				? `<div id="day-lesson-members-${l.id}" style="margin:6px 0 2px;">
					<span style="font-size:13px;cursor:pointer;color:#555;" data-action="toggle-day-lesson-members" data-id="${l.id}">👶 Načíst účastníky ▾</span>
					<button class="btn btn-secondary" style="font-size:11px;padding:3px 8px;margin-left:8px;" data-action="open-lesson-participant-picker" data-id="${l.id}">+ Přidat dítě</button>
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

export function closeDayModal(el, event) {
	if (event.target === el) {
		document.getElementById("day-modal").style.display = "none";
	}
}

export function closeDayModalDirect() {
	document.getElementById("day-modal").style.display = "none";
}

export async function toggleDayLessonMembers(lessonId) {
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
		const summary = `<span style="font-size:13px;cursor:pointer;color:#555;" data-action="toggle-day-lesson-members" data-id="${lessonId}">👩 ${count} účastník${count === 1 ? "" : "ů"} ▾</span>`;
		const listHtml = members
			.map(
				(m) => `<li style="font-size:12px;color:#444;margin-bottom:2px;">
					<span style="cursor:pointer;text-decoration:underline;color:#534445;" data-action="open-participant-detail" data-id="${m.id}">${escapeHtml(m.name)}</span>
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
