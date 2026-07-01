import { test, expect } from '@playwright/test';

test.describe('UI Components', () => {
  test('app shell renders on public pages', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('head')).toBeAttached();
  });

  test('signup page has registration form', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    const submitBtn = page.getByRole('button', { name: /sign up|register|create|get started/i }).first();
    await expect(submitBtn).toBeVisible();
  });

  test('page title is correct', async ({ page }) => {
    await page.goto('/login');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
