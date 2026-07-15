function switchTab(tab, buttonEl) {
	// Switch tab buttons
	document.querySelectorAll(".form-tab").forEach((btn) => {
		btn.classList.remove("active");
	});
	buttonEl.classList.add("active");

	// Switch form content
	document.querySelectorAll(".form-content").forEach((content) => {
		content.classList.remove("active");
	});
	document.getElementById(`${tab}-form`).classList.add("active");

	// Clear messages
	hideMessages();
}

function showError(message) {
	const errorDiv = document.getElementById("error-message");
	errorDiv.textContent = message;
	errorDiv.style.display = "block";
	document.getElementById("success-message").style.display = "none";
}

function showSuccess(message) {
	const successDiv = document.getElementById("success-message");
	successDiv.textContent = message;
	successDiv.style.display = "block";
	document.getElementById("error-message").style.display = "none";
}

function hideMessages() {
	document.getElementById("error-message").style.display = "none";
	document.getElementById("success-message").style.display = "none";
}

async function loginWithCredentials(email, password) {
	hideMessages();
	try {
		const response = await fetch("/api/auth/login", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ email, password }),
		});
		const result = await response.json();
		if (!response.ok) {
			showError(result.error || "Přihlášení selhalo");
			return;
		}
		showSuccess("Přihlášení úspěšné! Přesměrování...");
		setTimeout(() => {
			window.location.href = "/";
		}, 1000);
	} catch (error) {
		showError(`Chyba při přihlašování: ${error.message}`);
	}
}

async function handleLogin(event) {
	event.preventDefault();
	const formData = new FormData(event.target);
	await loginWithCredentials(formData.get("email"), formData.get("password"));
}

async function handleRegister(event) {
	event.preventDefault();
	hideMessages();

	const formData = new FormData(event.target);
	const data = {
		name: formData.get("name"),
		email: formData.get("email"),
		password: formData.get("password"),
	};

	try {
		const response = await fetch("/api/auth/register", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			credentials: "include",
			body: JSON.stringify(data),
		});

		const result = await response.json();

		if (!response.ok) {
			showError(result.error || "Registrace selhala");
			return;
		}

		// Registration successful
		showSuccess("Registrace úspěšná! Přesměrování...");
		setTimeout(() => {
			window.location.href = "/";
		}, 1000);
	} catch (error) {
		showError(`Chyba při registraci: ${error.message}`);
	}
}

document.querySelectorAll(".form-tab").forEach((btn) => {
	btn.addEventListener("click", (event) => {
		switchTab(btn.dataset.tab, event.currentTarget);
	});
});

document
	.getElementById("login-form")
	.querySelector("form")
	.addEventListener("submit", handleLogin);

document
	.getElementById("register-form")
	.querySelector("form")
	.addEventListener("submit", handleRegister);

document.addEventListener("DOMContentLoaded", async () => {
	try {
		const res = await fetch("/api/test-accounts");
		if (!res.ok) return;
		const data = await res.json();
		if (!data.accounts || data.accounts.length === 0) return;
		const container = document.getElementById("quick-login-buttons");
		data.accounts.forEach((account) => {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "btn btn-secondary";
			btn.style.cssText = "width:100%; margin-bottom:8px;";
			btn.textContent = account.label;
			btn.addEventListener("click", () =>
				loginWithCredentials(account.email, account.password),
			);
			container.appendChild(btn);
		});
		container.style.display = "block";
	} catch (_) {
		// Endpoint unavailable — no buttons shown
	}
});
