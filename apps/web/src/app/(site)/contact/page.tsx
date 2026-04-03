"use client";

import { Mail, MapPin, Phone, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    subject: "demo",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    console.log("Form submitted:", formData);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const inputClass =
    "w-full rounded-2xl bg-[var(--background)] px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground neo-inset border-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-3xl px-6 pb-12 pt-20 text-center lg:px-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Get in touch
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Questions about Wardline, pricing, or a demo for your clinic - we&apos;ll
            respond as soon as we can.
          </p>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-2">
            <div className="rounded-3xl bg-[var(--background)] p-8 neo-raised lg:p-10">
              <h2 className="text-xl font-extrabold text-foreground">Send a message</h2>

              {submitted && (
                <div
                  role="status"
                  className="mt-6 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 neo-inset"
                >
                  Thanks - we&apos;ll get back to you shortly.
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label htmlFor="name" className="mb-2 block text-sm font-semibold text-foreground">
                    Full name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Jane Doe"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold text-foreground">
                    Work email *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="you@clinic.com"
                  />
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label htmlFor="company" className="mb-2 block text-sm font-semibold text-foreground">
                      Practice / org
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="City Dental Clinic"
                    />
                  </div>
                  <div>
                    <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-foreground">
                      Phone
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className={inputClass}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="mb-2 block text-sm font-semibold text-foreground">
                    Topic *
                  </label>
                  <select
                    id="subject"
                    name="subject"
                    required
                    value={formData.subject}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="demo">Schedule a demo</option>
                    <option value="sales">Pricing &amp; plans</option>
                    <option value="support">Product support</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="mb-2 block text-sm font-semibold text-foreground">
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    value={formData.message}
                    onChange={handleChange}
                    rows={6}
                    className={`${inputClass} resize-none`}
                    placeholder="Tell us about your call volume and what you want to automate..."
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--background)] px-8 py-4 text-base font-extrabold text-primary neo-raised active:neo-pressed sm:w-auto"
                >
                  Send message
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-foreground">Contact</h2>
              <div className="mt-8 space-y-6">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Email</h3>
                    <a
                      href="mailto:hello@wardline.health"
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      hello@wardline.health
                    </a>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                    <Phone className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Phone</h3>
                    <a
                      href="tel:+15139511583"
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      (513) 951-1583
                    </a>
                    <p className="text-xs text-muted-foreground">Mon-Fri, 9-5 ET</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--background)] neo-inset">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Office</h3>
                    <p className="text-sm text-muted-foreground">San Francisco, CA</p>
                  </div>
                </div>
              </div>

              <div className="mt-10 rounded-3xl bg-[var(--background)] p-6 neo-inset">
                <h3 className="font-extrabold text-foreground">Quick links</h3>
                <ul className="mt-4 space-y-3 text-sm font-medium">
                  <li>
                    <Link href="/features" className="text-primary hover:underline">
                      Product features
                    </Link>
                  </li>
                  <li>
                    <Link href="/pricing" className="text-primary hover:underline">
                      Pricing overview
                    </Link>
                  </li>
                  <li>
                    <Link href="/sign-up" className="text-primary hover:underline">
                      Create an account
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-24 text-center lg:px-12">
          <div className="rounded-3xl bg-[var(--background)] p-10 neo-raised">
            <h2 className="text-xl font-extrabold text-foreground sm:text-2xl">
              Larger health system?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Ask about enterprise rollout, security review, and custom integrations.
            </p>
            <a
              href="mailto:enterprise@wardline.health"
              className="mt-6 inline-flex rounded-2xl bg-[var(--background)] px-8 py-3 text-sm font-bold text-primary neo-raised"
            >
              enterprise@wardline.health
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
