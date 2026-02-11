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
            Build Intelligent<br />Call Workflows Visually
          </h1>

          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed">
            Design custom AI-powered call flows with drag-and-drop simplicity. Wardline's dynamic workflow engine seamlessly blends AI automation with human expertise for 24/7 patient care.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link href="/sign-up">
              <button className="bg-foreground text-background px-8 py-4 rounded-full font-medium inline-flex items-center gap-2 hover:bg-foreground/90 text-lg">
                Start Building
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <Link href="/features">
              <button className="border border-border px-8 py-4 rounded-full font-medium hover:bg-accent text-lg">
                Explore Features
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
              <div className="text-4xl font-semibold text-foreground mb-2">7</div>
              <div className="text-sm text-muted-foreground">Node Types</div>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Workflow Showcase */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-normal tracking-tight text-foreground mb-4">
              No-Code Workflow Builder
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Drag, drop, and configure intelligent call flows in minutes
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 rounded-3xl p-12 border border-border">
            <div className="grid md:grid-cols-7 gap-4 max-w-4xl mx-auto">
              {/* AI Agent */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-lg border border-blue-200 dark:border-blue-800 col-span-2">
                <div className="w-8 h-8 bg-blue-500 rounded-lg mb-2 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                </div>
                <div className="text-xs font-semibold">AI Agent</div>
                <div className="text-[10px] text-muted-foreground">Greet & Screen</div>
              </div>
              
              {/* Arrow */}
              <div className="flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </div>
              
              {/* Conditional */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-lg border border-amber-200 dark:border-amber-800 col-span-2">
                <div className="w-8 h-8 bg-amber-500 rounded-lg mb-2 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div className="text-xs font-semibold">Conditional</div>
                <div className="text-[10px] text-muted-foreground">Emergency?</div>
              </div>
              
              {/* Arrow */}
              <div className="flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </div>
              
              {/* Human Queue */}
              <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-lg border border-green-200 dark:border-green-800">
                <div className="w-8 h-8 bg-green-500 rounded-lg mb-2 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <div className="text-xs font-semibold">Nurse</div>
                <div className="text-[10px] text-muted-foreground">Queue</div>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <Link href="/sign-up">
                <button className="bg-foreground text-background px-6 py-3 rounded-full font-medium hover:bg-foreground/90 inline-flex items-center gap-2">
                  Try Workflow Builder
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
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
