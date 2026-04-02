/**
 * Core API origin (no version segment). Health lives here: `${CORE_API_ORIGIN}/health`.
 */
export const CORE_API_ORIGIN = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001").replace(
    /\/$/,
    "",
);

/** Versioned API root (Nest URI versioning: /v1/...). */
export const CORE_API_V1 = `${CORE_API_ORIGIN}/v1`;
