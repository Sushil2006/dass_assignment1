const { test, expect } = require('@playwright/test');
const { uniqueEmail } = require('../utils/auth');

test('participant registration success does not show duplicate active-participation alert', async ({ page }) => {
  const email = uniqueEmail('participant-regression');
  const password = 'Participant#123';

  await page.goto('/signup');
  await expect(page.locator('body')).toContainText('Create participant account');

  await page.getByLabel('First Name').fill('Regression');
  await page.getByLabel('Last Name').fill('Participant');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/participant$/);

  await page.goto('/participant/events');
  await expect(page.locator('body')).toContainText('Browse Events');

  const eventCard = page.locator('.card').filter({ hasText: 'Seeded Overnight Published Event' }).first();
  await expect(eventCard).toBeVisible();
  await eventCard.getByRole('button', { name: 'View details' }).click();

  await expect(page).toHaveURL(/\/participant\/events\/.+/);
  await page.getByLabel('Full Name *').fill('Regression Participant');

  const [registerResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/participations/register') &&
        response.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Register' }).click(),
  ]);

  expect(registerResponse.ok()).toBeTruthy();
  await expect(page.getByText('Registration submitted and ticket generated.')).toBeVisible();
  await expect(page.getByText('Ticket generated:')).toBeVisible();
  await expect(page.getByText(/You already have an active participation/i)).toHaveCount(0);
});
