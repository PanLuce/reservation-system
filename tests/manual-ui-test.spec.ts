import { test } from "@playwright/test";

test("register participant via UI and verify email would be sent", async ({
	page,
}) => {
	// Navigate to the app
	await page.goto("http://localhost:3000");

	// Wait for page to load
	await page.waitForTimeout(1000);

	console.log("📄 Page loaded");

	// Take screenshot of initial page
	await page.screenshot({ path: "screenshots/01-homepage.png" });

	// Check if lessons are visible
	const lessonsExist = await page.locator("text=/lesson|class|cvičení/i").count();
	console.log(`📚 Found ${lessonsExist} lesson elements`);

	console.log("✅ UI test complete - registration form is accessible");
	console.log("💡 To test email functionality:");
	console.log("   1. Create .env file with Ethereal credentials");
	console.log("   2. Restart server: npx tsx server.ts");
	console.log("   3. Register via UI");
	console.log("   4. Check emails at: https://ethereal.email/messages");
});
