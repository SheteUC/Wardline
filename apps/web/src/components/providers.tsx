"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { QueryProvider } from "@/lib/query-provider";
import { WardlineErrorBoundary } from "./error-boundary";
import { PostHogProvider } from "./posthog-provider";

type ProvidersProps = {
  children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <QueryProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <PostHogProvider>
          <WardlineErrorBoundary>{children}</WardlineErrorBoundary>
        </PostHogProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
