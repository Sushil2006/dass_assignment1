const { test, expect } = require('@playwright/test');
const { login, logout, gotoLogin } = require('../utils/auth');

test('disabled organizer cannot log in', async ({ page }) => {
  await login(
    page,
    process.env.TEST_ADMIN_EMAIL || 'admin@iiit.ac.in',
    process.env.TEST_ADMIN_PASSWORD || 'admin123'
  );

  await page.goto('/admin/organizers');
  await expect(page.locator('body')).toContainText('Manage Organizers');

  const organizerName = `Disable Test ${Date.now()}`;
  await page.getByLabel('Name').fill(organizerName);

  const [createResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/organizers') &&
        response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Create organizer' }).click(),
  ]);

  expect(createResponse.status()).toBe(201);
  const createdData = await createResponse.json();
  const organizerEmail = createdData.credentials?.email;
  const organizerPassword = createdData.credentials?.password;

  expect(organizerEmail).toBeTruthy();
  expect(organizerPassword).toBeTruthy();

  const organizerRow = page.locator('tr').filter({ hasText: organizerEmail }).first();
  await expect(organizerRow).toBeVisible();

  const [disableResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/admin/organizers/') &&
        response.url().includes('/disable') &&
        response.request().method() === 'PATCH'
    ),
    organizerRow.getByRole('button', { name: 'Disable' }).click(),
  ]);

  expect(disableResponse.status()).toBe(200);
  await expect(organizerRow).toContainText('Disabled');

  await logout(page);

  await gotoLogin(page);
  await page.getByLabel('Email').fill(organizerEmail);
  await page.getByLabel('Password').fill(organizerPassword);

  const [loginResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/login') &&
        response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Sign in' }).click(),
  ]);

  expect(loginResponse.status()).toBe(403);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('Organizer account is disabled')).toBeVisible();
});
