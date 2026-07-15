export const API_URL = `${window.location.origin}/api`;

export function localDateString(date = new Date()) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function escapeHtml(str) {
	return String(str ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

// Disable button + show spinner for the duration of an async operation.
export async function withLoading(triggerEl, asyncFn) {
	if (!triggerEl) return asyncFn();
	const originalText = triggerEl.innerHTML;
	triggerEl.disabled = true;
	triggerEl.innerHTML = `${originalText}<span class="spinner"></span>`;
	try {
		return await asyncFn();
	} finally {
		triggerEl.disabled = false;
		triggerEl.innerHTML = originalText;
	}
}

export function showNotification(message, type = "success") {
	const notification = document.getElementById("notification");
	notification.textContent = message;
	notification.className = `notification ${type} show`;

	setTimeout(() => {
		notification.classList.remove("show");
	}, 3000);
}

export function showInfoModal(title, htmlBody) {
	document.getElementById("info-modal-title").textContent = title;
	document.getElementById("info-modal-body").innerHTML = htmlBody;
	document.getElementById("info-modal").style.display = "flex";
}

export function hideInfoModal() {
	document.getElementById("info-modal").style.display = "none";
}
