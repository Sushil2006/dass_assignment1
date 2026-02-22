const { expect } = require('@playwright/test');

async function gotoLogin(page) {
  await page.goto('/login');
  await expect(page.locator('body')).toContainText('Login');
}

async function login(page, email, password) {
  await gotoLogin(page);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);

  const [loginResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes('/api/auth/login') &&
        response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Sign in' }).click(),
  ]);

  if (!loginResponse.ok()) {
    throw new Error(`Login failed with status ${loginResponse.status()}`);
  }

  await page.waitForURL((url) => !url.pathname.endsWith('/login'), {
    timeout: 15_000,
  });
}

async function logout(page) {
  const logoutButton = page.getByRole('button', { name: 'Logout' });
  if (await logoutButton.count()) {
    await logoutButton.click();
    await expect(page).toHaveURL(/\/login/);
    return;
  }

  const logoutLink = page.getByRole('link', { name: 'Logout' });
  if (await logoutLink.count()) {
    await logoutLink.first().click();
    await expect(page).toHaveURL(/\/login/);
  }
}

function uniqueEmail(prefix = 'e2e') {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 7);
  return `${prefix}+${ts}-${rand}@example.com`;
}

module.exports = {
  gotoLogin,
  login,
  logout,
  uniqueEmail,
};
