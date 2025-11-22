import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, Shield, Clock, BarChart3 } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-6 w-6 text-primary-600" />
            <span className="text-xl font-bold">Wardline</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/sign-in">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/sign-up">
              <Button>Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1">
        <div className="container flex flex-col items-center justify-center gap-8 py-24 text-center">
          <div className="flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm">
            <Shield className="h-4 w-4 text-primary-600" />
            <span>HIPAA-Compliant Call Management</span>
          </div>

          <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-6xl">
            AI-Powered <span className="text-primary-600">24/7</span> Hospital Call Triage
          </h1>

          <p className="max-w-2xl text-lg text-muted-foreground">
            Never miss a call again. Wardline answers and triages hospital phone lines 24/7 using advanced AI,
            ensuring every patient gets the right care at the right time.
          </p>

          <div className="flex gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="gap-2">
                Start Free Trial
              </Button>
            </Link>
            <Link href="#features">
              <Button size="lg" variant="outline">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="border-t bg-muted/40 py-24">
        <div className="container">
          <h2 className="mb-12 text-center text-3xl font-bold">
            Everything You Need for Modern Call Management
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader>
                <Phone className="mb-2 h-8 w-8 text-primary-600" />
                <CardTitle className="text-xl">24/7 Availability</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Always-on AI receptionist that never sleeps, ensuring no call goes unanswered
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="mb-2 h-8 w-8 text-success-600" />
                <CardTitle className="text-xl">HIPAA Compliant</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Built from the ground up with healthcare compliance and data security in mind
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Clock className="mb-2 h-8 w-8 text-warning-600" />
                <CardTitle className="text-xl">Emergency Detection</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  AI-powered emergency screening and immediate escalation to the right team
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="mb-2 h-8 w-8 text-danger-600" />
                <CardTitle className="text-xl">Rich Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Comprehensive insights into call volume, sentiment, and operational efficiency
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © 2025 Wardline. All rights reserved.
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
