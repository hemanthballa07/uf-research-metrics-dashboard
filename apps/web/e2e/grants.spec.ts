import { test, expect } from '@playwright/test';
import { loginProgrammatically } from './helpers/auth.js';

// ---------------------------------------------------------------------------
// Grants page smoke tests
// Requires: full stack running (API on :3001, web on :3000, DB + Redis)
// ---------------------------------------------------------------------------

test.describe('Grants page', () => {
  test.beforeEach(async ({ page }) => {
    await loginProgrammatically(page);
    await page.goto('/grants');
    // Wait for the page heading to confirm the page has mounted.
    await expect(page.locator('h1', { hasText: 'Grants' })).toBeVisible({ timeout: 10000 });
  });

  test('search input is visible on the grants page', async ({ page }) => {
    // The search input uses placeholder text "Title or PI name..."
    const searchInput = page.locator('input[placeholder="Title or PI name..."]');
    await expect(searchInput).toBeVisible();
  });

  test('typing in the search input updates the URL ?search= param', async ({ page }) => {
    const searchInput = page.locator('input[placeholder="Title or PI name..."]');

    // Type a search term.
    await searchInput.fill('quantum');

    // GrantsPage debounces 500 ms before writing to the URL.
    // waitForURL with a wildcard covers the debounce delay.
    await page.waitForURL(/[?&]search=quantum/, { timeout: 3000 });

    const url = new URL(page.url());
    expect(url.searchParams.get('search')).toBe('quantum');
  });

  test('selecting a status filter updates the URL ?status= param', async ({ page }) => {
    // The status <select> has options like "AWARDED", "SUBMITTED", etc.
    const statusSelect = page.locator('select').first();
    await statusSelect.selectOption('AWARDED');

    // GrantsPage calls updateFilter which writes to the URL immediately (no debounce).
    await page.waitForURL(/[?&]status=AWARDED/, { timeout: 3000 });

    const url = new URL(page.url());
    expect(url.searchParams.get('status')).toBe('AWARDED');
  });
});
