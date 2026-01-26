"use client";

import { Mail, MapPin, Phone, Send } from "lucide-react";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { useState } from "react";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would send to an API endpoint
    console.log("Form submitted:", formData);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Hero */}
      <section className="container mx-auto px-6 py-24 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-serif font-normal tracking-tight text-foreground mb-6 leading-tight">
            Get in Touch
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Have questions about Wardline? Want to schedule a demo? We're here to help transform your call center operations.
          </p>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="container mx-auto px-6 py-16">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div>
            <h2 className="text-3xl font-serif font-normal tracking-tight text-foreground mb-6">
              Send us a message
            </h2>

            {submitted && (
              <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-700">
                Thank you! We'll get back to you within 24 hours.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-foreground/20 bg-background"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-foreground/20 bg-background"
                  placeholder="john@hospital.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="company" className="block text-sm font-medium mb-2">
                    Hospital/Organization
                  </label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-foreground/20 bg-background"
                    placeholder="Memorial Hospital"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium mb-2">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-foreground/20 bg-background"
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium mb-2">
                  Subject *
                </label>
                <select
                  id="subject"
                  name="subject"
                  required
                  value={formData.subject}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-foreground/20 bg-background"
                >
                  <option value="demo">Schedule a Demo</option>
                  <option value="sales">Sales Inquiry</option>
                  <option value="support">Technical Support</option>
                  <option value="partnership">Partnership Opportunity</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2">
                  Message *
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  value={formData.message}
                  onChange={handleChange}
                  rows={6}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-foreground/20 bg-background resize-none"
                  placeholder="Tell us about your call center needs..."
                />
              </div>

              <button
                type="submit"
                className="w-full bg-foreground text-background px-8 py-4 rounded-full font-medium hover:bg-foreground/90 inline-flex items-center justify-center gap-2"
              >
                Send Message
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Contact Info */}
          <div>
            <h2 className="text-3xl md:text-4xl font-serif font-normal tracking-tight text-foreground mb-6">
              Contact Information
            </h2>

            <div className="space-y-6 mb-12">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Mail className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Email</h4>
                  <p className="text-sm text-muted-foreground mb-1">
                    Get in touch via email
                  </p>
                  <a href="mailto:hello@wardline.health" className="text-sm text-foreground hover:underline">
                    hello@wardline.health
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Phone className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Phone</h4>
                  <p className="text-sm text-muted-foreground mb-1">
                    Mon-Fri 9am-5pm EST
                  </p>
                  <a href="tel:+15139511583" className="text-sm text-foreground hover:underline">
                    (513) 951-1583
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Office</h4>
                  <p className="text-sm text-muted-foreground">
                    San Francisco, CA<br />
                    United States
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-accent/30 border border-border rounded-2xl p-8">
              <h3 className="text-xl font-semibold mb-4">Quick Links</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/features" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
                    Explore features
                    <span className="text-xs">→</span>
                  </Link>
                </li>
                <li>
                  <Link href="/sign-up" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
                    Start free trial
                    <span className="text-xs">→</span>
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise CTA */}
      <section className="container mx-auto px-6 py-16 bg-accent/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-normal tracking-tight text-foreground mb-4">
            Enterprise Solutions
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Need a custom solution for your health system? Our enterprise team can help design a tailored implementation.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="mailto:enterprise@wardline.health">
              <button className="bg-foreground text-background px-8 py-4 rounded-full font-medium hover:bg-foreground/90 text-lg">
                Contact Enterprise Sales
              </button>
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
