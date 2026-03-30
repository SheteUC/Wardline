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

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001",
    NEXT_PUBLIC_CORE_API_URL:
      process.env.NEXT_PUBLIC_CORE_API_URL ??
      process.env.NEXT_PUBLIC_API_BASE_URL ??
      "http://localhost:3001",
    NEXT_PUBLIC_VOICE_ORCHESTRATOR_URL:
      process.env.NEXT_PUBLIC_VOICE_ORCHESTRATOR_URL ??
      process.env.NEXT_PUBLIC_VOICE_API_URL ??
      "http://localhost:3003",
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
