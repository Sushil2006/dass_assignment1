const { test, expect } = require('@playwright/test');
const { login, logout } = require('../utils/auth');

test('organizer cannot decrease registration limit on published event', async ({ page }) => {
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
  await expect(page.getByText(/Published events only allow updating/i)).toBeVisible();

  const regLimitField = page.getByLabel('Reg Limit');
  const originalValueRaw = await regLimitField.inputValue();
  const originalValue = Number(originalValueRaw);
  expect(Number.isFinite(originalValue)).toBeTruthy();
  expect(originalValue).toBeGreaterThan(1);

  const reducedValue = String(originalValue - 1);
  await regLimitField.fill(reducedValue);
  await page.getByRole('button', { name: /Save changes/i }).click();

  await expect(page.getByText(/registration limit can only increase/i)).toBeVisible();
  await expect(page.getByText('Event updated successfully.')).toHaveCount(0);
  await expect(regLimitField).toHaveValue(reducedValue);

  await page.getByLabel('Close').click();
  await publishedEventCard.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByLabel('Reg Limit')).toHaveValue(String(originalValue));
  await page.getByLabel('Close').click();

  await logout(page);
});
