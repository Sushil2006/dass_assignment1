const { test, expect } = require('@playwright/test');
const { login, logout } = require('../utils/auth');

test('participant cannot mutate read-only profile fields', async ({ page }) => {
  const participantEmail = process.env.TEST_PARTICIPANT_EMAIL || 'participant+overnight@example.com';
  const participantPassword = process.env.TEST_PARTICIPANT_PASSWORD || 'Participant#123';
  const apiBaseUrl = process.env.API_URL || 'http://127.0.0.1:4100';

  await login(page, participantEmail, participantPassword);
  await page.goto('/participant/profile');

  const emailInput = page.getByLabel('Email (read-only)');
  const participantTypeInput = page.getByLabel('Participant Type (read-only)');
  await expect(emailInput).toBeDisabled();
  await expect(participantTypeInput).toBeDisabled();

  const beforeResponse = await page.request.get(`${apiBaseUrl}/api/participants/me/profile`);
  expect(beforeResponse.ok()).toBeTruthy();
  const beforeProfile = (await beforeResponse.json()).profile;

  const patchResponse = await page.request.patch(`${apiBaseUrl}/api/participants/me/profile`, {
    data: {
      email: 'attacker@example.com',
      participantType: 'iiit',
    },
  });

  expect(patchResponse.ok()).toBeFalsy();
  expect(patchResponse.status()).toBe(400);

  const afterResponse = await page.request.get(`${apiBaseUrl}/api/participants/me/profile`);
  expect(afterResponse.ok()).toBeTruthy();
  const afterProfile = (await afterResponse.json()).profile;

  expect(afterProfile.email).toBe(beforeProfile.email);
  expect(afterProfile.participantType).toBe(beforeProfile.participantType);

  await logout(page);
});
