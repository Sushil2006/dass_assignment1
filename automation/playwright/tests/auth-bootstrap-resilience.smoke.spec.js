const { test, expect } = require('@playwright/test');

test('login remains stable when auth bootstrap request fails', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.route('**/api/auth/me', (route) => route.abort('failed'));
  await page.goto('/login');

  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible();

  await page.waitForTimeout(300);

  const runtimeConsoleErrors = consoleErrors.filter((text) =>
    /TypeError: Failed to fetch|Uncaught \(in promise\)/i.test(text),
  );

  expect(runtimeConsoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});
