"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };

type State = { error: Error | null };

/**
 * Catches render errors in the tree below Providers (inside root layout).
 * Next.js `error.tsx` files handle route-segment errors; this covers gaps above nested error boundaries.
 */
export class WardlineErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[WardlineErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex min-h-[40vh] max-w-md flex-col justify-center gap-4 px-6 py-16">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground text-sm">
            {this.state.error.message || "An unexpected error occurred in the app shell."}
          </p>
          <button
            type="button"
            className="bg-primary text-primary-foreground inline-flex w-fit rounded-md px-4 py-2 text-sm font-medium"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
