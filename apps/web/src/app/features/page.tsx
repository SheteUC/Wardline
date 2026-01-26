import { Brain, Users, Workflow, Shield, Activity, Lock, Phone, Zap, Database, CheckCircle2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="container mx-auto px-6 py-24 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-serif font-normal tracking-tight text-foreground mb-6 leading-tight">
            Complete Hybrid Intelligence Platform
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            A unified system where AI efficiency meets human expertise, protected by medical-grade safety guardrails.
          </p>
        </div>
      </section>

      {/* The Hybrid Model (From Platform Page) */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-normal tracking-tight text-foreground mb-4">
              The Hybrid Model
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Seamless collaboration between automated agents and clinical staff
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-card border border-border rounded-2xl p-8">
              <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
                <Brain className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">AI Agents</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Pipecat-powered voice AI with Azure Speech and OpenAI GPT-4. Answer calls instantly with natural conversation, emergency detection, and intelligent routing.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Ultra-low latency streaming (&lt;200ms response)</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Configurable personas and system prompts</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Real-time sentiment analysis and escalation</span>
                </li>
              </ul>
            </div>

            <div className="bg-card border border-border rounded-2xl p-8">
              <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mb-6">
                <Users className="w-8 h-8 text-purple-500" />
              </div>
              <h3 className="text-2xl font-semibold mb-4">Human Agents</h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Clinical staff and administrators with dedicated dashboards for handling escalated calls, accepting assignments, and monitoring performance in real-time.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Skill-based routing and specialization matching</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">WebSocket real-time call notifications</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Full conversation history and context handoff</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Safety & Compliance (From Safety Page) */}
      <section className="container mx-auto px-6 py-16 bg-accent/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-normal tracking-tight text-foreground mb-4">
              Safety & Compliance
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Clinical safety is enforced at multiple layers with zero tolerance for errors
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card border border-border rounded-2xl p-8">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-6">
                <Lock className="w-6 h-6 text-green-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">HIPAA Compliant</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Full compliance with BAAs for all vendors. TLS 1.3 encryption in transit, AES-256 at rest, and strict access controls.
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-8">
              <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-6">
                <Shield className="w-6 h-6 text-red-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Medical Guardrails</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                60+ medical keywords monitored in real-time. Automatic escalation for emergency terms and zero medical advice policy.
              </p>
            </div>

            <div className="bg-card border border-border rounded-2xl p-8">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-6">
                <Activity className="w-6 h-6 text-blue-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Audit Trails</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Every action, routing decision, and safety event is logged with full context for compliance reporting and QA.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Smart Orchestration (Consolidated) */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row gap-12 items-center mb-24">
            <div className="flex-1">
              <div className="w-16 h-16 bg-green-500/10 rounded-2xl flex items-center justify-center mb-6">
                <Workflow className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-3xl md:text-4xl font-serif font-normal tracking-tight text-foreground mb-4">
                Visual Workflow Editor
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Design custom call flows with our ReactFlow-based drag-and-drop editor. Build sophisticated routing logic without writing code.
              </p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">15+ node types including AI agents and human queues</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-muted-foreground">Design-time validation blocks unsafe workflows</span>
                </li>
              </ul>
            </div>
            <div className="flex-1 bg-accent/30 rounded-2xl p-8 border border-border">
              {/* Abstract representation of workflow */}
              <div className="space-y-4">
                 <div className="flex items-center gap-3 p-4 bg-background border border-border rounded-lg shadow-sm">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span className="text-sm font-medium">Start Call</span>
                </div>
                <div className="w-0.5 h-4 bg-border mx-auto"></div>
                <div className="flex items-center gap-3 p-4 bg-background border border-border rounded-lg shadow-sm">
                  <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                  <span className="text-sm font-medium">AI Triage</span>
                </div>
                <div className="w-0.5 h-4 bg-border mx-auto"></div>
                <div className="flex items-center gap-3 p-4 bg-background border border-border rounded-lg shadow-sm">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium">Route to Nurse</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="col-span-full text-center mb-8">
              <h3 className="text-2xl font-serif font-normal tracking-tight text-foreground">Intelligent Queue Management</h3>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <h4 className="font-semibold mb-2">Skill-Based</h4>
              <p className="text-sm text-muted-foreground">Match agent skills with call requirements</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <h4 className="font-semibold mb-2">Round Robin</h4>
              <p className="text-sm text-muted-foreground">Distribute calls evenly across agents</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <h4 className="font-semibold mb-2">Least Busy</h4>
              <p className="text-sm text-muted-foreground">Route to agents with fewest active calls</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-6">
              <h4 className="font-semibold mb-2">Priority-Based</h4>
              <p className="text-sm text-muted-foreground">Assign based on seniority and priority</p>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Capabilities */}
      <section className="container mx-auto px-6 py-16 bg-accent/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-serif font-normal tracking-tight text-foreground mb-4">
              Enterprise Performance
            </h2>
            <p className="text-lg text-muted-foreground">
              Built on a production-ready stack for scale and reliability
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card border border-border rounded-2xl p-8">
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center mb-6">
                <Zap className="w-6 h-6 text-amber-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Real-Time Performance</h3>
              <p className="text-muted-foreground leading-relaxed">
                Redis caching and optimized queries ensure sub-second response times even at high volume.
              </p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-8">
              <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center mb-6">
                <Phone className="w-6 h-6 text-indigo-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Telephony Integration</h3>
              <p className="text-muted-foreground leading-relaxed">
                Seamless Twilio integration for programmable voice and media streams handling.
              </p>
            </div>
            <div className="bg-card border border-border rounded-2xl p-8">
              <div className="w-12 h-12 bg-teal-500/10 rounded-xl flex items-center justify-center mb-6">
                <Database className="w-6 h-6 text-teal-500" />
              </div>
              <h3 className="text-xl font-semibold mb-3">System Integrations</h3>
              <p className="text-muted-foreground leading-relaxed">
                Connects with TimeTap, NexHealth, and EHR systems for automated scheduling.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-4xl mx-auto text-center bg-foreground text-background rounded-3xl p-12">
          <h2 className="text-3xl md:text-4xl font-serif font-normal tracking-tight mb-4">
            Ready to Transform Your Operations?
          </h2>
          <p className="text-lg text-background/80 mb-8">
            Experience the power of hybrid intelligence.
          </p>
          <Link href="/contact">
            <button className="bg-background text-foreground px-8 py-4 rounded-full font-medium hover:bg-background/90 text-lg inline-flex items-center gap-2">
              Schedule Demo <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
