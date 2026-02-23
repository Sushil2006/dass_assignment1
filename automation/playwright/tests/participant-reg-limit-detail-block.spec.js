const { test, expect } = require('@playwright/test');
const { login, logout, uniqueEmail } = require('../utils/auth');

function futureIso(daysAhead, hour) {
  const value = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  value.setHours(hour, 0, 0, 0);
  return value.toISOString();
}

test('participant event detail pre-blocks registration when reg limit is exhausted', async ({ page, request }) => {
  const organizerEmail = process.env.TEST_ORGANIZER_EMAIL || 'organizer+overnight@example.com';
  const organizerPassword = process.env.TEST_ORGANIZER_PASSWORD || 'Organizer#123';
  const participantEmail = process.env.TEST_PARTICIPANT_EMAIL || 'participant+overnight@example.com';
  const participantPassword = process.env.TEST_PARTICIPANT_PASSWORD || 'Participant#123';
  const apiBaseUrl = process.env.API_URL || 'http://127.0.0.1:4100';

  const organizerLogin = await request.post(`${apiBaseUrl}/api/auth/login`, {
    data: {
      email: organizerEmail,
      password: organizerPassword,
    },
  });
  expect(organizerLogin.ok()).toBeTruthy();

  const eventName = `RegLimit Exhausted ${Date.now()}`;
  const createEvent = await request.post(`${apiBaseUrl}/api/events/organizer`, {
    data: {
      name: eventName,
      description: 'Boundary regression: registration limit exhausted',
      type: 'NORMAL',
      tags: ['qa', 'capacity'],
      eligibility: 'all',
      regFee: 0,
      regLimit: 1,
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
  const createBody = await createEvent.json();
  const eventId = createBody?.event?.id;
  expect(eventId).toBeTruthy();

  const publishEvent = await request.patch(`${apiBaseUrl}/api/events/organizer/${eventId}/status`, {
    data: { status: 'PUBLISHED' },
  });
  expect(publishEvent.status()).toBe(200);

  await request.post(`${apiBaseUrl}/api/auth/logout`);

  await login(page, participantEmail, participantPassword);
  await page.goto(`/participant/events/${eventId}`);
  await page.getByLabel('Full Name *').fill('Capacity Filler');

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
  await logout(page);

  const secondParticipantEmail = uniqueEmail('participant-reglimit');
  const secondParticipantPassword = 'Participant#123';
  await page.goto('/signup');
  await page.getByLabel('First Name').fill('Second');
  await page.getByLabel('Last Name').fill('Participant');
  await page.getByLabel('Email').fill(secondParticipantEmail);
  await page.getByLabel('Password').fill(secondParticipantPassword);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/participant$/);

  await page.goto(`/participant/events/${eventId}`);
  await expect(page.getByText('Participation is currently unavailable for this event.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Register' })).toHaveCount(0);
});
