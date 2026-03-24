import Link from "next/link";
import { Check } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const TIERS = [
  {
    name: "Starter",
    description: "Single location practices getting started with AI voice.",
    price: "Custom",
    highlight: false,
    features: [
      "5 starter agents (scheduling, billing, insurance, FAQ, Rx refill)",
      "Visual call flow editor (13 node types)",
      "Call logs & voicemail inbox",
      "Configurable safety keywords + emergency escalation",
      "Email support",
    ],
  },
  {
    name: "Professional",
    description: "Growing clinics that need full workflow control and integrations.",
    price: "Custom",
    highlight: true,
    features: [
      "Everything in Starter",
      "Human transfer & voicemail when staff unavailable",
      "Tool credentials per agent (scheduling, EHR, etc.)",
      "Business settings & team roles",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    description: "Health systems with compliance, scale, and custom rollout needs.",
    price: "Let's talk",
    highlight: false,
    features: [
      "Everything in Professional",
      "HIPAA-aligned architecture (BAA with vendors)",
      "Audit-friendly call history & safety events",
      "Custom integrations & deployment guidance",
      "Dedicated success contact",
    ],
  },
] as const;

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-3xl px-6 pt-20 pb-12 text-center lg:px-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Wardline is billed as a subscription (via Stripe). Every plan includes the
            voice orchestrator, core API, and dashboard—configure agents and call flows
            without writing code.
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
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Check className="h-3 w-3" />
                      </span>
                      <span>{f}</span>
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
                <h3 className="font-extrabold text-foreground">What you&apos;re running on</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pipecat voice orchestrator · Azure Speech & OpenAI · Twilio · NestJS core API ·
                  Next.js dashboard
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
