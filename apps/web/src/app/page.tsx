import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Calendar,
  Check,
  Clock,
  Phone,
  Play,
  Shield,
  Sparkles,
  Wallet,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/** Hero workflow mock — matches Figma node 1:435 */
function WorkflowMockup() {
  return (
    <div className="relative w-full">
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-[32px]" />
      <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-accent/10 blur-[32px]" />

      <div className="relative rounded-[40px] border border-white/40 bg-[var(--background)] p-8 neo-raised">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500/40" />
            <span className="h-3 w-3 rounded-full bg-primary/40" />
            <span className="h-3 w-3 rounded-full bg-accent/40" />
          </div>
          <div className="relative rounded-2xl bg-[var(--background)] px-3 py-1 neo-inset">
            <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Workflow Builder v2.4
            </span>
          </div>
        </div>

        <div className="relative space-y-0">
          <div className="flex gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--background)] neo-raised">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div className="relative min-w-0 flex-1 rounded-2xl bg-[var(--background)] p-4 neo-inset">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Trigger
              </p>
              <p className="mt-1 text-sm font-bold text-foreground">
                Incoming Patient Call
              </p>
            </div>
          </div>
          <div className="ml-7 h-8 w-0.5 bg-primary/20" />
          <div className="flex gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--background)] neo-raised">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div className="relative min-w-0 flex-1 rounded-2xl bg-[var(--background)] p-4 neo-raised">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                AI Intent Analysis
              </p>
              <p className="mt-1 text-sm font-bold text-foreground">
                &ldquo;I need to book a cleaning&rdquo;
              </p>
            </div>
          </div>
          <div className="ml-7 h-8 w-0.5 bg-primary/20" />
          <div className="flex gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--background)] neo-raised">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div className="relative min-w-0 flex-1 rounded-2xl bg-[var(--background)] p-4 neo-inset">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Action
              </p>
              <p className="mt-1 text-sm font-bold text-foreground">
                Schedule Appointment: Tue 10AM
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    title: "24/7 Live Coverage",
    body: "Never miss a potential patient again. Wardline answers instantly at 2 PM or 2 AM, handling overflows and after-hours flawlessly.",
    icon: Clock,
    wide: true,
  },
  {
    title: "Instant Scheduling",
    body: "Direct integration with your EHR to book, reschedule, or cancel appointments in real-time.",
    icon: Calendar,
    wide: false,
  },
  {
    title: "Insurance Checks",
    body: "Automatically verify patient insurance during the call to reduce billing headaches later.",
    icon: Shield,
    wide: false,
  },
  {
    title: "Patient Billing",
    body: "Securely process payments and provide balance updates over the phone using encrypted AI voice.",
    icon: Wallet,
    wide: false,
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SiteHeader />

      <main>
        {/* Hero — Figma 1:417 */}
        <section className="mx-auto max-w-[1280px] px-6 pb-16 pt-24 lg:px-12">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div>
              <div className="mb-8 inline-flex items-center gap-2 rounded-full bg-[var(--background)] px-4 py-2 neo-inset">
                <span className="text-xs font-bold text-primary">●</span>
                <span className="text-xs font-bold uppercase tracking-wide text-primary">
                  Next-gen patient care
                </span>
              </div>
              <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-5xl lg:text-[3.5rem] lg:leading-[1.05]">
                The AI Voice{" "}
                <span className="text-primary">Receptionist</span>
                <br />
                for Your Practice.
              </h1>
              <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
                Wardline handles calls, schedules appointments, and verifies insurance
                24/7 so your team can focus on patients.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Link
                  href="/sign-up"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[var(--background)] px-8 py-4 text-lg font-extrabold text-primary neo-raised active:neo-pressed"
                >
                  Start Your Free Trial
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/features"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[var(--background)] px-8 py-4 text-lg font-bold text-muted-foreground neo-inset"
                >
                  <Play className="h-4 w-4" />
                  Watch Demo
                </Link>
              </div>
            </div>
            <WorkflowMockup />
          </div>
        </section>

        {/* Bento — Figma 1:476 */}
        <section className="mx-auto max-w-[1280px] px-6 py-16 lg:px-12">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Complete Practice Coverage
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base font-medium text-muted-foreground">
              Everything your front desk does, but available 24/7/365.
            </p>
          </div>

          <div className="mt-16 grid gap-8 lg:grid-cols-4">
            {/* Row 1: wide + two singles — Figma bento */}
            {FEATURES.slice(0, 3).map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className={`flex flex-col justify-between rounded-[32px] bg-[var(--background)] p-10 neo-raised ${
                    f.wide ? "lg:col-span-2" : "lg:col-span-1"
                  }`}
                >
                  <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-foreground lg:text-2xl">
                      {f.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground lg:text-base">
                      {f.body}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Row 2: fourth card + large CTA — Figma 1:514 + 1:524 */}
            {FEATURES.slice(3, 4).map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="flex flex-col justify-between rounded-[32px] bg-[var(--background)] p-10 lg:col-span-1 neo-raised"
                >
                  <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-extrabold text-foreground">
                      {f.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {f.body}
                    </p>
                  </div>
                </div>
              );
            })}

            <div className="relative flex flex-col gap-8 overflow-hidden rounded-[32px] bg-[var(--background)] p-10 lg:col-span-3 lg:flex-row lg:items-center lg:justify-between neo-inset">
              <div className="relative z-10 max-w-lg">
                <h3 className="text-2xl font-extrabold leading-tight text-foreground sm:text-3xl">
                  Scale your practice without scaling your overhead.
                </h3>
                <p className="mt-4 text-base text-muted-foreground">
                  Join over 500+ clinics that have automated their front desk with
                  Wardline&apos;s Silk AI technology.
                </p>
                <Link
                  href="/sign-up"
                  className="mt-6 inline-flex rounded-3xl bg-[var(--background)] px-8 py-3 text-base font-bold text-primary neo-raised active:neo-pressed"
                >
                  Get Started Now
                </Link>
              </div>
              <div className="relative z-10 mx-auto flex shrink-0 rotate-3">
                <div className="relative h-56 w-56 overflow-hidden rounded-[48px] neo-raised sm:h-64 sm:w-64">
                  <Image
                    src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=512&h=512&fit=crop&q=80"
                    alt="Healthcare professional using tablet"
                    fill
                    className="object-cover"
                    sizes="256px"
                  />
                </div>
              </div>
              <div className="pointer-events-none absolute -right-20 -bottom-20 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
            </div>
          </div>
        </section>

        {/* Zero coding — Figma 1:535 */}
        <section className="mx-auto max-w-[1184px] px-6 pb-24 lg:px-12">
          <div className="rounded-[48px] bg-[var(--background)] p-8 lg:p-16 neo-raised">
            <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="relative rounded-2xl bg-[var(--background)] p-6 neo-inset">
                  <div className="mb-4 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <span className="text-xs font-bold text-muted-foreground">
                      VOICE ENGINE
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#d6d8de]">
                    <div className="h-full w-3/4 rounded-full bg-primary" />
                  </div>
                  <p className="mt-4 text-sm font-bold text-foreground">
                    Natural &ldquo;Emma&rdquo; Voice
                  </p>
                </div>
                <div className="rounded-2xl bg-[var(--background)] p-6 neo-raised">
                  <div className="mb-4 flex items-center gap-2">
                    <Phone className="h-5 w-5 text-primary" />
                    <span className="text-xs font-bold text-muted-foreground">
                      LANGUAGES
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {["EN", "ES", "FR"].map((lang) => (
                      <span
                        key={lang}
                        className="rounded-lg bg-[#d8dae6] px-2 py-1 text-[10px] font-bold text-foreground neo-inset"
                      >
                        {lang}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="relative col-span-full rounded-2xl border border-white/40 bg-[var(--background)] p-8 neo-raised">
                  <div className="mb-6 flex items-center justify-between">
                    <h4 className="text-base font-bold text-foreground">
                      Live Flow Preview
                    </h4>
                    <span className="text-xs font-bold text-primary">ACTIVE</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <Phone className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="rounded-3xl bg-[#e5e7ed] px-3 py-2 text-xs leading-relaxed text-foreground">
                        &ldquo;Hello, I&apos;d like to book an appointment with Dr. Smith for next
                        Thursday.&rdquo;
                      </div>
                    </div>
                    <div className="flex flex-row-reverse gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
                        <Brain className="h-3.5 w-3.5 text-accent" />
                      </div>
                      <div className="rounded-3xl bg-white/60 px-3 py-2 text-right text-xs leading-relaxed text-foreground">
                        &ldquo;Certainly! I see an opening at 2:00 PM. Would that work for
                        you?&rdquo;
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  Zero Coding.
                  <br />
                  Infinite Flexibility.
                </h2>
                <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                  Our &ldquo;No-Code&rdquo; visual drag-and-drop builder allows you to map out
                  complex patient journeys in minutes. Define custom logic for emergencies,
                  triage calls, and specific doctor preferences without writing a single line
                  of code.
                </p>
                <ul className="mt-8 space-y-4">
                  {[
                    "Visual drag-and-drop logic",
                    "Multi-language support (50+ languages)",
                    "HIPAA-compliant data handling",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-base font-semibold text-foreground">
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

        {/* Final CTA — Figma 1:598 */}
        <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl sm:leading-tight">
            Ready to reclaim 10+ hours a week for your staff?
          </h2>
          <Link
            href="/sign-up"
            className="mt-10 inline-flex rounded-[32px] bg-[var(--background)] px-12 py-5 text-xl font-extrabold text-primary neo-raised active:neo-pressed"
          >
            Start Your Free Trial
          </Link>
          <p className="mt-6 text-base font-medium text-muted-foreground">
            No credit card required. 14-day full access.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
