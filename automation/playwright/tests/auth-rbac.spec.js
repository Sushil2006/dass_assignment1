const { test, expect } = require('@playwright/test');
const { login, logout, gotoLogin, uniqueEmail } = require('../utils/auth');

test('unauthenticated users are redirected from protected routes', async ({ page }) => {
  await page.goto('/participant');
  await expect(page).toHaveURL(/\/login/);

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);

  await page.goto('/organizer');
  await expect(page).toHaveURL(/\/login/);
});

test('invalid login shows error', async ({ page }) => {
  await gotoLogin(page);
  await page.getByLabel('Email').fill('nope@example.com');
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Invalid credentials')).toBeVisible();
});

test('participant signup works and role-based route guards hold', async ({ page }) => {
  const email = uniqueEmail('signup');

  await page.goto('/signup');
  await expect(page.locator('body')).toContainText('Create participant account');

  await page.getByLabel('First Name').fill('Flow');
  await page.getByLabel('Last Name').fill('Tester');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('Participant#123');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/participant/);
  await expect(page.locator('body')).toContainText('Participant Dashboard');

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/participant/);

  await page.goto('/organizer');
  await expect(page).toHaveURL(/\/participant/);

  await logout(page);
});

test('seeded participant can login and access profile', async ({ page }) => {
  await login(
    page,
    process.env.TEST_PARTICIPANT_EMAIL || 'participant+overnight@example.com',
    process.env.TEST_PARTICIPANT_PASSWORD || 'Participant#123'
  );

  await expect(page.locator('body')).toContainText('Participant Dashboard');

  await page.goto('/participant/profile');
  await expect(page.locator('body')).toContainText('Participant Profile');

  await logout(page);
});
