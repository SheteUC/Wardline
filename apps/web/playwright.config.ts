import { defineConfig, devices } from '@playwright/test';

const port = 3000;
const host = "localhost";
const baseURL = `http://${host}:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm dev --hostname ${host} --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      NODE_ENV: 'development',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? 'pk_test_playwright',
      CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY ?? 'sk_test_playwright',
      NEXT_PUBLIC_WEB_BASE_URL: process.env.NEXT_PUBLIC_WEB_BASE_URL ?? baseURL,
      NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001',
      NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '',
      NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://app.posthog.com',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? 'pk_test_playwright',
    },
  },
});
