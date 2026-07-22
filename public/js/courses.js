import { registerActions } from "./actions.js";
import { loadCalendar } from "./calendar.js";
import { state } from "./state.js";
import {
	API_URL,
	escapeHtml,
	hideInfoModal,
	localDateString,
	showInfoModal,
	showNotification,
	withLoading,
} from "./utils.js";

function populateProgramSelect(selectEl) {
	if (!selectEl) return;
	const current = selectEl.value;
	selectEl.innerHTML =
		'<option value="">-- Bez kurzu --</option>' +
		state.programsCache
			.map(
				(k) =>
					`<option value="${k.id}">${escapeHtml(k.name)} (${k.ageGroup})</option>`,
			)
			.join("");
	selectEl.value = current;
}

async function loadPrograms() {
	try {
		const res = await fetch(`${API_URL}/programs`, { credentials: "include" });
		if (!res.ok) throw new Error(`Failed to load programs: ${res.status}`);
		const programs = await res.json();
		if (!Array.isArray(programs)) throw new Error("Invalid programs response");
		state.programsCache = programs;
	} catch (error) {
		state.programsCache = [];
		console.error(error);
	}
}

export async function loadCourses() {
	try {
		await loadPrograms();
		const res = await fetch(`${API_URL}/courses`, { credentials: "include" });
		if (!res.ok) throw new Error(`Failed to load courses: ${res.status}`);
		const courses = await res.json();
		if (!Array.isArray(courses)) throw new Error("Invalid courses response");
		state.allCoursesCache = courses;
		populateProgramSelect(document.getElementById("course-program"));
		const container = document.getElementById("courses-list");

		if (courses.length === 0 && state.programsCache.length === 0) {
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
	const isAdmin = state.currentUser && state.currentUser.role === "admin";
	const sections = state.programsCache.map((program) => {
		const members = courses.filter((c) => c.programId === program.id);
		return renderProgramSection(program, members, isAdmin);
	});

	const unassigned = courses.filter(
		(c) =>
			!c.programId || !state.programsCache.some((k) => k.id === c.programId),
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
				<button class="btn btn-secondary" data-action="edit-program" data-id="${program.id}">Upravit kurz</button>
				<button class="btn btn-danger" data-action="delete-program" data-id="${program.id}">Smazat kurz</button>
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
	const isAdmin = state.currentUser && state.currentUser.role === "admin";
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
				<button class="btn btn-primary" data-action="show-add-mom-modal" data-id="${course.id}">+ Přidat dítě</button>
				<button class="btn btn-secondary" data-action="sync-course-enrollments" data-id="${course.id}">🔄 Přihlásit skupinku</button>
				<button class="btn btn-secondary" data-action="show-bulk-assign-modal" data-id="${course.id}">👥 Hromadně přiřadit</button>
				<button class="btn btn-secondary" data-action="edit-course" data-id="${course.id}">Upravit</button>
				<button class="btn btn-danger" data-action="delete-course" data-id="${course.id}">Smazat</button>
			</div>`
					: ""
			}
		</div>`;
}

export async function ensureCoursesCache() {
	if (state.allCoursesCache.length > 0) return;
	try {
		const res = await fetch(`${API_URL}/courses`, { credentials: "include" });
		if (res.ok) {
			const courses = await res.json();
			if (Array.isArray(courses)) state.allCoursesCache = courses;
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
		const summary = `<span style="font-size:13px;cursor:pointer;color:#555;" data-action="toggle-members-list" data-id="${courseId}">👩 ${count} mamink${suffix} ▾</span>`;
		const listItems = members.map((m) => renderMemberRow(m, courseId)).join("");
		container.innerHTML = `${summary}<ul id="course-members-list-${courseId}" style="display:none;margin:4px 0 0 0;padding-left:16px;list-style:disc;">${listItems}</ul>`;
	} catch {
		// silently ignore — members list is non-critical
	}
}

export function renderTransferDropdown(participantId, fromCourseId) {
	const current = state.allCoursesCache.find((c) => c.id === fromCourseId);
	const others = state.allCoursesCache.filter((c) => c.id !== fromCourseId);
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
	return `<select class="transfer-select" data-action="none" data-change="transfer-select" data-participant-id="${participantId}" data-from-course-id="${fromCourseId}">${currentOpt}${otherOpts}</select>`;
}

function renderMemberRow(m, currentCourseId) {
	const remaining =
		m.remainingLessons !== undefined
			? ` · <span style="color:#888;">zbývá ${m.remainingLessons} lekcí</span>`
			: "";
	return `<li style="font-size:12px;color:#444;margin-bottom:4px;">
		<span style="cursor:pointer;text-decoration:underline;color:#534445;" data-action="open-participant-detail" data-id="${m.id}">${escapeHtml(m.name)}</span>
		<span style="color:#999;">${escapeHtml(m.email)}</span>${remaining}
		${renderTransferDropdown(m.id, currentCourseId)}
	</li>`;
}

export function toggleMembersList(courseId) {
	const list = document.getElementById(`course-members-list-${courseId}`);
	if (list)
		list.style.display = list.style.display === "none" ? "block" : "none";
}

// Holds the in-flight transfer's context between the confirm modal, the
// mismatch modal, and the eventual API call — replaces the old approach of
// stashing state as data-attributes on the <select> and re-querying for it.
let pendingTransfer = null;

export function initiateTransferWithConfirm(selectEl) {
	const participantId = selectEl.dataset.participantId;
	const fromCourseId = selectEl.dataset.fromCourseId;
	const toCourseId = selectEl.value;
	if (!toCourseId || toCourseId === fromCourseId) {
		selectEl.value = fromCourseId;
		return;
	}
	pendingTransfer = { participantId, fromCourseId, toCourseId, selectEl };
	const fromName =
		state.allCoursesCache.find((c) => c.id === fromCourseId)?.name ??
		fromCourseId;
	const toName =
		state.allCoursesCache.find((c) => c.id === toCourseId)?.name ?? toCourseId;
	const body = `
		<p style="margin-bottom:16px;">Přesunout dítě ze skupinky <strong>${escapeHtml(fromName)}</strong> do skupinky <strong>${escapeHtml(toName)}</strong>?</p>
		<div style="display:flex;gap:8px;flex-wrap:wrap;">
			<button class="btn btn-primary" data-action="transfer-confirm">Přesunout</button>
			<button class="btn btn-secondary" data-action="transfer-abort">Zrušit</button>
		</div>`;
	document.getElementById("info-modal-title").textContent = "Přesunout dítě";
	document.getElementById("info-modal-body").innerHTML = body;
	document.getElementById("info-modal").style.display = "flex";
}

export function abortPendingTransfer() {
	hideInfoModal();
	if (pendingTransfer?.selectEl) {
		pendingTransfer.selectEl.value = pendingTransfer.fromCourseId;
	}
	pendingTransfer = null;
}

export async function confirmPendingTransfer() {
	hideInfoModal();
	if (!pendingTransfer) return;
	const { participantId, fromCourseId, toCourseId, selectEl } = pendingTransfer;
	await initiateTransfer(participantId, fromCourseId, toCourseId, selectEl);
}

async function initiateTransfer(
	participantId,
	fromCourseId,
	toCourseId,
	selectEl,
) {
	if (!toCourseId) return;
	if (selectEl) selectEl.value = "";

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
	pendingTransfer = { participantId, fromCourseId, toCourseId };
	const body = `
		<p style="margin-bottom:16px;">Dítě má <strong>${remainingInOld}</strong> zbývajících lekcí v aktuální skupince,
		ale nová skupinka má <strong>${futureInNew}</strong> budoucích lekcí.</p>
		<p style="margin-bottom:20px;color:#666;font-size:13px;">Na kolik lekcí nové skupinky ji chcete zaregistrovat?</p>
		<div style="display:flex;gap:8px;flex-wrap:wrap;">
			<button class="btn btn-primary" data-action="transfer-mismatch-confirm" data-count="${remainingInOld}">
				Registrovat na prvních ${remainingInOld}
			</button>
			<button class="btn btn-secondary" data-action="transfer-mismatch-confirm" data-count="${futureInNew}">
				Registrovat na všech ${futureInNew}
			</button>
			<button class="btn btn-danger" data-action="hide-info-modal">Zrušit</button>
		</div>`;
	document.getElementById("info-modal-title").textContent =
		"Nesoulad počtu lekcí";
	document.getElementById("info-modal-body").innerHTML = body;
	document.getElementById("info-modal").style.display = "flex";
}

export async function confirmTransfer(
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
			document.dispatchEvent(new CustomEvent("participants:refresh"));
		}
	} catch {
		showNotification("Přesun se nezdařil", "error");
	}
}

export function showAddCourseForm() {
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

export function hideAddCourseForm() {
	document.getElementById("add-course-form").style.display = "none";
	clearCourseErrors();
}

export async function editCourse(id) {
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

export async function submitCourseForm(event) {
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

export async function deleteCourse(id, triggerEl) {
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

export function showAddProgramForm() {
	document.getElementById("program-form-title").textContent = "Nový kurz";
	document.getElementById("program-edit-id").value = "";
	document.getElementById("program-name").value = "";
	document.getElementById("program-age-group").value = "";
	document.getElementById("program-name-error").textContent = "";
	document.getElementById("add-program-form").style.display = "block";
}

export function hideAddProgramForm() {
	document.getElementById("add-program-form").style.display = "none";
	document.getElementById("program-name-error").textContent = "";
}

export async function editProgram(id) {
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

export async function submitProgramForm(event) {
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

export async function deleteProgram(id, triggerEl) {
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

export function showAddMomModal(courseId) {
	document.getElementById("add-mom-course-id").value = courseId;
	document.getElementById("add-mom-name").value = "";
	document.getElementById("add-mom-email").value = "";
	document.getElementById("add-mom-phone").value = "";
	document.getElementById("add-mom-modal").style.display = "flex";
}

export function closeAddMomModal(el, event) {
	if (event.target === el) {
		document.getElementById("add-mom-modal").style.display = "none";
	}
}

export function closeAddMomModalDirect() {
	document.getElementById("add-mom-modal").style.display = "none";
}

export async function submitAddMom(event) {
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

export async function syncCourseEnrollments(courseId, triggerEl) {
	await withLoading(triggerEl, async () => {
		try {
			const res = await fetch(
				`${API_URL}/courses/${courseId}/sync-enrollments`,
				{
					method: "POST",
					credentials: "include",
				},
			);
			if (res.ok) {
				const data = await res.json();
				showNotification(
					`Přihlášeno: ${data.enrolled}, přeskočeno: ${data.skipped}`,
				);
				loadCourseMembers(courseId);
			} else {
				showNotification("Chyba při hromadném přihlašování", "error");
			}
		} catch (error) {
			showNotification("Chyba při hromadném přihlašování", "error");
			console.error(error);
		}
	});
}

function renderBulkAssignParticipantOption(p) {
	return `<label style="display:block;font-size:13px;margin-bottom:4px;">
		<input type="checkbox" class="bulk-assign-participant" value="${p.id}"> ${escapeHtml(p.name)}
	</label>`;
}

function renderBulkAssignLessonOption(l) {
	return `<label style="display:block;font-size:13px;margin-bottom:4px;">
		<input type="checkbox" class="bulk-assign-lesson" value="${l.id}"> ${escapeHtml(l.title)} (${l.date})
	</label>`;
}

export async function showBulkAssignModal(courseId) {
	document.getElementById("bulk-assign-course-id").value = courseId;
	const participantsContainer = document.getElementById(
		"bulk-assign-participants",
	);
	const lessonsContainer = document.getElementById("bulk-assign-lessons");
	participantsContainer.innerHTML =
		'<span style="color:#aaa;font-size:13px;">Načítám…</span>';
	lessonsContainer.innerHTML =
		'<span style="color:#aaa;font-size:13px;">Načítám…</span>';
	document.getElementById("bulk-assign-modal").style.display = "flex";

	const [participantsRes, lessonsRes] = await Promise.all([
		fetch(`${API_URL}/courses/${courseId}/participants`, {
			credentials: "include",
		}),
		fetch(`${API_URL}/lessons`, { credentials: "include" }),
	]);

	const participants = participantsRes.ok ? await participantsRes.json() : [];
	const allLessons = lessonsRes.ok ? await lessonsRes.json() : [];
	const today = localDateString();
	const futureLessons = allLessons.filter(
		(l) => l.courseId === courseId && l.date >= today,
	);

	participantsContainer.innerHTML = participants.length
		? participants.map(renderBulkAssignParticipantOption).join("")
		: '<span style="color:#aaa;font-size:13px;">Žádné děti ve skupince.</span>';

	lessonsContainer.innerHTML = futureLessons.length
		? futureLessons.map(renderBulkAssignLessonOption).join("")
		: '<span style="color:#aaa;font-size:13px;">Žádné budoucí lekce.</span>';
}

export function closeBulkAssignModal(el, event) {
	if (event.target === el) {
		document.getElementById("bulk-assign-modal").style.display = "none";
	}
}

export function closeBulkAssignModalDirect() {
	document.getElementById("bulk-assign-modal").style.display = "none";
}

// One-time listener on the static form — its two checklist containers are
// re-populated per open, but the form element itself is never recreated.
document.getElementById("bulk-assign-form")?.addEventListener("change", () => {
	const hasParticipant = document.querySelector(
		".bulk-assign-participant:checked",
	);
	const hasLesson = document.querySelector(".bulk-assign-lesson:checked");
	const submitBtn = document.getElementById("bulk-assign-submit");
	if (submitBtn) submitBtn.disabled = !(hasParticipant && hasLesson);
});

export async function submitBulkAssign(event) {
	event.preventDefault();
	const courseId = document.getElementById("bulk-assign-course-id").value;
	const participantIds = Array.from(
		document.querySelectorAll(".bulk-assign-participant:checked"),
	).map((el) => el.value);
	const lessonIds = Array.from(
		document.querySelectorAll(".bulk-assign-lesson:checked"),
	).map((el) => el.value);

	if (participantIds.length === 0 || lessonIds.length === 0) {
		showNotification("Vyberte alespoň jedno dítě a jednu lekci", "error");
		return;
	}

	await withLoading(event.submitter, async () => {
		try {
			const res = await fetch(`${API_URL}/courses/${courseId}/bulk-register`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ participantIds, lessonIds }),
			});
			if (res.ok) {
				const data = await res.json();
				closeBulkAssignModalDirect();
				loadCourseMembers(courseId);
				showInfoModal(
					"Výsledek hromadného přiřazení",
					`<p>Přiřazeno: <strong>${data.successful}</strong></p>
					<p>Přeskočeno (již přihlášeno): <strong>${data.skipped}</strong></p>
					<p>Náhradníci (plná kapacita): <strong>${data.waitlisted}</strong></p>
					${data.errors.length ? `<p style="color:#c0392b;">Chyby: <strong>${data.errors.length}</strong></p>` : ""}`,
				);
			} else {
				const data = await res.json().catch(() => ({}));
				showNotification(
					data.error || "Chyba při hromadném přiřazování",
					"error",
				);
			}
		} catch (error) {
			showNotification("Chyba při hromadném přiřazování", "error");
			console.error(error);
		}
	});
}

registerActions("submit", {
	"bulk-assign": (_form, event) => submitBulkAssign(event),
});

registerActions("click", {
	"edit-program": (el) => editProgram(el.dataset.id),
	"delete-program": (el) => deleteProgram(el.dataset.id, el),
	"show-add-mom-modal": (el) => showAddMomModal(el.dataset.id),
	"sync-course-enrollments": (el) => syncCourseEnrollments(el.dataset.id, el),
	"show-bulk-assign-modal": (el) => showBulkAssignModal(el.dataset.id),
	"close-bulk-assign-modal-backdrop": closeBulkAssignModal,
	"close-bulk-assign-modal": closeBulkAssignModalDirect,
	"edit-course": (el) => editCourse(el.dataset.id),
	"delete-course": (el) => deleteCourse(el.dataset.id, el),
	"toggle-members-list": (el) => toggleMembersList(el.dataset.id),
	"transfer-confirm": confirmPendingTransfer,
	"transfer-abort": abortPendingTransfer,
	"transfer-mismatch-confirm": (el) => {
		if (!pendingTransfer) return;
		const { participantId, fromCourseId, toCourseId } = pendingTransfer;
		confirmTransfer(
			participantId,
			fromCourseId,
			toCourseId,
			Number(el.dataset.count),
		);
	},
});

registerActions("change", {
	"transfer-select": (el) => initiateTransferWithConfirm(el),
});
