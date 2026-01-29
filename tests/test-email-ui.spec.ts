import { test, expect } from '@playwright/test';
import { initializeDatabase, resetDatabaseForTests, seedSampleData } from '../src/database.js';

test.describe('Email UI Tests', () => {
  test.beforeEach(() => {
    // Set admin credentials for seeding
    process.env.ADMIN_EMAIL_SEED = 'admin@centrumrubacek.cz';
    process.env.ADMIN_PASSWORD_SEED = 'admin123';

    initializeDatabase();
    resetDatabaseForTests();
    seedSampleData(); // Create admin user and sample lessons
  });

  test('register participant via UI', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000/login.html');
    await page.fill('#login-email', 'admin@centrumrubacek.cz');
    await page.fill('#login-password', 'admin123');

    // Click the submit button and wait for navigation
    await Promise.all([
      page.waitForNavigation({ timeout: 10000 }),
      page.click('button[type="submit"]')
    ]);

    // Wait for lessons list container to be populated
    await page.waitForFunction(
      () => document.querySelector('#lessons-list')?.children.length > 0,
      { timeout: 10000 }
    );

    // Switch to registration tab
    const registerTab = page.locator('[data-tab="register"]');
    await registerTab.click();

    // Wait for lesson select to be populated
    await page.waitForFunction(
      () => document.querySelector('#lesson-select')?.children.length > 1,
      { timeout: 5000 }
    );

    // Fill registration form
    await page.selectOption('#lesson-select', { index: 1 }); // Select first lesson
    await page.fill('input[name="name"]', 'Jana Nováková');
    await page.fill('input[name="email"]', 'jana@example.com');
    await page.fill('input[name="phone"]', '+420 777 888 999');
    await page.selectOption('select[name="ageGroup"]', '3-12 months');

    // Submit registration
    await page.click('#register form button[type="submit"]');

    // Verify success notification appears
    await expect(page.locator('.notification.show')).toBeVisible({ timeout: 5000 });

    console.log('✅ Registration successful via UI!');
  });
});
