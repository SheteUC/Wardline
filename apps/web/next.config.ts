import { existsSync } from "fs";
import { resolve } from "path";
import { config as loadDotenv } from "dotenv";
import type { NextConfig } from "next";

const repoRoot = resolve(__dirname, "../..");
const rootEnvPaths = [resolve(repoRoot, ".env"), resolve(repoRoot, ".env.local")];
const deprecatedWebEnvPaths = [resolve(__dirname, ".env"), resolve(__dirname, ".env.local")];

for (const envPath of rootEnvPaths) {
  if (existsSync(envPath)) {
    loadDotenv({ path: envPath, override: true });
  }
}

const existingDeprecatedWebEnvPaths = deprecatedWebEnvPaths.filter((envPath) => existsSync(envPath));
const shouldWarnOnDeprecatedEnvFiles =
  process.env.WARDLINE_WARN_ON_DEPRECATED_ENV_FILES === "true" ||
  (
    process.env.WARDLINE_WARN_ON_DEPRECATED_ENV_FILES !== "false" &&
    (process.env.NODE_ENV ?? "development") !== "test" &&
    process.env.CI !== "true"
  );

if (shouldWarnOnDeprecatedEnvFiles && existingDeprecatedWebEnvPaths.length > 0) {
  console.warn(
    `[wardline] Deprecated web env file(s) detected: ${existingDeprecatedWebEnvPaths.join(
      ", ",
    )}. These files are ignored; keep runtime values in the repo-root .env.local/.env files instead.`,
  );
}

const isProd = process.env.NODE_ENV === "production";

const nextPublicVoiceRuntimeBase =
  process.env.NEXT_PUBLIC_VOICE_RUNTIME_URL ??
  process.env.NEXT_PUBLIC_VOICE_ORCHESTRATOR_URL ??
  process.env.NEXT_PUBLIC_VOICE_API_URL ??
  "http://localhost:3003";

const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://images.unsplash.com https://*.clerk.com",
  "connect-src 'self' http://localhost:* http://127.0.0.1:* https://*.clerk.accounts.dev https://*.clerk.com wss://*.clerk.accounts.dev https://us.i.posthog.com https://eu.i.posthog.com https://app.posthog.com https://api.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://*.clerk.accounts.dev",
  "worker-src 'self' blob:",
  "form-action 'self'",
  ...(isProd ? (["upgrade-insecure-requests"] as const) : []),
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspDirectives.join("; "),
          },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
    NEXT_PUBLIC_CORE_API_URL:
      process.env.NEXT_PUBLIC_CORE_API_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      "http://localhost:3001",
    NEXT_PUBLIC_VOICE_RUNTIME_URL: nextPublicVoiceRuntimeBase,
    // Legacy alias: same resolved base URL as NEXT_PUBLIC_VOICE_RUNTIME_URL
    NEXT_PUBLIC_VOICE_ORCHESTRATOR_URL: nextPublicVoiceRuntimeBase,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
  transpilePackages: [
    "@wardline/config",
    "@wardline/db",
    "@wardline/types",
    "@wardline/ui",
    "@wardline/utils",
  ],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;
