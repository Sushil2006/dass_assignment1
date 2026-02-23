const { test, expect } = require('@playwright/test');
const { login, logout } = require('../utils/auth');

test('organizer can update published event description with limited payload', async ({ page }) => {
  const organizerEmail =
    process.env.TEST_ORGANIZER_EMAIL || 'organizer+overnight@example.com';
  const organizerPassword =
    process.env.TEST_ORGANIZER_PASSWORD || 'Organizer#123';
  const seededPublishedEventName = 'Seeded Overnight Published Event';

  await login(page, organizerEmail, organizerPassword);
  await expect(page).toHaveURL(/\/organizer/);

  await page.goto('/organizer');
  await expect(page.locator('body')).toContainText('Organizer Dashboard');

  const publishedEventCard = page
    .locator('.card.h-100.border')
    .filter({ hasText: seededPublishedEventName })
    .filter({ has: page.getByRole('button', { name: 'Edit' }) })
    .first();
  await expect(publishedEventCard).toBeVisible();
  await expect(publishedEventCard).toContainText('PUBLISHED');
  await publishedEventCard.getByRole('button', { name: 'Edit' }).click();

  await expect(page.getByText(/Published events only allow updating description/i)).toBeVisible();
  await expect(page.getByLabel('Event Name')).toBeDisabled();
  await expect(page.getByLabel('Start Date')).toBeDisabled();

  const description = `Published edit regression ${Date.now()}`;
  await page.getByLabel('Description').fill(description);

  const [patchResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/events/organizer/') &&
        response.request().method() === 'PATCH'
    ),
    page.getByRole('button', { name: /Save changes/i }).click(),
  ]);

  expect(patchResponse.ok()).toBeTruthy();
  const payload = patchResponse.request().postDataJSON();
  expect(Object.keys(payload).sort()).toEqual(['description']);
  expect(payload.description).toBe(description);

  await expect(page.getByText('Event updated successfully.')).toBeVisible();
  await expect(page.locator('body')).toContainText(description);

  await logout(page);
});
