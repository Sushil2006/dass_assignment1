const { test, expect } = require('@playwright/test');
const { login, logout } = require('../utils/auth');

test('organizer navbar profile link opens organizer profile route', async ({ page }) => {
  const organizerEmail =
    process.env.TEST_ORGANIZER_EMAIL || 'organizer+overnight@example.com';
  const organizerPassword =
    process.env.TEST_ORGANIZER_PASSWORD || 'Organizer#123';

  await login(page, organizerEmail, organizerPassword);
  await expect(page.locator('body')).toContainText('Organizer Dashboard');

  await page.getByRole('link', { name: /^Profile$/ }).first().click();
  await expect(page).toHaveURL(/\/organizer\/profile$/);
  await expect(page.locator('body')).toContainText('Organizer Profile');
  await expect(page.getByLabel('Login Email (read-only)')).toBeDisabled();

  await logout(page);
});

test('participant is redirected away from organizer profile route', async ({ page }) => {
  const participantEmail =
    process.env.TEST_PARTICIPANT_EMAIL || 'participant+overnight@example.com';
  const participantPassword =
    process.env.TEST_PARTICIPANT_PASSWORD || 'Participant#123';

  await login(page, participantEmail, participantPassword);
  await expect(page.locator('body')).toContainText('Participant Dashboard');

  await page.goto('/organizer/profile');
  await expect(page).toHaveURL(/\/participant$/);

  await logout(page);
});
