import { validateEnv, webEnvSchema } from "@wardline/config";

const fallbackWebBaseUrl =
  process.env.NEXT_PUBLIC_WEB_BASE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined) ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
  "http://localhost:3000";

const fallbackApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_CORE_API_URL ||
  "http://localhost:3001";

export const webEnv = validateEnv(webEnvSchema, {
  ...process.env,
  NEXT_PUBLIC_WEB_BASE_URL: fallbackWebBaseUrl,
  NEXT_PUBLIC_API_BASE_URL: fallbackApiBaseUrl,
});
