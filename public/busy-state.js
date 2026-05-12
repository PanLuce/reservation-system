(() => {
	if (window.__busyStateInstalled) return;
	window.__busyStateInstalled = true;

	let inFlight = 0;
	let progressBar = null;

	function updateBusy() {
		const busy = inFlight > 0;
		document.body.classList.toggle("is-busy", busy);
		if (progressBar) progressBar.hidden = !busy;
	}

	const _fetch = window.fetch;
	window.fetch = function (...args) {
		inFlight++;
		updateBusy();
		return _fetch.apply(this, args).finally(() => {
			inFlight--;
			updateBusy();
		});
	};

	document.addEventListener("DOMContentLoaded", () => {
		progressBar = document.getElementById("global-progress");
		updateBusy();
	});
})();
