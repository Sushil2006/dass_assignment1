const { test, expect } = require('@playwright/test');
const { login, logout } = require('../utils/auth');

test('admin cannot delete organizer with linked events', async ({ page }) => {
  await login(
    page,
    process.env.TEST_ADMIN_EMAIL || 'admin@iiit.ac.in',
    process.env.TEST_ADMIN_PASSWORD || 'admin123'
  );

  await page.goto('/admin/organizers');
  await expect(page.locator('body')).toContainText('Manage Organizers');

  const organizerRow = page
    .locator('tr')
    .filter({ hasText: process.env.TEST_ORGANIZER_EMAIL || 'organizer+overnight@example.com' })
    .first();

  await expect(organizerRow).toBeVisible();

  const [deleteResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/organizers/') &&
        response.request().method() === 'DELETE'
    ),
    organizerRow.getByRole('button', { name: 'Delete' }).click(),
  ]);

  expect(deleteResponse.status()).toBe(409);
  await expect(page.getByText('Organizer has events. Archive/disable instead of delete.')).toBeVisible();
  await expect(organizerRow).toBeVisible();

  await logout(page);
});
