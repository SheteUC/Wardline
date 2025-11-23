import { Phone, Shield, Calendar } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Simple Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-foreground rounded-full flex items-center justify-center">
                <span className="text-background text-sm font-bold">W</span>
              </div>
              <span className="text-xl font-semibold tracking-tight">Wardline</span>
            </div>
            <nav className="hidden md:flex items-center gap-8 text-sm">
              <Link href="#solutions" className="text-muted-foreground hover:text-foreground">Solutions</Link>
              <Link href="#safety" className="text-muted-foreground hover:text-foreground">Safety</Link>
              <Link href="#integrations" className="text-muted-foreground hover:text-foreground">Integrations</Link>
            </nav>
            <div className="flex items-center gap-4">
              <Link href="/sign-in">
                <button className="text-sm text-foreground hover:text-muted-foreground">Log In</button>
              </Link>
              <Link href="/sign-up">
                <button className="bg-foreground text-background px-6 py-2 rounded-full text-sm font-medium hover:bg-foreground/90">
                  Request Access
                </button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-24 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-accent px-4 py-2 rounded-full mb-8">
            <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
            <span className="text-sm text-foreground">Announcing HIPAA-Compliant Voice AI v2.0</span>
          </div>

          <h1 className="text-6xl font-serif font-normal tracking-tight text-foreground mb-6 leading-tight">
            Intelligent Triage<br />for Modern Health
          </h1>

          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Automate hospital switchboards with clinical-grade voice AI. Wardline handles emergency screening, scheduling, and routing so your staff can focus on patient care.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link href="/sign-up">
              <button className="bg-foreground text-background px-8 py-3 rounded-full font-medium inline-flex items-center gap-2 hover:bg-foreground/90">
                Get Started
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </Link>
            <Link href="#demo">
              <button className="border border-border px-8 py-3 rounded-full font-medium hover:bg-accent">
                View Interactive Demo
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-24">
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          <div className="bg-card border border-border rounded-2xl p-8">
            <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mb-6">
              <Phone className="w-6 h-6 text-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Adaptive Voice Intake</h3>
            <p className="text-muted-foreground leading-relaxed">
              Natural language understanding that screens for emergencies and collects patient intent before routing.
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8">
            <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mb-6">
              <Shield className="w-6 h-6 text-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Clinical Guardrails</h3>
            <p className="text-muted-foreground leading-relaxed">
              Built-in safety protocols that never diagnose. Automatically escalates potential emergencies to 911.
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8">
            <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center mb-6">
              <Calendar className="w-6 h-6 text-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Automated Scheduling</h3>
            <p className="text-muted-foreground leading-relaxed">
              Direct integration with TimeTap and EHRs to book appointments without human intervention.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border mt-24">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>© 2025 Wardline Health, Inc. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground">Terms</Link>
              <Link href="/hipaa" className="hover:text-foreground">HIPAA BAA</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

