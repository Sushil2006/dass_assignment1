const { test, expect } = require('@playwright/test');
const { uniqueEmail } = require('../utils/auth');

function futureIso(daysAhead, hour) {
  const value = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  value.setHours(hour, 0, 0, 0);
  return value.toISOString();
}

test('participant can re-register after cancelling a prior registration', async ({ page, request }) => {
  const organizerEmail = process.env.TEST_ORGANIZER_EMAIL || 'organizer+overnight@example.com';
  const organizerPassword = process.env.TEST_ORGANIZER_PASSWORD || 'Organizer#123';
  const apiBaseUrl = process.env.API_URL || 'http://127.0.0.1:4100';

  const organizerLogin = await request.post(`${apiBaseUrl}/api/auth/login`, {
    data: {
      email: organizerEmail,
      password: organizerPassword,
    },
  });
  expect(organizerLogin.ok()).toBeTruthy();

  const eventName = `Cancel ReRegister ${Date.now()}`;
  const createEvent = await request.post(`${apiBaseUrl}/api/events/organizer`, {
    data: {
      name: eventName,
      description: 'Event for cancellation and re-registration boundary coverage',
      type: 'NORMAL',
      tags: ['qa', 'boundary'],
      eligibility: 'all',
      regFee: 0,
      regLimit: 25,
      regDeadline: futureIso(2, 11),
      startDate: futureIso(5, 11),
      endDate: futureIso(6, 11),
      normalForm: {
        fields: [
          {
            key: 'fullName',
            label: 'Full Name',
            type: 'text',
            required: true,
            order: 0,
          },
        ],
        isFormLocked: true,
      },
    },
  });
  expect(createEvent.status()).toBe(201);

  const createData = await createEvent.json();
  const eventId = createData.event?.id;
  expect(eventId).toBeTruthy();

  const publishEvent = await request.patch(`${apiBaseUrl}/api/events/organizer/${eventId}/status`, {
    data: { status: 'PUBLISHED' },
  });
  expect(publishEvent.status()).toBe(200);

  await request.post(`${apiBaseUrl}/api/auth/logout`);

  const participantEmail = uniqueEmail('participant-reregister');
  const participantPassword = 'Participant#123';

  await page.goto('/signup');
  await page.getByLabel('First Name').fill('Boundary');
  await page.getByLabel('Last Name').fill('Participant');
  await page.getByLabel('Email').fill(participantEmail);
  await page.getByLabel('Password').fill(participantPassword);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/participant$/);

  await page.goto(`/participant/events/${eventId}`);
  await page.getByLabel('Full Name *').fill('Boundary Participant');

  const [firstRegister] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/participations/register') &&
        response.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Register' }).click(),
  ]);

  expect(firstRegister.status()).toBe(201);
  await expect(page.getByText('Registration submitted and ticket generated.')).toBeVisible();

  await page.goto('/participant/my-events');

  const activeEventCard = page.locator('.card').filter({ hasText: eventName }).first();
  await expect(activeEventCard).toBeVisible();

  const [cancelResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/participations/') &&
        response.url().includes('/cancel') &&
        response.request().method() === 'PATCH',
    ),
    activeEventCard.getByRole('button', { name: 'Cancel' }).click(),
  ]);

  expect(cancelResponse.status()).toBe(200);
  await expect(page.getByText('Participation cancelled.')).toBeVisible();

  await page.goto(`/participant/events/${eventId}`);
  await expect(page.getByRole('button', { name: 'Register' })).toBeVisible();
  await page.getByLabel('Full Name *').fill('Boundary Participant Again');

  const [secondRegister] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/participations/register') &&
        response.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Register' }).click(),
  ]);

  expect(secondRegister.status()).toBe(201);
  await expect(page.getByText('Registration submitted and ticket generated.')).toBeVisible();
});
