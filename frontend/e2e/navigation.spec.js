import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/login/);
  });

  test('redirects to login for protected routes', async ({ page }) => {
    const protectedRoutes = ['/customers', '/leads', '/vendors', '/pipeline', '/analytics', '/settings'];
    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/login/);
    }
  });

  test('login page is accessible without auth', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
    const loginContent = page.locator('form, input, button');
    await expect(loginContent.first()).toBeVisible();
  });

  test('signup page is accessible without auth', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('body')).toBeVisible();
  });
});
