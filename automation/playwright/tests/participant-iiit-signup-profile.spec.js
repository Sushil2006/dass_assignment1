const { test, expect } = require('@playwright/test');
const { logout } = require('../utils/auth');

function uniqueIiitEmail() {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  return `iiit-${ts}-${rand}@iiit.ac.in`;
}

test('iiit-domain signup is classified as iiit participant and onboarding can be completed', async ({
  page,
}) => {
  const email = uniqueIiitEmail();

  await page.goto('/signup');
  await expect(page.locator('body')).toContainText('Create participant account');

  await page.getByLabel('First Name').fill('Iiit');
  await page.getByLabel('Last Name').fill('Edge');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Participant#123');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/participant/);

  await page.goto('/participant/profile');
  await expect(page.getByLabel('Email (read-only)')).toHaveValue(email);
  await expect(page.getByLabel('Participant Type (read-only)')).toHaveValue('iiit');

  await page.getByRole('button', { name: /Save Onboarding/i }).click();
  await expect(page.getByText(/Onboarding preferences saved/i)).toBeVisible();
  await expect(page.locator('body')).toContainText('Status: completed');

  await logout(page);
});
