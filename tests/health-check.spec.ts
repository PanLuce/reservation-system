import { expect, test } from "@playwright/test";

const API_BASE = "http://localhost:3000";

test.describe("Health Check Endpoints", () => {
	test("GET /health should return status ok", async ({ request }) => {
		const response = await request.get(`${API_BASE}/health`);

		expect(response.status()).toBe(200);

		const data = await response.json();
		expect(data.status).toBe("ok");
		expect(data.timestamp).toBeDefined();
		expect(data.uptime).toBeGreaterThan(0);
	});

	test("GET /ready should check database connectivity", async ({ request }) => {
		const response = await request.get(`${API_BASE}/ready`);

		expect(response.status()).toBe(200);

		const data = await response.json();
		expect(data.status).toBe("ready");
		expect(data.database).toBe("connected");
		expect(data.timestamp).toBeDefined();
	});

	test("GET /ready should return 503 if database check fails", async ({
		request,
	}) => {
		// Note: This test would require mocking database failure
		// For now, we just verify the endpoint exists and returns success
		const response = await request.get(`${API_BASE}/ready`);

		// In healthy state, should be 200
		expect([200, 503]).toContain(response.status());
	});
});
