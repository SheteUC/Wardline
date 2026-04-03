import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./locale";

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale,
  localePrefix: "as-needed",
});
