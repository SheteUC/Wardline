import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal-document-page";
import { createMarketingMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMarketingMetadata({
  title: "Privacy Policy",
  description:
    "How Wardline handles account data, call operations data, support communications, and security controls.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalDocumentPage
      eyebrow="Legal"
      title="Privacy Policy"
      summary="This page describes the current privacy posture for Wardline's web app, API, and voice-runtime surfaces. It is the active public policy page for the product and should be replaced with counsel-reviewed language before regulated production launch."
    >
      <section>
        <h2 className="text-xl font-bold text-foreground">Information we collect</h2>
        <p className="mt-3">
          Wardline processes account information, practice configuration, call metadata,
          transcripts, voicemail references, integration health data, and support-contact
          submissions required to operate the platform.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground">How we use information</h2>
        <p className="mt-3">
          We use collected information to authenticate users, run the call workflow,
          persist call records, create follow-up tasks, monitor service health, and respond
          to support or sales requests.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground">Security and retention</h2>
        <p className="mt-3">
          Wardline is designed around restricted access, audit logging, encrypted transport,
          and environment-scoped secrets. Retention behavior depends on runtime configuration,
          business policy, and the deployment environment.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground">Contact</h2>
        <p className="mt-3">
          Questions about this policy can be sent through the contact form or by email to
          <a className="ml-1 font-semibold text-primary" href="mailto:hello@wardline.health">
            hello@wardline.health
          </a>
          .
        </p>
      </section>
    </LegalDocumentPage>
  );
}
