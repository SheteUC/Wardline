import { Phone, Shield, Clock, ArrowRight, Activity, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-24 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-full mb-8">
            <Activity className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Trusted by Enterprise Health Systems</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-serif font-normal tracking-tight text-foreground mb-6 leading-tight">
            Medical-Grade<br />AI Voice Agents
          </h1>

          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed">
            Eliminate hold times and burnout. Wardline combines ultra-low latency AI with human clinical oversight to deliver safe, scalable, 24/7 patient access.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/contact">
              <button className="bg-foreground text-background px-8 py-4 rounded-full font-medium inline-flex items-center gap-2 hover:bg-foreground/90 text-lg">
                Schedule Demo
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Link href="/features">
              <button className="border border-border px-8 py-4 rounded-full font-medium hover:bg-accent text-lg">
                View Platform
              </button>
            </Link>
          </div>

          {/* Stats / Trust Signals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto pt-12 border-t border-border">
            <div>
              <div className="text-4xl font-semibold text-foreground mb-2">&lt;200ms</div>
              <div className="text-sm text-muted-foreground">Voice Latency</div>
            </div>
            <div>
              <div className="text-4xl font-semibold text-foreground mb-2">100%</div>
              <div className="text-sm text-muted-foreground">HIPAA Compliant</div>
            </div>
            <div>
              <div className="text-4xl font-semibold text-foreground mb-2">24/7</div>
              <div className="text-sm text-muted-foreground">Patient Access</div>
            </div>
            <div>
              <div className="text-4xl font-semibold text-foreground mb-2">Zero</div>
              <div className="text-sm text-muted-foreground">Medical Errors</div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="container mx-auto px-6 py-16 bg-accent/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-serif font-normal tracking-tight text-foreground mb-6">
                The Call Center Crisis
              </h2>
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-6 h-6 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Unacceptable Hold Times</h3>
                    <p className="text-muted-foreground">Patients abandon calls, leading to lost revenue and poor satisfaction scores.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Activity className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Staff Burnout</h3>
                    <p className="text-muted-foreground">Clinical staff are overwhelmed by repetitive administrative tasks.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
              <h3 className="text-2xl font-serif mb-4">The Wardline Solution</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                We automate 80% of routine calls while ensuring 100% of complex clinical needs reach human experts.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="font-medium">Instant AI Triage & Routing</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="font-medium">Seamless Human Handoff</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  <span className="font-medium">Clinical Safety Guardrails</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Key Pillars */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-normal tracking-tight text-foreground mb-4">
              Enterprise-Grade Reliability
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for the most demanding healthcare environments
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card border border-border rounded-2xl p-8 hover:border-blue-500/50 transition-colors">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6">
                <Phone className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Natural Voice AI</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Powered by Pipecat for conversational speeds faster than human perception.
              </p>
              <Link href="/features" className="text-sm font-medium text-foreground hover:underline inline-flex items-center gap-1">
                Explore Tech <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="bg-card border border-border rounded-2xl p-8 hover:border-red-500/50 transition-colors">
              <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-6">
                <Shield className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Clinical Safety</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Strict guardrails prevent medical advice and auto-escalate emergencies.
              </p>
              <Link href="/features" className="text-sm font-medium text-foreground hover:underline inline-flex items-center gap-1">
                View Safety <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="bg-card border border-border rounded-2xl p-8 hover:border-green-500/50 transition-colors">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-6">
                <Clock className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Rapid Deployment</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Integrate with your EHR and go live in days, not months.
              </p>
              <Link href="/features" className="text-sm font-medium text-foreground hover:underline inline-flex items-center gap-1">
                See Integrations <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Simplified How It Works */}
      <section className="container mx-auto px-6 py-16 bg-accent/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-normal tracking-tight text-foreground mb-4">
              A Unified Workflow
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From initial call to final resolution
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
             {/* Connector Lines (Desktop) */}
            <div className="hidden md:block absolute top-12 left-[20%] right-[20%] h-0.5 bg-border -z-10"></div>

            <div className="text-center bg-background p-6 rounded-2xl border border-border shadow-sm">
              <div className="w-16 h-16 bg-blue-500 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Intake</h3>
              <p className="text-sm text-muted-foreground">
                Wardline AI answers immediately, verifying identity and understanding intent.
              </p>
            </div>

            <div className="text-center bg-background p-6 rounded-2xl border border-border shadow-sm">
              <div className="w-16 h-16 bg-purple-500 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Triage & Route</h3>
              <p className="text-sm text-muted-foreground">
                Routine tasks are automated. Clinical issues are instantly routed to nurses.
              </p>
            </div>

            <div className="text-center bg-background p-6 rounded-2xl border border-border shadow-sm">
              <div className="w-16 h-16 bg-green-500 text-white rounded-2xl flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Resolution</h3>
              <p className="text-sm text-muted-foreground">
                Appointments are booked, questions answered, and data synced to EHR.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto text-center bg-foreground text-background rounded-3xl p-12">
          <h2 className="text-3xl md:text-4xl font-serif font-normal tracking-tight mb-4">
            Transform Your Patient Experience
          </h2>
          <p className="text-lg text-background/80 mb-8">
            Schedule a consultation to see our medical-grade AI in action.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/contact">
              <button className="bg-background text-foreground px-8 py-4 rounded-full font-medium hover:bg-background/90 text-lg">
                Schedule Demo
              </button>
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
