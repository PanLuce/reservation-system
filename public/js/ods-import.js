import { registerActions } from "./actions.js";
import { loadCalendar } from "./calendar.js";
import { loadCourses } from "./courses.js";
import {
	API_URL,
	escapeHtml,
	showInfoModal,
	showNotification,
	withLoading,
} from "./utils.js";

let odsParsed = { sheets: [] };
let odsSelectedSheetIndex = null;

export async function uploadOdsForPreview(event) {
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
			return `<button type="button" class="btn btn-secondary" data-action="select-ods-sheet" data-sheet-index="${i}"
				style="display:block;margin-bottom:8px;text-align:left;width:100%;">
				${escapeHtml(s.sheetName)}${location}
				<span style="font-size:12px;color:#888;margin-left:8px;">(${count} kandidát${count === 1 ? "" : "i/ů"})</span>
			</button>`;
		})
		.join("");
}

export function selectOdsSheet(index) {
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
			<label><input type="checkbox" id="ods-select-all" checked data-change="toggle-all-candidates"> Vybrat vše</label>
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

export function toggleAllCandidates(checked) {
	const sheet =
		odsSelectedSheetIndex !== null
			? odsParsed.sheets[odsSelectedSheetIndex]?.candidates || []
			: [];
	sheet.forEach((_, i) => {
		const el = document.getElementById(`ods-candidate-${i}`);
		if (el) el.checked = checked;
	});
}

export async function submitOdsImport(triggerEl) {
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

export function resetOdsImport() {
	odsParsed = { sheets: [] };
	odsSelectedSheetIndex = null;
	document.getElementById("ods-step-sheet").style.display = "none";
	document.getElementById("ods-sheet-list").innerHTML = "";
	document.getElementById("ods-step2").style.display = "none";
	document.getElementById("ods-blocks-container").innerHTML = "";
	document.getElementById("ods-commit-results").innerHTML = "";
	document.getElementById("ods-file-input").value = "";
}

registerActions("click", {
	"select-ods-sheet": (el) => selectOdsSheet(Number(el.dataset.sheetIndex)),
});

registerActions("change", {
	"toggle-all-candidates": (el) => toggleAllCandidates(el.checked),
});
