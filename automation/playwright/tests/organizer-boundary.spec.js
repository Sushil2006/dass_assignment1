const { test, expect } = require('@playwright/test');
const { login, logout } = require('../utils/auth');

function futureDateTimeLocal(daysAhead, hour) {
  const now = new Date();
  const value = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  value.setHours(hour, 0, 0, 0);
  const tzOffsetMs = value.getTimezoneOffset() * 60 * 1000;
  const local = new Date(value.getTime() - tzOffsetMs);
  return local.toISOString().slice(0, 16);
}

test('organizer cannot create event when end date is before start date', async ({ page }) => {
  const organizerEmail =
    process.env.TEST_ORGANIZER_EMAIL || 'organizer+overnight@example.com';
  const organizerPassword =
    process.env.TEST_ORGANIZER_PASSWORD || 'Organizer#123';

  await login(page, organizerEmail, organizerPassword);
  await expect(page.locator('body')).toContainText('Organizer Dashboard');

  await page.goto('/organizer/events/new');
  await expect(page.locator('body')).toContainText('Create Event Wizard');

  await page.getByLabel('Event Name').fill(`Invalid Dates ${Date.now()}`);
  await page.getByLabel('Description').fill('Boundary validation check');
  await page.getByLabel('Tags (comma separated)').fill('boundary,validation');
  await page.getByLabel('Eligibility').fill('all');
  await page.getByLabel('Reg Fee').fill('0');
  await page.getByLabel('Reg Limit').fill('10');
  await page.getByLabel('Registration Deadline').fill(futureDateTimeLocal(2, 10));
  await page.getByLabel('Start Date').fill(futureDateTimeLocal(4, 10));
  await page.getByLabel('End Date').fill(futureDateTimeLocal(3, 10));

  await page.getByRole('button', { name: /Create draft event/i }).click();
  await expect(page.getByText(/endDate must be after startDate/i)).toBeVisible();
  await expect(page.getByText(/Draft event created successfully/i)).toHaveCount(0);

  await logout(page);
});
