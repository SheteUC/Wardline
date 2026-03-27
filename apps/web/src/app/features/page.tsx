import {
  Activity,
  ArrowRight,
  Bot,
  Check,
  ClipboardList,
  Database,
  Phone,
  PlugZap,
  Shield,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const PRACTICE_CAPABILITIES = [
  "Appointment request intake and follow-up",
  "Prescription refill capture and confirmation",
  "Insurance acceptance checks",
  "Billing request handling",
  "Office information and FAQ answers",
] as const;

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-4xl px-6 pb-16 pt-20 text-center lg:px-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Built around one front-desk job
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Wardline answers the phone, follows practice policy, uses live
            integrations when available, and gives staff a clean operational
            queue when a request needs follow-up.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-12">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-3xl bg-[var(--background)] p-8 neo-raised">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-2xl font-extrabold text-foreground">Voice runtime</h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                One receptionist voice on the outside, structured runtime logic on
                the inside. Emergency screening, after-hours handling, confirmation,
                and escalation stay enforced throughout the call.
              </p>
            </div>
            <div className="rounded-3xl bg-[var(--background)] p-8 neo-raised">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-2xl font-extrabold text-foreground">Human backup</h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                When a live action cannot complete, Wardline creates the right
                follow-up task, links voicemail or urgent context, and makes the
                next step obvious for staff.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-12">
          <h2 className="text-center text-2xl font-extrabold text-foreground sm:text-3xl">
            Practice-first capabilities
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Practices configure the business. Wardline handles the live runtime behind the scenes.
          </p>
          <ul className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
            {PRACTICE_CAPABILITIES.map((name) => (
              <li
                key={name}
                className="flex items-center gap-3 rounded-2xl bg-[var(--background)] px-4 py-3 text-sm font-semibold text-foreground neo-raised"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Check className="h-4 w-4" />
                </span>
                {name}
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-12">
          <div className="rounded-3xl bg-[var(--background)] p-8 lg:p-12 neo-raised">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                  <ClipboardList className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-2xl font-extrabold text-foreground sm:text-3xl">
                  Practice Setup becomes live call policy
                </h2>
                <p className="mt-4 text-muted-foreground leading-relaxed">
                  Set office hours, escalation rules, FAQs, supported services,
                  and integrations. Wardline compiles those settings into the live
                  runtime so practices do not have to design node graphs or deploy agents.
                </p>
              </div>
              <div className="space-y-3 rounded-2xl bg-[var(--background)] p-6 neo-inset">
                <div className="flex items-center gap-3 rounded-xl bg-[var(--background)] px-4 py-3 text-sm font-semibold neo-raised">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Screen safety and determine the request type
                </div>
                <div className="mx-auto h-4 w-0.5 bg-border" />
                <div className="flex items-center gap-3 rounded-xl bg-[var(--background)] px-4 py-3 text-sm font-semibold neo-raised">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  Execute live action or create staff follow-up
                </div>
                <div className="mx-auto h-4 w-0.5 bg-border" />
                <div className="flex items-center gap-3 rounded-xl bg-[var(--background)] px-4 py-3 text-sm font-semibold neo-raised">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Keep calls, voicemails, and tasks linked in the dashboard
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-12">
          <h2 className="text-center text-2xl font-extrabold text-foreground sm:text-3xl">
            Safety and operations
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <div className="rounded-3xl bg-[var(--background)] p-8 neo-raised">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-extrabold text-foreground">Safety guard</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Emergency language triggers immediate safe escalation guidance. Clinical-advice requests are deflected to staff follow-up.
              </p>
            </div>
            <div className="rounded-3xl bg-[var(--background)] p-8 neo-raised">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-extrabold text-foreground">Operator clarity</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Calls, voicemails, urgent items, and follow-ups stay visible with plain-language summaries and next steps.
              </p>
            </div>
            <div className="rounded-3xl bg-[var(--background)] p-8 neo-raised">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-extrabold text-foreground">Telephony and live actions</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Twilio handles inbound telephony while the runtime uses one live connector per category and falls back safely when needed.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24 lg:px-12">
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-3xl bg-[var(--background)] p-8 neo-raised">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                <Zap className="h-6 w-6 text-amber-500" />
              </div>
              <h3 className="text-lg font-extrabold text-foreground">Performance</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Hot-path latency is measured across call bootstrap, runtime actions, fallback creation, and dashboard queue loads.
              </p>
            </div>
            <div className="rounded-3xl bg-[var(--background)] p-8 neo-raised">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-extrabold text-foreground">Data layer</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                PostgreSQL stores businesses, calls, follow-ups, voicemails, and integration metadata in one shared operational model.
              </p>
            </div>
            <div className="rounded-3xl bg-[var(--background)] p-8 neo-raised">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                <PlugZap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-extrabold text-foreground">Practice readiness</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Hours, policies, integrations, and FAQs roll up into one readiness view so a practice knows when it is safe to go live.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-24 text-center lg:px-12">
          <div className="rounded-3xl bg-[var(--background)] p-10 neo-raised">
            <h2 className="text-2xl font-extrabold text-foreground sm:text-3xl">
              See it on your stack
            </h2>
            <p className="mt-3 text-muted-foreground">
              Talk to us about pricing, rollout, and integration fit for your practice.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--background)] px-8 py-4 text-base font-extrabold text-primary neo-raised active:neo-pressed"
              >
                Contact sales
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-2xl bg-[var(--background)] px-8 py-4 text-base font-bold text-muted-foreground neo-inset"
              >
                View pricing
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
