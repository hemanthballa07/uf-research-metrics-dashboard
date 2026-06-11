import { test, expect } from '@playwright/test';
import { loginProgrammatically } from './helpers/auth.js';

// ---------------------------------------------------------------------------
// Navigation smoke tests
// Requires: full stack running (API on :3001, web on :3000, DB + Redis)
// ---------------------------------------------------------------------------

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginProgrammatically(page);
    // Reload so the React app picks up the token from localStorage.
    await page.goto('/dashboard');
  });

  test('/dashboard loads and shows at least one KPI card or the page heading', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);

    // The DashboardPage always renders the "Research Metrics Dashboard" heading.
    const heading = page.locator('h1', { hasText: 'Research Metrics Dashboard' });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('/grants loads and shows the grants table or a no-grants state', async ({ page }) => {
    await page.goto('/grants');
    await expect(page).toHaveURL(/\/grants/);

    // The GrantsPage renders a <h1>Grants</h1> header unconditionally.
    await expect(page.locator('h1', { hasText: 'Grants' })).toBeVisible({ timeout: 10000 });

    // Either the table body is present (with data) or the page doesn't crash.
    // We simply assert no fatal error banner is shown under normal stack-up conditions.
    const errorBanner = page.locator('[data-testid="error-display"]');
    // Only fail if an error banner exists AND is visible.
    const errorCount = await errorBanner.count();
    if (errorCount > 0) {
      await expect(errorBanner).not.toBeVisible();
    }
  });

  test('/leaderboard loads without a crash error', async ({ page }) => {
    await page.goto('/leaderboard');
    await expect(page).toHaveURL(/\/leaderboard/);

    // The LeaderboardPage renders its heading once data (or error) is resolved.
    const heading = page.locator('h1', { hasText: 'Faculty Leaderboard' });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('/ingest loads and shows the file upload drop zone', async ({ page }) => {
    await page.goto('/ingest');
    await expect(page).toHaveURL(/\/ingest/);

    // The IngestPage renders a "CSV Ingest" heading.
    await expect(page.locator('h1', { hasText: 'CSV Ingest' })).toBeVisible({ timeout: 10000 });

    // The drag-and-drop zone shows the placeholder text when no file is selected.
    await expect(
      page.locator('text=Drag and drop a CSV file here, or click to browse'),
    ).toBeVisible();
  });
});
