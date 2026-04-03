"use client";

import { Suspense, useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PostHogReactProvider } from "posthog-js/react";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthog.__loaded) {
      return;
    }

    posthog.capture("$pageview", {
      $current_url: window.location.href,
      pathname,
      search: searchParams.toString(),
    });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  const initialized = useRef(false);
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com";

  useEffect(() => {
    if (initialized.current || !apiKey || process.env.NODE_ENV === "test") {
      return;
    }

    posthog.init(apiKey, {
      api_host: apiHost,
      capture_pageview: false,
      capture_pageleave: true,
      person_profiles: "identified_only",
    });

    initialized.current = true;
  }, [apiHost, apiKey]);

  if (!apiKey || process.env.NODE_ENV === "test") {
    return <>{children}</>;
  }

  return (
    <PostHogReactProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PostHogReactProvider>
  );
}
