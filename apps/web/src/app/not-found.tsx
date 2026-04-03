import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="w-full rounded-[32px] bg-[var(--background)] p-10 neo-raised">
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">
          Not Found
        </p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-foreground">
          This page does not exist.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          The URL may be wrong, or the page may have moved.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-2xl bg-[var(--background)] px-6 py-3 text-sm font-bold text-primary neo-raised active:neo-pressed"
          >
            Return home
          </Link>
        </div>
      </div>
    </main>
  );
}
