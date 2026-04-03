"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 rounded-lg border border-border bg-card p-8 shadow-sm">
      <h1 className="text-lg font-semibold">Dashboard error</h1>
      <p className="text-muted-foreground text-sm">
        {error.message || "We couldn’t load this part of the dashboard."}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm font-medium"
        >
          Retry
        </button>
        <a href="/dashboard" className="border-input rounded-md border px-3 py-2 text-sm font-medium">
          Overview
        </a>
      </div>
    </div>
  );
}
