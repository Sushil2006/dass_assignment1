const { test, expect } = require('@playwright/test');
const { uniqueEmail } = require('../utils/auth');

test('participant with no followed organizers gets no results for followed-clubs-only filter', async ({
  page,
}) => {
  const email = uniqueEmail('participant-follow-filter');
  const password = 'Participant#123';

  await page.goto('/signup');
  await expect(page.locator('body')).toContainText('Create participant account');

  await page.getByLabel('First Name').fill('Filter');
  await page.getByLabel('Last Name').fill('Participant');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/participant$/);

  await page.goto('/participant/events');
  await expect(page.locator('body')).toContainText('Browse Events');
  await expect(page.getByRole('heading', { name: 'All Events' })).toBeVisible();
  await expect(page.getByText('Seeded Overnight Published Event').first()).toBeVisible();

  await page.getByRole('checkbox', { name: /followed clubs only/i }).check();
  await page.getByRole('button', { name: 'Search' }).click();

  await expect(page.getByText('No events match current filters.')).toBeVisible();
});
