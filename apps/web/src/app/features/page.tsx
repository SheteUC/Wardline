import {
  Brain,
  Users,
  Workflow,
  Shield,
  Activity,
  Phone,
  Zap,
  Database,
  Check,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

const STARTER_AGENTS = [
  "Appointment scheduling",
  "Billing & payments",
  "Insurance verification",
  "General FAQ & info",
  "Prescription refill requests",
] as const;

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center lg:px-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Everything in one platform
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Inbound calls go to the Pipecat voice orchestrator; your team manages agents,
            workflows, and safety from the Wardline dashboard—no code required.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-12">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="rounded-3xl bg-[var(--background)] p-8 neo-raised">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                <Brain className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-2xl font-extrabold text-foreground">AI voice layer</h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Real-time speech (Azure), GPT-4 class models, natural TTS. One-problem-at-a-time
                conversations with always-on emergency keyword detection before the LLM runs.
              </p>
            </div>
            <div className="rounded-3xl bg-[var(--background)] p-8 neo-raised">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                <Users className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-2xl font-extrabold text-foreground">Human handoff</h2>
              <p className="mt-3 text-muted-foreground leading-relaxed">
                Warm transfer to staff when needed; if no one answers, callers can leave voicemail
                in the same flow. Out-of-scope clinical questions are deflected per policy.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-12">
          <h2 className="text-center text-2xl font-extrabold text-foreground sm:text-3xl">
            Five starter agents
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
            Deploy from the catalog and configure tool credentials—each agent has clear scope boundaries.
          </p>
          <ul className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
            {STARTER_AGENTS.map((name) => (
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
                  <Workflow className="h-7 w-7 text-primary" />
                </div>
                <h2 className="text-2xl font-extrabold text-foreground sm:text-3xl">
                  Visual call flow editor
                </h2>
                <p className="mt-4 text-muted-foreground leading-relaxed">
                  Build greet → intent → route → resolve loops with a drag-and-drop workflow
                  editor (React Flow). Node types include greeting, intent detection, routing,
                  collection, human transfer, voicemail, emergency escalation, and more.
                </p>
              </div>
              <div className="space-y-3 rounded-2xl bg-[var(--background)] p-6 neo-inset">
                <div className="flex items-center gap-3 rounded-xl bg-[var(--background)] px-4 py-3 text-sm font-semibold neo-raised">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Greet &amp; detect intent
                </div>
                <div className="mx-auto h-4 w-0.5 bg-border" />
                <div className="flex items-center gap-3 rounded-xl bg-[var(--background)] px-4 py-3 text-sm font-semibold neo-raised">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  Route to agent / human
                </div>
                <div className="mx-auto h-4 w-0.5 bg-border" />
                <div className="flex items-center gap-3 rounded-xl bg-[var(--background)] px-4 py-3 text-sm font-semibold neo-raised">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Resolve or continue
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16 lg:px-12">
          <h2 className="text-center text-2xl font-extrabold text-foreground sm:text-3xl">
            Safety &amp; operations
          </h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <div className="rounded-3xl bg-[var(--background)] p-8 neo-raised">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-extrabold text-foreground">Safety guard</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Emergency keywords trigger 911 advisory and escalation; clinical questions are
                deflected with offer to transfer. Owners can add keywords, not remove system defaults.
              </p>
            </div>
            <div className="rounded-3xl bg-[var(--background)] p-8 neo-raised">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                <Activity className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-extrabold text-foreground">Call intelligence</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Call logs with turn-level detail, tags, and outcomes; voicemails with playback and
                transcription in the dashboard.
              </p>
            </div>
            <div className="rounded-3xl bg-[var(--background)] p-8 neo-raised">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-extrabold text-foreground">Telephony stack</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Twilio for inbound media streams; core API connects orchestrator, workflows, and
                your business data.
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
                Redis-backed core API for caching and scale; designed for production workloads.
              </p>
            </div>
            <div className="rounded-3xl bg-[var(--background)] p-8 neo-raised">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-extrabold text-foreground">Data layer</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                PostgreSQL for tenants, agents, calls, and voicemails—integrate scheduling and EHR
                tools per agent.
              </p>
            </div>
            <div className="rounded-3xl bg-[var(--background)] p-8 neo-raised">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-extrabold text-foreground">Compliance posture</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Build on HIPAA-aligned patterns: encrypt in transit, vendor BAAs where applicable,
                and least-privilege access for your team.
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
              Talk to us about pricing, rollout, and integrations.
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
