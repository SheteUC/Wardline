"use client";

import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {error.message || "This page hit an unexpected error. Try again or return to the dashboard."}
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="bg-primary text-primary-foreground inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="border-input inline-flex items-center justify-center rounded-md border bg-transparent px-4 py-2 text-sm font-medium"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
