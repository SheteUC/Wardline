"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import messages from "@/i18n/messages/en.json";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const label = messages.shell.theme.toggle;

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => setTheme(nextTheme)}
      className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--background)] text-muted-foreground transition-colors neo-raised hover:text-foreground active:neo-pressed"
    >
      <Moon className="h-4 w-4 dark:hidden" />
      <Sun className="hidden h-4 w-4 dark:block" />
    </button>
  );
}
