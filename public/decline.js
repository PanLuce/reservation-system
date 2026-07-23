import { escapeHtml } from "./js/utils.js";

const content = document.getElementById("decline-content");
const token = new URLSearchParams(window.location.search).get("token");

function renderError(message) {
	content.innerHTML = `<div class="error-message">${escapeHtml(message)}</div>`;
}

function renderDeclined() {
	content.innerHTML = `<div class="success-message">Místo bylo odmítnuto. Uvolnili jsme ho dalšímu čekajícímu.</div>`;
}

function renderAlreadyDeclined() {
	content.innerHTML = `<div class="error-message">Tento odkaz už byl použit.</div>`;
}

async function declineRegistration() {
	const res = await fetch(`/api/decline/${encodeURIComponent(token)}`, {
		method: "POST",
	});
	const data = await res.json();
	if (!res.ok) {
		renderError(data.error || "Odmítnutí se nezdařilo.");
		return;
	}
	if (data.alreadyDeclined) {
		renderAlreadyDeclined();
		return;
	}
	renderDeclined();
}

function renderOffer(info) {
	content.innerHTML = `
		<div class="decline-details">
			<p>Vaše dítě <strong>${escapeHtml(info.participant.name)}</strong> bylo přesunuto
			z čekací listiny na potvrzené místo na lekci:</p>
			<p><strong>${escapeHtml(info.lesson.title)}</strong><br>
			${escapeHtml(info.lesson.dayOfWeek)} ${escapeHtml(info.lesson.time)}</p>
			<p>Pokud toto místo nechcete, můžete ho odmítnout — uvolní se dalšímu
			čekajícímu dítěti.</p>
		</div>
		<button id="decline-btn" class="btn btn-danger">Odmítnout místo</button>
	`;
	document
		.getElementById("decline-btn")
		.addEventListener("click", declineRegistration);
}

async function init() {
	if (!token) {
		renderError("Chybí odkaz pro odmítnutí místa.");
		return;
	}
	const res = await fetch(`/api/decline/${encodeURIComponent(token)}`);
	const data = await res.json();
	if (!res.ok) {
		renderError(data.error || "Odkaz je neplatný nebo již byl použit.");
		return;
	}
	renderOffer(data);
}

init();
