const { test, expect } = require('@playwright/test');
const { login } = require('../utils/auth');

test('browse events blocks invalid date-range search before request', async ({ page }) => {
  await login(
    page,
    process.env.TEST_PARTICIPANT_EMAIL || 'participant+overnight@example.com',
    process.env.TEST_PARTICIPANT_PASSWORD || 'Participant#123'
  );

  await page.goto('/participant/events');
  await expect(page.locator('body')).toContainText('Browse Events');
  await expect(page.getByText('Seeded Overnight Published Event').first()).toBeVisible();

  let invalidRangeRequests = 0;
  page.on('request', (request) => {
    const url = request.url();
    if (
      url.includes('/api/events?') &&
      url.includes('from=2026-12-31') &&
      url.includes('to=2026-01-01')
    ) {
      invalidRangeRequests += 1;
    }
  });

  await page.locator('#browse-from').fill('2026-12-31');
  await page.locator('#browse-to').fill('2026-01-01');
  await page.getByRole('button', { name: 'Search' }).click();

  await expect(page.getByText('to must be greater than or equal to from')).toBeVisible();
  await expect(page.getByText('Seeded Overnight Published Event').first()).toBeVisible();
  expect(invalidRangeRequests).toBe(0);
});
