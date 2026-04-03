import type { Metadata } from "next";
import { LegalDocumentPage } from "@/components/legal-document-page";
import { createMarketingMetadata } from "@/lib/metadata";

export const metadata: Metadata = createMarketingMetadata({
  title: "Terms of Service",
  description:
    "Current public terms for access to Wardline's product surfaces, support channels, and deployment environments.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalDocumentPage
      eyebrow="Legal"
      title="Terms of Service"
      summary="These are the current public terms for using Wardline. They are suitable for the live site surface today and should be replaced with counsel-reviewed commercial terms before broad production rollout."
    >
      <section>
        <h2 className="text-xl font-bold text-foreground">Use of the service</h2>
        <p className="mt-3">
          Wardline is provided for business call operations and related staff workflows.
          Customers are responsible for lawful use, account access control, and the accuracy
          of practice configuration supplied to the platform.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground">Availability and changes</h2>
        <p className="mt-3">
          Features, integrations, and operational limits may change as the product evolves.
          Preview and development environments are provided without production SLA guarantees.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground">Customer responsibilities</h2>
        <p className="mt-3">
          Customers are responsible for their users, telephony configuration, third-party
          credentials, and business policies configured through the dashboard or supporting
          operational tooling.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-bold text-foreground">Contact</h2>
        <p className="mt-3">
          Commercial or legal questions should be directed to
          <a className="ml-1 font-semibold text-primary" href="mailto:hello@wardline.health">
            hello@wardline.health
          </a>
          .
        </p>
      </section>
    </LegalDocumentPage>
  );
}
