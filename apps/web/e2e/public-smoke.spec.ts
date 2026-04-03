import { expect, test } from '@playwright/test';

test('marketing landing page loads and links into contact', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Wardline for Family Medicine Practices \| Wardline/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /Configure practice policy once and let Wardline run AI voice call handling/i,
  );

  await expect(
    page.getByRole('heading', {
      name: 'The AI voice receptionist your practice can actually run.',
    }),
  ).toBeVisible();

  await page.getByRole('link', { name: 'Contact' }).first().click();

  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByRole('heading', { name: 'Get in touch' })).toBeVisible();
});

test('theme toggle persists a dark-mode selection', async ({ page }) => {
  await page.goto('/');

  const toggle = page.getByRole('button', { name: 'Toggle theme' });
  await toggle.click();

  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('button', { name: 'Toggle theme' })).toBeVisible();

  await page.reload();

  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('contact form submits and shows a success state', async ({ page }) => {
  await page.goto('/contact');

  await page.getByLabel('Full name *').fill('Jordan Rivera');
  await page.getByLabel('Work email *').fill('jordan@example.com');
  await page.getByLabel('Practice / org').fill('Wardline Family Medicine');
  await page.getByLabel('Topic *').selectOption('demo');
  await page
    .getByLabel('Message *')
    .fill('We want to see how Wardline handles after-hours call volume.');

  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByRole('status')).toContainText("Thanks - we'll get back to you shortly.");
});
