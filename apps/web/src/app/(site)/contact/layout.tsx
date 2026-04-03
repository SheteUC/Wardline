import type { ReactNode } from "react";
import { JsonLd } from "@/components/json-ld";
import { createMarketingMetadata } from "@/lib/metadata";

export const metadata = createMarketingMetadata({
  title: "Contact Wardline",
  description:
    "Talk to Wardline about pricing, rollout planning, and AI receptionist fit for your practice.",
  path: "/contact",
});

export default function ContactLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: "Contact Wardline",
          url: "https://wardline.health/contact",
          about: "Medical practice AI receptionist sales and support inquiries",
        }}
      />
    </>
  );
}
