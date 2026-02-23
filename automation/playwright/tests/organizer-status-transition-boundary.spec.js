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

test('organizer cannot complete a non-ongoing published event', async ({ page }) => {
  const organizerEmail =
    process.env.TEST_ORGANIZER_EMAIL || 'organizer+overnight@example.com';
  const organizerPassword =
    process.env.TEST_ORGANIZER_PASSWORD || 'Organizer#123';

  await login(page, organizerEmail, organizerPassword);
  await expect(page).toHaveURL(/\/organizer/);

  await page.goto('/organizer/events/new');
  await expect(page.locator('body')).toContainText('Create Event Wizard');

  const eventName = `Status Boundary ${Date.now()}`;
  await page.getByLabel('Event Name').fill(eventName);
  await page.getByLabel('Description').fill('Status transition boundary regression');
  await page.getByLabel('Tags (comma separated)').fill('qa,status');
  await page.getByLabel('Eligibility').fill('all');
  await page.getByLabel('Reg Fee').fill('0');
  await page.getByLabel('Reg Limit').fill('25');
  await page.getByLabel('Registration Deadline').fill(futureDateTimeLocal(2, 10));
  await page.getByLabel('Start Date').fill(futureDateTimeLocal(4, 10));
  await page.getByLabel('End Date').fill(futureDateTimeLocal(5, 10));

  const [createResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/events/organizer') &&
        response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: /Create draft event/i }).click(),
  ]);

  expect(createResponse.ok()).toBeTruthy();
  const created = await createResponse.json();
  const eventId = created?.event?.id;
  expect(eventId).toBeTruthy();

  const publishResponse = await page.request.patch(
    `/api/events/organizer/${eventId}/status`,
    {
      data: { status: 'PUBLISHED' },
    }
  );
  expect(publishResponse.ok()).toBeTruthy();

  await page.goto('/organizer');
  const lifecycleCard = page
    .locator('.card')
    .filter({ hasText: eventName })
    .filter({ has: page.getByRole('button', { name: 'Close' }) })
    .first();
  await expect(lifecycleCard).toContainText('PUBLISHED');
  await expect(lifecycleCard.getByRole('button', { name: 'Complete' })).toHaveCount(0);

  const completeResponse = await page.request.patch(
    `/api/events/organizer/${eventId}/status`,
    {
      data: { status: 'COMPLETED' },
    }
  );
  expect(completeResponse.status()).toBe(400);
  const completeBody = await completeResponse.json();
  expect(completeBody?.error?.message).toMatch(/ongoing/i);

  const deleteResponse = await page.request.delete(`/api/events/organizer/${eventId}`);
  expect(deleteResponse.ok()).toBeTruthy();

  await logout(page);
});
