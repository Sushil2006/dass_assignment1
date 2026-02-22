const { test, expect } = require('@playwright/test');
const { login, logout, uniqueEmail } = require('../utils/auth');

function futureDateTimeLocal(daysAhead, hour) {
  const now = new Date();
  const value = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  value.setHours(hour, 0, 0, 0);
  const tzOffsetMs = value.getTimezoneOffset() * 60 * 1000;
  const local = new Date(value.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 16);
}

test('admin creates organizer; organizer logs in and creates draft event', async ({ page }) => {
  const adminEmail = process.env.TEST_ADMIN_EMAIL || 'admin@iiit.ac.in';
  const adminPassword = process.env.TEST_ADMIN_PASSWORD || 'admin123';

  const organizerName = `Organizer ${Date.now()}`;

  await login(page, adminEmail, adminPassword);
  await expect(page).toHaveURL(/\/admin/);
  await page.goto('/admin');
  await expect(page.locator('body')).toContainText('Admin Home');
  await page.getByRole('link', { name: /Manage (Clubs\/)?Organizers/i }).first().click();
  await expect(page.locator('body')).toContainText('Manage Organizers');

  const createForm = page.locator('form').filter({ hasText: 'Create organizer' }).first();
  await createForm.getByLabel('Name').fill(organizerName);
  await page.getByRole('button', { name: /Create organizer/i }).click();

  await expect(page.getByText('Organizer created successfully')).toBeVisible();

  const bodyText = await page.locator('body').innerText();
  const emailMatch = bodyText.match(/Email:\s*([^\s]+)/);
  const match = bodyText.match(/Password:\s*([^\s]+)/);
  expect(emailMatch, 'Expected generated email in admin UI').toBeTruthy();
  expect(match, 'Expected generated password in admin UI').toBeTruthy();
  const organizerEmail = emailMatch[1];
  const organizerPassword = match[1];

  await logout(page);

  await login(page, organizerEmail, organizerPassword);
  await expect(page.locator('body')).toContainText('Organizer Dashboard');

  await page.getByRole('button', { name: 'Profile' }).click();
  await page.getByLabel('Discord Webhook URL').fill('not-a-valid-url');
  await page.getByRole('button', { name: /Save profile/i }).click();
  await expect(page.getByText(/Invalid request/i)).toBeVisible();

  await page.getByLabel('Discord Webhook URL').fill('https://discord.com/api/webhooks/test/test');
  await page.getByRole('button', { name: /Save profile/i }).click();
  await expect(page.getByText(/Profile updated successfully/i)).toBeVisible();

  await page.goto('/organizer/events/new');
  await expect(page.locator('body')).toContainText('Create Event Wizard');

  const eventName = `Overnight E2E ${Date.now()}`;

  await page.getByLabel('Event Name').fill(eventName);
  await page.getByLabel('Description').fill('Created by overnight automation suite');
  await page.getByLabel('Tags (comma separated)').fill('automation,e2e');
  await page.getByLabel('Eligibility').fill('all');
  await page.getByLabel('Reg Fee').fill('0');
  await page.getByLabel('Reg Limit').fill('50');
  await page.getByLabel('Registration Deadline').fill(futureDateTimeLocal(2, 11));
  await page.getByLabel('Start Date').fill(futureDateTimeLocal(4, 11));
  await page.getByLabel('End Date').fill(futureDateTimeLocal(5, 11));

  await page.getByRole('button', { name: /Create draft event/i }).click();
  await expect(page.getByText(/Draft event created successfully/i)).toBeVisible();

  await logout(page);
});
