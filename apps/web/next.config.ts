import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

