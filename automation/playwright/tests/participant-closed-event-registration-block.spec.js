const { test, expect } = require('@playwright/test');
const { login, logout } = require('../utils/auth');

test('participant cannot register when organizer closes an event', async ({ page }) => {
  const organizerEmail =
    process.env.TEST_ORGANIZER_EMAIL || 'organizer+overnight@example.com';
  const organizerPassword =
    process.env.TEST_ORGANIZER_PASSWORD || 'Organizer#123';
  const participantEmail =
    process.env.TEST_PARTICIPANT_EMAIL || 'participant+overnight@example.com';
  const participantPassword =
    process.env.TEST_PARTICIPANT_PASSWORD || 'Participant#123';
  const seededEventName = 'Seeded Overnight Published Event';

  await login(page, organizerEmail, organizerPassword);
  await page.goto('/organizer');

  const organizerEventCard = page
    .locator('.card.h-100.border')
    .filter({ hasText: seededEventName })
    .filter({ has: page.getByRole('button', { name: 'Open' }) })
    .first();
  await expect(organizerEventCard).toBeVisible();

  const closeButton = organizerEventCard.getByRole('button', { name: 'Close' });
  if (await closeButton.count()) {
    await closeButton.click();
    await expect(page.getByText(/Event moved to CLOSED/i)).toBeVisible();
    await expect(organizerEventCard).toContainText('CLOSED');
  } else {
    await expect(organizerEventCard).toContainText('CLOSED');
  }

  await logout(page);

  await login(page, participantEmail, participantPassword);
  await page.goto('/participant/events');

  const participantEventCard = page
    .locator('.card.h-100.border')
    .filter({ hasText: seededEventName })
    .filter({ has: page.getByRole('button', { name: 'View details' }) })
    .first();
  await expect(participantEventCard).toBeVisible();
  await expect(participantEventCard).toContainText('CLOSED');
  await expect(participantEventCard).toContainText('Registration currently unavailable.');

  await participantEventCard.getByRole('button', { name: 'View details' }).click();
  await expect(page).toHaveURL(/\/participant\/events\//);
  await expect(page.getByText('Participation is currently unavailable for this event.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Register' })).toHaveCount(0);

  await logout(page);
});
