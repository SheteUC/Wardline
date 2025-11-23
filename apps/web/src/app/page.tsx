import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Shield, Clock, BarChart3, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-primary-100 selection:text-primary-900">
      {/* Floating Header */}
      <header className="fixed top-4 left-0 right-0 z-50 mx-auto w-full max-w-5xl px-4">
        <div className="glass rounded-full px-6 py-3 flex items-center justify-between shadow-lg shadow-primary-900/5">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary-600 p-1.5 text-white">
              <Phone className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">Wardline</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="#features" className="hover:text-primary-600 transition-colors">Features</Link>
            <Link href="#how-it-works" className="hover:text-primary-600 transition-colors">How it Works</Link>
            <Link href="#pricing" className="hover:text-primary-600 transition-colors">Pricing</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/sign-in">
              <Button variant="ghost" size="sm" className="rounded-full hover:bg-primary-50 hover:text-primary-700">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button size="sm" className="rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-md shadow-primary-600/20">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section with Gradient Mesh */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary-200/30 dark:bg-primary-900/20 rounded-full blur-3xl opacity-50 mix-blend-multiply dark:mix-blend-screen animate-pulse" />
          <div className="absolute top-20 left-1/4 w-[600px] h-[600px] bg-secondary-200/30 dark:bg-secondary-900/20 rounded-full blur-3xl opacity-40 mix-blend-multiply dark:mix-blend-screen" />
        </div>

        <div className="container flex flex-col items-center justify-center gap-8 text-center relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50/50 px-4 py-1.5 text-sm font-medium text-primary-700 backdrop-blur-sm dark:border-primary-800 dark:bg-primary-950/50 dark:text-primary-300">
            <Shield className="h-3.5 w-3.5" />
            <span>HIPAA-Compliant AI Receptionist</span>
          </div>

          <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-7xl text-foreground">
            Hospital Call Triage <br />
            <span className="text-gradient">Reimagined with AI</span>
          </h1>

          <p className="max-w-2xl text-lg text-muted-foreground leading-relaxed">
            Wardline answers, screens, and routes hospital calls 24/7 using advanced voice AI.
            Ensure every patient gets immediate attention while reducing staff burnout.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Link href="/sign-up">
              <Button size="lg" className="rounded-full h-12 px-8 text-base bg-primary-600 hover:bg-primary-700 shadow-lg shadow-primary-600/25 transition-all hover:scale-105">
                Start Free Trial <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="#demo">
              <Button size="lg" variant="outline" className="rounded-full h-12 px-8 text-base border-2 hover:bg-muted/50 backdrop-blur-sm">
                View Interactive Demo
              </Button>
            </Link>
          </div>

          {/* Stats / Social Proof */}
          <div className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-4 border-t border-border/50 pt-8 w-full max-w-4xl">
            {[
              { label: "Uptime", value: "99.99%" },
              { label: "Calls Handled", value: "1M+" },
              { label: "Response Time", value: "< 1s" },
              { label: "Compliance", value: "HIPAA" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center">
                <span className="text-2xl font-bold text-foreground">{stat.value}</span>
                <span className="text-sm text-muted-foreground">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-muted/30 relative">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl mb-4">
              Everything You Need for <span className="text-primary-600">Modern Triage</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Built specifically for healthcare providers, Wardline combines clinical-grade security with cutting-edge voice technology.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Phone,
                title: "24/7 Availability",
                description: "Always-on AI receptionist that never sleeps, ensuring no call goes unanswered.",
                color: "text-primary-600",
                bg: "bg-primary-100 dark:bg-primary-900/20"
              },
              {
                icon: Shield,
                title: "HIPAA Compliant",
                description: "Enterprise-grade security with BAA support, encryption, and audit logs.",
                color: "text-success-600",
                bg: "bg-success-100 dark:bg-success-900/20"
              },
              {
                icon: Clock,
                title: "Smart Triage",
                description: "Intelligent urgency detection to escalate emergencies immediately.",
                color: "text-warning-600",
                bg: "bg-warning-100 dark:bg-warning-900/20"
              },
              {
                icon: BarChart3,
                title: "Rich Analytics",
                description: "Deep insights into call volumes, patient sentiment, and peak hours.",
                color: "text-danger-600",
                bg: "bg-danger-100 dark:bg-danger-900/20"
              }
            ].map((feature, i) => (
              <Card key={i} className="glass-card border-0 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                <CardHeader>
                  <div className={`w-12 h-12 rounded-2xl ${feature.bg} flex items-center justify-center mb-4`}>
                    <feature.icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="container relative z-10">
          <div className="rounded-3xl bg-primary-900 dark:bg-primary-950 p-8 md:p-16 text-center text-white overflow-hidden relative">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary-800/50 to-secondary-900/50"></div>

            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold mb-6">Ready to modernize your hospital's front desk?</h2>
              <p className="text-primary-100 mb-8 text-lg">
                Join forward-thinking healthcare providers using Wardline to improve patient satisfaction and operational efficiency.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/sign-up">
                  <Button size="lg" className="rounded-full bg-white text-primary-900 hover:bg-primary-50 w-full sm:w-auto">
                    Get Started Now
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button size="lg" variant="outline" className="rounded-full border-primary-700 text-white hover:bg-primary-800 hover:text-white w-full sm:w-auto">
                    Contact Sales
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/20">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="rounded-full bg-primary-600 p-1 text-white">
                  <Phone className="h-3 w-3" />
                </div>
                <span className="text-lg font-bold">Wardline</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered call triage for modern healthcare.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-primary-600">Features</Link></li>
                <li><Link href="#" className="hover:text-primary-600">Integrations</Link></li>
                <li><Link href="#" className="hover:text-primary-600">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="#" className="hover:text-primary-600">About</Link></li>
                <li><Link href="#" className="hover:text-primary-600">Blog</Link></li>
                <li><Link href="#" className="hover:text-primary-600">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-primary-600">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-primary-600">Terms</Link></li>
                <li><Link href="/security" className="hover:text-primary-600">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© 2025 Wardline. All rights reserved.</p>
            <div className="flex gap-6">
              <Link href="#" className="hover:text-foreground">Twitter</Link>
              <Link href="#" className="hover:text-foreground">LinkedIn</Link>
              <Link href="#" className="hover:text-foreground">GitHub</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

