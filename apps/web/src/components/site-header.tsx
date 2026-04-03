"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Phone } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import messages from "@/i18n/messages/en.json";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const t = messages.shell;
  const nav = [
    { href: "/features", label: t.navigation.features },
    { href: "/pricing", label: t.navigation.pricing },
    { href: "/contact", label: t.navigation.contact },
  ] as const;

  return (
    <header className="sticky top-0 z-50 bg-[var(--background)] shadow-[0px_4px_10px_0px_rgba(0,0,0,0.03)]">
      <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between gap-4 px-6 lg:px-12">
        <Link href="/" className="flex min-w-0 items-center gap-3 shrink-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-3xl bg-[var(--background)] neo-raised">
            <Phone className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="flex min-w-0 flex-col leading-none">
            <span className="text-lg font-extrabold tracking-tight text-foreground">
              {t.brand}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t.tagline}
            </span>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm font-semibold lg:text-base">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap pb-1.5 border-b-2 transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            href="/sign-in"
            className="hidden rounded-2xl px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            {t.navigation.login}
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-3xl bg-[var(--background)] px-4 py-2.5 text-sm font-bold text-primary neo-raised active:neo-pressed sm:px-6"
          >
            {t.navigation.getStarted}
          </Link>
        </div>
      </div>

      <nav
        className="flex gap-6 overflow-x-auto border-t border-border/50 px-6 py-3 md:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Primary"
      >
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 text-sm font-semibold whitespace-nowrap pb-1 border-b-2 transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
