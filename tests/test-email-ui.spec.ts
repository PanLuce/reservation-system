import { test, expect } from '@playwright/test';

test('register participant via UI', async ({ page }) => {
  // Navigate to the app
  await page.goto('http://localhost:3000');
  
  // Wait for lessons to load
  await page.waitForSelector('.lesson-card', { timeout: 5000 });
  
  // Click first "Register" button
  await page.click('button:has-text("Register")');
  
  // Fill registration form
  await page.fill('input[name="name"]', 'Jana Nováková');
  await page.fill('input[name="email"]', 'jana@example.com');
  await page.fill('input[name="phone"]', '+420 777 888 999');
  
  // Submit registration
  await page.click('button[type="submit"]');
  
  // Verify success message
  await expect(page.locator('.success-message')).toBeVisible({ timeout: 5000 });
  
  console.log('✅ Registration successful via UI!');
});
