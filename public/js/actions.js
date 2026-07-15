// Replaces inline onclick=/onchange=/onsubmit= attributes so the CSP can drop
// script-src-attr 'unsafe-inline'. Elements opt in via data-action/data-change/
// data-submit; handlers receive (el, event) where el is the matched element.
const clickActions = {};
const changeActions = {};
const submitActions = {};

export function registerActions(kind, map) {
	Object.assign(
		{ click: clickActions, change: changeActions, submit: submitActions }[kind],
		map,
	);
}

document.addEventListener("click", (event) => {
	const el = event.target.closest("[data-action]");
	if (!el) return;
	const fn = clickActions[el.dataset.action];
	if (fn) fn(el, event);
	else if (el.dataset.action !== "none") {
		console.error(`Unregistered action: ${el.dataset.action}`);
	}
});

document.addEventListener("change", (event) => {
	const el = event.target.closest("[data-change]");
	if (!el) return;
	const fn = changeActions[el.dataset.change];
	if (fn) fn(el, event);
	else console.error(`Unregistered change action: ${el.dataset.change}`);
});

document.addEventListener("submit", (event) => {
	const form = event.target.closest("form[data-submit]");
	if (!form) return;
	const fn = submitActions[form.dataset.submit];
	if (fn) fn(form, event);
	else console.error(`Unregistered submit action: ${form.dataset.submit}`);
});
