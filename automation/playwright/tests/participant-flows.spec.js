const { test, expect } = require('@playwright/test');
const { login, logout } = require('../utils/auth');

test('participant profile validation, onboarding, organizer follow/unfollow, and browse', async ({ page }) => {
  const participantEmail = process.env.TEST_PARTICIPANT_EMAIL || 'participant+overnight@example.com';
  const participantPassword = process.env.TEST_PARTICIPANT_PASSWORD || 'Participant#123';
  const organizerName = process.env.TEST_ORGANIZER_NAME || 'Overnight Organizer';

  await login(page, participantEmail, participantPassword);
  await expect(page.locator('body')).toContainText('Participant Dashboard');

  await page.goto('/participant/profile');
  await expect(page.locator('body')).toContainText('Participant Profile');

  await page.getByLabel('Contact Number').fill('123');
  await page.getByRole('button', { name: /Save Profile/i }).click();
  await expect(page.getByText(/Invalid request/i)).toBeVisible();

  await page.getByLabel('Contact Number').fill('9876543210');
  await page.getByLabel('College / Organization').fill('IIIT Test Org');
  await page.getByLabel('Interests (comma separated)').fill('ai, web, testing');
  await page.getByRole('button', { name: /Save Profile/i }).click();
  await expect(page.getByText(/Profile updated successfully/i)).toBeVisible();

  await page.getByRole('button', { name: /Save Onboarding/i }).click();
  await expect(page.getByText(/Onboarding preferences saved/i)).toBeVisible();

  await page.goto('/participant/organizers');
  await expect(page.locator('body')).toContainText('Clubs / Organizers');
  await page.getByLabel('Search organizers').fill(organizerName);

  const organizerCard = page.locator('.card').filter({ hasText: organizerName }).first();
  await expect(organizerCard).toBeVisible();

  const unfollowBtn = organizerCard.getByRole('button', { name: 'Unfollow' });
  if (await unfollowBtn.count()) {
    await unfollowBtn.click();
    await expect(page.getByText(/Organizer unfollowed/i)).toBeVisible();
  }

  await organizerCard.getByRole('button', { name: 'Follow' }).click();
  await expect(page.getByText(/Organizer followed/i)).toBeVisible();

  await page.goto('/participant/events');
  await expect(page.locator('body')).toContainText('Browse Events');
  await page.getByRole('button', { name: 'Search' }).click();

  await expect(page.locator('body')).toContainText('Seeded Overnight Published Event');

  await logout(page);
});
