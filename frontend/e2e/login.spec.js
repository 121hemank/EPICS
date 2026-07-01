import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('displays login form', async ({ page }) => {
    await expect(page.locator('h2, h1').first()).toBeVisible();
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in|login|log in/i }).first()).toBeVisible();
  });

  test('shows error for empty form submission', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: /sign in|login|log in/i }).first();
    await submitBtn.click();
    const errorMsg = page.locator('.field-error, .error, [class*="error"]').first();
    await expect(errorMsg).toBeVisible();
  });

  test('has link to signup page', async ({ page }) => {
    const signupLink = page.getByRole('link', { name: /sign up|register|create/i }).first();
    await expect(signupLink).toBeVisible();
    await signupLink.click();
    await expect(page).toHaveURL(/signup|register/);
  });

  test('inputs accept text', async ({ page }) => {
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    await emailInput.fill('test@example.com');
    await passwordInput.fill('password123');
    await expect(emailInput).toHaveValue('test@example.com');
    await expect(passwordInput).toHaveValue('password123');
  });
});
