import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

type LegalDocumentPageProps = {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
};

export function LegalDocumentPage({
  eyebrow,
  title,
  summary,
  children,
}: LegalDocumentPageProps) {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-20 lg:px-12">
        <div className="rounded-[36px] bg-[var(--background)] p-8 neo-raised sm:p-10">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            {title}
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {summary}
          </p>
          <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground sm:text-base">
            {children}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
