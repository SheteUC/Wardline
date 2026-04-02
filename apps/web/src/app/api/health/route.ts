import { NextResponse } from "next/server";

/** Render / load-balancer probe; no auth, no dynamic data. */
export function GET() {
  return NextResponse.json(
    { status: "ok", service: "wardline-web", timestamp: new Date().toISOString() },
    { status: 200 },
  );
}
