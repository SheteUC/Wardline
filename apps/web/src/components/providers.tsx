"use client";

import type { ReactNode } from "react";
import { QueryProvider } from "@/lib/query-provider";
import { WardlineErrorBoundary } from "./error-boundary";
import { PostHogProvider } from "./posthog-provider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <PostHogProvider>
        <WardlineErrorBoundary>{children}</WardlineErrorBoundary>
      </PostHogProvider>
    </QueryProvider>
  );
}
