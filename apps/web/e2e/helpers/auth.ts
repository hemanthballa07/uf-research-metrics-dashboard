import { Page } from '@playwright/test';

/**
 * Logs in via the login form and waits for redirect to /dashboard.
 * Use this when you need to test the login UI flow itself.
 */
export async function loginAs(
  page: Page,
  email = 'admin@ufl.edu',
  password = 'changeme',
) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

/**
 * Injects a JWT token directly into localStorage so tests can skip the login
 * UI entirely. Requires the API to be running so we can obtain a real token.
 */
export async function loginProgrammatically(
  page: Page,
  email = 'admin@ufl.edu',
  password = 'changeme',
  baseURL = 'http://localhost:3000',
) {
  // Fetch a real token from the API before loading the app.
  const apiBase = process.env.API_URL ?? 'http://localhost:3001';
  const response = await page.request.post(`${apiBase}/api/auth/login`, {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok()) {
    throw new Error(
      `loginProgrammatically: API login failed with status ${response.status()}. ` +
        'Ensure the full stack (API + DB + Redis) is running before running E2E tests.',
    );
  }

  const body = await response.json() as { accessToken: string };
  const token = body.accessToken;

  // Navigate to a minimal page so localStorage is writable under the app origin.
  await page.goto(baseURL);
  await page.evaluate((t: string) => {
    localStorage.setItem('uf_auth_token', t);
  }, token);
}
