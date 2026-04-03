import type { Metadata } from "next";
import { webEnv } from "./runtime-env";

export const SITE_NAME = "Wardline";
export const SITE_DESCRIPTION =
  "HIPAA-aligned AI voice call operations for independent medical practices.";

export const metadataBase = new URL(webEnv.NEXT_PUBLIC_WEB_BASE_URL);

export const noIndexRobots: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
};

type MarketingMetadataInput = {
  title: string;
  description: string;
  path: string;
};

export function createMarketingMetadata({
  title,
  description,
  path,
}: MarketingMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url: path,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export const defaultSiteMetadata: Metadata = {
  metadataBase,
  title: {
    default: "Wardline | Medical Practice Call Operations",
    template: "%s | Wardline",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Wardline | Medical Practice Call Operations",
    description: SITE_DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wardline | Medical Practice Call Operations",
    description: SITE_DESCRIPTION,
  },
};

export const noIndexMetadata: Metadata = {
  robots: noIndexRobots,
};
