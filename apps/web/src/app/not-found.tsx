import Link from 'next/link';

/** Minimal 404 UI (no Tailwind) to avoid prerender issues with the CSS pipeline on this route. */
export default function NotFound() {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <p style={{ fontSize: "1.125rem", fontWeight: 600 }}>Page not found</p>
      <p style={{ color: "#555", marginBottom: "1rem" }}>The page you requested does not exist.</p>
      <Link href="/" style={{ color: "#111", textDecoration: "underline" }}>
        Back to home
      </Link>
    </div>
  );
}
