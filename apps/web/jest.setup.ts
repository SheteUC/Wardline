import "@testing-library/jest-dom";
import type { ReactNode } from "react";

Object.assign(process.env, {
  NODE_ENV: process.env.NODE_ENV || "test",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "pk_test_wardline",
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "sk_test_wardline",
  NEXT_PUBLIC_WEB_BASE_URL: process.env.NEXT_PUBLIC_WEB_BASE_URL || "http://localhost:3000",
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001",
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

jest.mock("next/navigation", () => ({
  __esModule: true,
  usePathname: jest.fn(() => "/"),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  })),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useParams: jest.fn(() => ({})),
}));

jest.mock("next-themes", () => ({
  __esModule: true,
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: jest.fn(() => ({
    resolvedTheme: "light",
    setTheme: jest.fn(),
  })),
}));
