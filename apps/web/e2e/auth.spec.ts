import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth.js';

// ---------------------------------------------------------------------------
// Auth smoke tests
// Requires: full stack running (API on :3001, web on :3000, DB + Redis)
// ---------------------------------------------------------------------------

test.describe('Authentication', () => {
  test('unauthenticated visit to /dashboard redirects to /login', async ({ page }) => {
    // Clear any stored token to ensure we are unauthenticated.
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('uf_auth_token'));

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login with invalid credentials shows an error message', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'wrong@ufl.edu');
    await page.fill('#password', 'badpassword');
    await page.click('button[type="submit"]');

    // The login page stays visible and an inline error is shown.
    await expect(page).toHaveURL(/\/login/);
    // LoginPage renders the error inside a <p> with text-red-600.
    const errorMsg = page.locator('p.text-red-600, p.text-sm.text-red-600');
    await expect(errorMsg).toBeVisible({ timeout: 5000 });
  });

  test('successful login redirects to /dashboard and shows the platform header', async ({ page }) => {
    await loginAs(page, 'admin@ufl.edu', 'changeme');

    // After redirect the Layout header should be visible.
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1', { hasText: 'UF Research Metrics Platform' })).toBeVisible();
  });

  test('sign out clears session and redirects to /login', async ({ page }) => {
    // Log in first.
    await loginAs(page, 'admin@ufl.edu', 'changeme');
    await expect(page).toHaveURL(/\/dashboard/);

    // Click the Sign out button in the nav.
    await page.click('button', { hasText: 'Sign out' });

    // Should land back on /login.
    await expect(page).toHaveURL(/\/login/);

    // Token should be cleared from localStorage.
    const token = await page.evaluate(() => localStorage.getItem('uf_auth_token'));
    expect(token).toBeNull();
  });
});
