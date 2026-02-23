const { test, expect } = require('@playwright/test');
const { login, logout } = require('../utils/auth');

test('admin password reset requests nav points to dedicated route', async ({ page }) => {
  const adminEmail = process.env.TEST_ADMIN_EMAIL || 'admin@iiit.ac.in';
  const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'admin123';

  await login(page, adminEmail, adminPassword);
  await expect(page).toHaveURL(/\/admin/);

  await page.getByRole('link', { name: 'Password Reset Requests' }).first().click();
  await expect(page).toHaveURL(/\/admin\/password-reset-requests$/);
  await expect(page.getByRole('heading', { name: 'Password Reset Requests' })).toBeVisible();

  await logout(page);
});

test('participant is redirected away from admin password reset requests route', async ({
  page,
}) => {
  const participantEmail =
    process.env.TEST_PARTICIPANT_EMAIL || 'participant+overnight@example.com';
  const participantPassword =
    process.env.TEST_PARTICIPANT_PASSWORD || 'Participant#123';

  await login(page, participantEmail, participantPassword);
  await expect(page.locator('body')).toContainText('Participant Dashboard');

  await page.goto('/admin/password-reset-requests');
  await expect(page).toHaveURL(/\/participant$/);

  await logout(page);
});
