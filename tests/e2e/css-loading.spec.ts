import { test, expect } from '@playwright/test';

/**
 * Test Suite: CSS File Loading Verification
 *
 * Purpose: Verify that styles.css loads correctly from the server
 * This is a focused test to check the static file path fix
 */

test.describe('CSS File Loading - Direct Check', () => {
  test('styles.css should return 200 OK', async ({ request }) => {
    // Act: Fetch CSS file directly
    const response = await request.get('http://localhost:3000/styles.css');

    // Assert: Returns 200
    expect(response.status()).toBe(200);

    // Assert: Content type is CSS
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('css');

    // Assert: File has content
    const text = await response.text();
    expect(text.length).toBeGreaterThan(1000); // styles.css is ~4.7KB
    expect(text).toContain('linear-gradient'); // Should have gradients
    expect(text).toContain('.container'); // Should have container class
  });

  test('app.js should return 200 OK', async ({ request }) => {
    // Act: Fetch JS file directly
    const response = await request.get('http://localhost:3000/app.js');

    // Assert: Returns 200
    expect(response.status()).toBe(200);

    // Assert: Content type is JavaScript
    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/javascript|ecmascript/);

    // Assert: File has content and correct function names (no underscores)
    const text = await response.text();
    expect(text).toContain('function handleLogout');
    expect(text).toContain('function showAddLessonForm');
    expect(text).not.toContain('function _handleLogout'); // Should NOT have underscores
  });
});

test.describe('Dashboard Page - CSS Applied', () => {
  test('dashboard should load styles.css successfully', async ({ page }) => {
    // Arrange: Track network requests
    const cssRequests: any[] = [];
    page.on('response', response => {
      if (response.url().endsWith('styles.css')) {
        cssRequests.push({
          url: response.url(),
          status: response.status(),
        });
      }
    });

    // Act: Navigate to dashboard (redirects to login if not authenticated)
    await page.goto('http://localhost:3000/');

    // Assert: CSS was requested
    expect(cssRequests.length).toBeGreaterThan(0);

    // Assert: CSS request returned 200
    const successfulCss = cssRequests.filter(req => req.status === 200);
    expect(successfulCss.length).toBeGreaterThan(0);
  });

  test('login page should have purple gradient background', async ({ page }) => {
    // Arrange
    await page.goto('http://localhost:3000/login.html');
    await page.waitForLoadState('networkidle');

    // Act: Get body background using inline styles (login has inline CSS)
    const bodyBg = await page.evaluate(() => {
      const body = document.body;
      const computed = window.getComputedStyle(body);
      return {
        background: computed.background,
        backgroundImage: computed.backgroundImage,
      };
    });

    // Assert: Should have gradient (from inline CSS or styles.css)
    const hasGradient = bodyBg.background.includes('linear-gradient') ||
                       bodyBg.backgroundImage.includes('linear-gradient');
    expect(hasGradient).toBe(true);
  });
});

test.describe('Static Assets - No 404 Errors', () => {
  test('loading dashboard should not result in 404 for CSS/JS', async ({ page }) => {
    // Arrange: Track 404 responses
    const failed404: string[] = [];

    page.on('response', response => {
      if (response.status() === 404) {
        failed404.push(response.url());
      }
    });

    // Act: Navigate to homepage
    await page.goto('http://localhost:3000/');
    await page.waitForLoadState('networkidle');

    // Assert: No 404s for styles.css or app.js
    const cssJs404 = failed404.filter(url =>
      url.includes('styles.css') || url.includes('app.js')
    );

    if (cssJs404.length > 0) {
      console.log('❌ 404 Errors found:', cssJs404);
    }

    expect(cssJs404).toHaveLength(0);
  });
});

test.describe('Interactive Elements - Function Names Fixed', () => {
  test('app.js should define functions without underscore prefix', async ({ request }) => {
    // Act: Fetch app.js source code
    const response = await request.get('http://localhost:3000/app.js');
    const source = await response.text();

    // Assert: Functions are defined with correct names (no underscores)
    expect(source).toContain('async function handleLogout()');
    expect(source).toContain('function showAddLessonForm()');
    expect(source).toContain('async function addLesson(event)');
    expect(source).toContain('async function deleteLesson(lessonId)');
    expect(source).toContain('async function registerParticipant(event)');
    expect(source).toContain('async function loadSubstitutionLessons()');
    expect(source).toContain('async function uploadExcel(event)');

    // Assert: Old underscore versions should NOT exist
    expect(source).not.toContain('function _handleLogout()');
    expect(source).not.toContain('function _showAddLessonForm()');
    expect(source).not.toContain('function _addLesson(event)');
    expect(source).not.toContain('function _deleteLesson(lessonId)');
  });

  test('HTML onclick handlers match function names in app.js', async ({ request }) => {
    // Arrange: Fetch both files
    const [htmlResponse, jsResponse] = await Promise.all([
      request.get('http://localhost:3000/index.html'),
      request.get('http://localhost:3000/app.js'),
    ]);

    const htmlSource = await htmlResponse.text();
    const jsSource = await jsResponse.text();

    // Extract onclick handlers from HTML
    const onclickPattern = /onclick="(\w+)\(/g;
    const matches = Array.from(htmlSource.matchAll(onclickPattern));
    const htmlFunctions = matches.map(m => m[1]);

    // Assert: Every onclick function exists in app.js
    for (const funcName of htmlFunctions) {
      const functionExists = jsSource.includes(`function ${funcName}(`);
      if (!functionExists) {
        throw new Error(`Function "${funcName}" called in HTML but not found in app.js`);
      }
      expect(functionExists).toBe(true);
    }
  });
});