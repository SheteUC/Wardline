import Link from "next/link";
import { Phone, Linkedin, Twitter } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="bg-[var(--background)] shadow-[0px_-4px_10px_0px_rgba(0,0,0,0.02)]">
      <div className="mx-auto max-w-[1280px] px-6 py-16 lg:px-12">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[var(--background)] neo-raised">
                <Phone className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-lg font-extrabold tracking-tight text-foreground">
                Wardline
              </span>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              AI voice receptionist for medical and dental clinics—24/7 scheduling,
              FAQs, billing, insurance, and refills with safe human handoff.
            </p>
          </div>
          <div>
            <h4 className="mb-4 text-base font-extrabold text-foreground">Product</h4>
            <ul className="space-y-3 text-sm font-medium text-muted-foreground">
              <li>
                <Link href="/features" className="hover:text-foreground transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-foreground transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/sign-up" className="hover:text-foreground transition-colors">
                  Start free trial
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="mb-4 text-base font-extrabold text-foreground">Contact</h4>
            <ul className="space-y-3 text-sm font-medium text-muted-foreground">
              <li>
                <Link href="/contact" className="hover:text-foreground transition-colors">
                  Get in touch
                </Link>
              </li>
              <li>
                <a
                  href="mailto:hello@wardline.health"
                  className="hover:text-foreground transition-colors"
                >
                  hello@wardline.health
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-6 border-t border-[#dcdee4] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-muted-foreground">
            © {new Date().getFullYear()} Wardline Health, Inc. All rights reserved.
          </p>
          <div className="flex gap-3">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--background)] text-muted-foreground neo-raised transition-colors hover:text-primary"
              aria-label="Twitter"
            >
              <Twitter className="h-4 w-4" />
            </a>
            <a
              href="https://linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--background)] text-muted-foreground neo-raised transition-colors hover:text-primary"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
