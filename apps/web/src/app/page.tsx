import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Calendar,
  Check,
  ClipboardList,
  Clock,
  Phone,
  PlugZap,
  Shield,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

function PracticeSetupPreview() {
  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-[36px]" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-accent/10 blur-[36px]" />

      <div className="relative rounded-[36px] border border-white/40 bg-[var(--background)] p-6 neo-raised sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500/40" />
            <span className="h-3 w-3 rounded-full bg-primary/40" />
            <span className="h-3 w-3 rounded-full bg-accent/40" />
          </div>
          <span className="rounded-2xl bg-[var(--background)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground neo-inset">
            Practice Setup
          </span>
        </div>

        <div className="grid gap-4">
          <div className="rounded-3xl bg-[var(--background)] p-4 neo-inset">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--background)] neo-raised">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Hours
                </p>
                <p className="text-sm font-bold text-foreground">
                  Mon-Fri, 9:00 AM to 5:00 PM
                </p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              After-hours urgent calls become priority voicemail plus staff follow-up.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-[var(--background)] p-4 neo-raised">
              <div className="mb-2 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Services
                </span>
              </div>
              <p className="text-sm font-bold text-foreground">
                Appointments, refills, insurance, billing
              </p>
            </div>
            <div className="rounded-3xl bg-[var(--background)] p-4 neo-raised">
              <div className="mb-2 flex items-center gap-2">
                <PlugZap className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Integrations
                </span>
              </div>
              <p className="text-sm font-bold text-foreground">
                Live connector health is ready for calls
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-[var(--background)] p-5 neo-inset">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--background)] neo-raised">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  Live runtime
                </p>
                <p className="text-sm font-bold text-foreground">
                  Wardline handles the call flow behind the scenes
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                "Screen emergencies first",
                "Confirm write actions before submitting",
                "Create follow-up tasks when live actions fail",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl bg-[var(--background)] px-3 py-2 text-sm text-foreground neo-raised"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Check className="h-3 w-3" />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    title: "24/7 front-desk coverage",
    body: "Wardline answers every inbound call, handles common request types, and captures the right staff follow-up when a live action cannot complete.",
    icon: Phone,
  },
  {
    title: "Practice Setup, not bot building",
    body: "Set hours, services, FAQs, escalation rules, and integrations. Wardline turns that into the live receptionist behavior automatically.",
    icon: ClipboardList,
  },
  {
    title: "Safety first",
    body: "Emergency screening, after-hours policy, confirmation before write actions, and clear fallback behavior are built into the runtime.",
    icon: Shield,
  },
  {
    title: "Operator-ready queues",
    body: "Calls, urgent items, voicemails, and follow-ups stay linked so staff can see what happened and what needs attention next.",
    icon: Calendar,
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-[1280px] px-6 pb-16 pt-24 lg:px-12">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-[var(--background)] px-4 py-2 neo-inset">
                <span className="text-xs font-bold text-primary">*</span>
                <span className="text-xs font-bold uppercase tracking-wide text-primary">
                  Built for family medicine
                </span>
              </div>
              <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]">
                The AI voice receptionist
                <br />
                your practice can actually run.
              </h1>
              <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Configure the practice, not the bot. Wardline handles calls,
                appointments, refills, insurance, billing, and safe escalation
                from one practice-first setup surface.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[var(--background)] px-8 py-4 text-lg font-extrabold text-primary neo-raised active:neo-pressed"
                >
                  Start your free trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/features"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[var(--background)] px-8 py-4 text-lg font-bold text-muted-foreground neo-inset"
                >
                  See how it works
                </Link>
              </div>
            </div>
            <PracticeSetupPreview />
          </div>
        </section>

        <section className="mx-auto max-w-[1280px] px-6 py-16 lg:px-12">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              One receptionist experience, end to end
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base font-medium text-muted-foreground">
              Wardline keeps the customer experience simple while the runtime
              handles safety, integrations, fallback, and operator follow-up in
              the background.
            </p>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-4">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="flex flex-col justify-between rounded-[32px] bg-[var(--background)] p-8 neo-raised"
                >
                  <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-foreground lg:text-2xl">
                      {feature.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground lg:text-base">
                      {feature.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-[1184px] px-6 pb-24 lg:px-12">
          <div className="rounded-[40px] bg-[var(--background)] p-8 lg:p-14 neo-raised">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="grid gap-4">
                <div className="rounded-3xl bg-[var(--background)] p-6 neo-inset">
                  <div className="mb-3 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Practice hours
                    </span>
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    Set open hours and after-hours behavior once.
                  </p>
                </div>
                <div className="rounded-3xl bg-[var(--background)] p-6 neo-inset">
                  <div className="mb-3 flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Services and policies
                    </span>
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    Decide what the receptionist can handle live and what should become staff follow-up.
                  </p>
                </div>
                <div className="rounded-3xl bg-[var(--background)] p-6 neo-inset">
                  <div className="mb-3 flex items-center gap-2">
                    <PlugZap className="h-5 w-5 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      Integrations and readiness
                    </span>
                  </div>
                  <p className="text-sm font-bold text-foreground">
                    Connect one live vendor per category and use the dashboard to validate readiness.
                  </p>
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  Configure the practice, not a workflow.
                </h2>
                <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                  Medical practices should not have to design node graphs or
                  manage agent deployments. Wardline keeps the customer-facing
                  setup focused on hours, policies, FAQs, and integrations, then
                  compiles that into the live receptionist behavior internally.
                </p>
                <ul className="mt-8 space-y-4">
                  {[
                    "Direct answers for common office questions",
                    "Confirmation before appointment, refill, or billing writes",
                    "Clear voicemail and follow-up packaging when live actions fail",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-3 text-base font-semibold text-foreground"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Check className="h-3 w-3" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl sm:leading-tight">
            Ready to give your front desk real backup?
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base font-medium text-muted-foreground">
            Start with one practice, one phone line, and one clear operating model.
          </p>
          <Link
            href="/sign-up"
            className="mt-10 inline-flex rounded-[32px] bg-[var(--background)] px-12 py-5 text-xl font-extrabold text-primary neo-raised active:neo-pressed"
          >
            Start your free trial
          </Link>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
