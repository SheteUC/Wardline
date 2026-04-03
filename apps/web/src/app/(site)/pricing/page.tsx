import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { JsonLd } from "@/components/json-ld";
import { createMarketingMetadata } from "@/lib/metadata";

const TIERS = [
  {
    name: "Starter",
    description: "Single-location family medicine practices getting started with AI voice.",
    price: "Custom",
    highlight: false,
    features: [
      "Practice Setup for scheduling, billing, insurance, FAQ, and refill handling",
      "Wardline-managed runtime behavior compiled from practice settings",
      "Call logs, voicemail inbox, and follow-up queue",
      "Configurable safety keywords and emergency escalation",
      "Email support",
    ],
  },
  {
    name: "Professional",
    description: "Growing clinics that need deeper policy control and live integrations.",
    price: "Custom",
    highlight: true,
    features: [
      "Everything in Starter",
      "Human transfer and voicemail when staff are unavailable",
      "Integration credentials per service category",
      "Business settings and team roles",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    description: "Organizations with compliance, rollout, and custom deployment needs.",
    price: "Let's talk",
    highlight: false,
    features: [
      "Everything in Professional",
      "HIPAA-aligned architecture with vendor BAA planning",
      "Audit-friendly call history and safety events",
      "Custom integration guidance",
      "Dedicated success contact",
    ],
  },
] as const;

export const metadata: Metadata = createMarketingMetadata({
  title: "Wardline Pricing",
  description:
    "Review Wardline pricing tiers for practices that need AI receptionist coverage, operations queues, and integrations.",
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SiteHeader />

      <main>
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Wardline Pricing",
            url: "https://wardline.health/pricing",
            description:
              "Pricing overview for Wardline medical practice call operations.",
          }}
        />
        <section className="mx-auto max-w-3xl px-6 pb-12 pt-20 text-center lg:px-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Wardline is billed as a subscription. Every plan includes the voice runtime,
            core API, and dashboard. Practices configure hours, policies, integrations,
            and FAQs without writing code.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20 lg:px-12">
          <div className="grid gap-8 lg:grid-cols-3">
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className={`flex flex-col rounded-3xl bg-[var(--background)] p-8 neo-raised ${
                  tier.highlight ? "ring-2 ring-primary/30" : ""
                }`}
              >
                {tier.highlight && (
                  <span className="mb-4 inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    Most popular
                  </span>
                )}
                <h2 className="text-xl font-extrabold text-foreground">{tier.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{tier.description}</p>
                <p className="mt-6 text-3xl font-extrabold text-foreground">{tier.price}</p>
                <ul className="mt-8 flex-1 space-y-3 text-sm text-muted-foreground">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Check className="h-3 w-3" />
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/contact"
                  className={`mt-8 inline-flex items-center justify-center rounded-2xl px-6 py-3 text-center text-sm font-bold transition-colors ${
                    tier.highlight
                      ? "bg-primary text-white neo-raised hover:bg-primary/90"
                      : "bg-[var(--background)] text-primary neo-raised active:neo-pressed"
                  }`}
                >
                  Talk to sales
                </Link>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-12 max-w-3xl rounded-3xl bg-[var(--background)] p-8 neo-inset">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-extrabold text-foreground">What you are running on</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Practice Setup-driven voice runtime / Twilio / realtime speech stack / NestJS core API / Next.js dashboard
                </p>
              </div>
              <Link
                href="/features"
                className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-[var(--background)] px-5 py-2.5 text-sm font-bold text-primary neo-raised"
              >
                Explore features
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
