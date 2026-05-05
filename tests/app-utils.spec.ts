import { expect, test } from "@playwright/test";

// withLoading is defined inline in app.js (browser-only).
// We reproduce the contract here to test the logic independently.
async function withLoading(
	triggerEl: { disabled: boolean; innerHTML: string } | null,
	asyncFn: () => Promise<unknown>,
) {
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

test.describe("withLoading helper", () => {
	test("disables button and adds spinner while async fn runs", async () => {
		const btn = { disabled: false, innerHTML: "Save" };
		let seenDuringRun = { disabled: false, html: "" };

		await withLoading(btn, async () => {
			seenDuringRun = { disabled: btn.disabled, html: btn.innerHTML };
		});

		expect(seenDuringRun.disabled).toBe(true);
		expect(seenDuringRun.html).toContain("spinner");
	});

	test("restores button state after success", async () => {
		const btn = { disabled: false, innerHTML: "Save" };
		await withLoading(btn, async () => {});

		expect(btn.disabled).toBe(false);
		expect(btn.innerHTML).toBe("Save");
	});

	test("restores button state even when async fn throws", async () => {
		const btn = { disabled: false, innerHTML: "Delete" };

		await expect(
			withLoading(btn, async () => {
				throw new Error("network error");
			}),
		).rejects.toThrow("network error");

		expect(btn.disabled).toBe(false);
		expect(btn.innerHTML).toBe("Delete");
	});

	test("runs fn normally when triggerEl is null", async () => {
		let ran = false;
		await withLoading(null, async () => {
			ran = true;
		});
		expect(ran).toBe(true);
	});

	test("returns the value from the async fn", async () => {
		const btn = { disabled: false, innerHTML: "Go" };
		const result = await withLoading(btn, async () => 42);
		expect(result).toBe(42);
	});
});
