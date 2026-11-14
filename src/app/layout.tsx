import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubHistorical2012Provider } from "@/components/registry/hub-historical-2012-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { loadPromotedClaimActualityState } from "@/lib/claim-actuality-server";
import { loadHistorical2012ConfirmedPortfoliosResolution } from "@/historical-2012/confirmed-portfolios-server";
import { loadHistorical2012PayloadResolution } from "@/historical-2012/payload-server";
import { prepareHistorical2012SharedLayout } from "@/historical-2012/structural-summary";
import { loadHubRegistryData } from "@/lib/hub-registry-data-server";
import { HUB_BASE_PATH } from "@/lib/hub-paths";
import {
  HUB_CANONICAL_URL,
  HUB_OG_DESCRIPTION,
  HUB_OG_IMAGE_ALT,
  HUB_OG_IMAGE_HEIGHT,
  HUB_OG_IMAGE_PATH,
  HUB_OG_IMAGE_URL,
  HUB_OG_IMAGE_WIDTH,
  HUB_OG_SITE_NAME,
  HUB_OG_TITLE,
  HUB_PUBLIC_ORIGIN,
} from "@/lib/hub-social-metadata";
import { claimActualityAssertedForBrowser } from "@/lib/registry-application-payload-shared";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(`${HUB_PUBLIC_ORIGIN}${HUB_BASE_PATH}`),
  title: {
    default: HUB_OG_TITLE,
    template: "%s · Registry Intelligence Hub",
  },
  description: HUB_OG_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: HUB_OG_TITLE,
    description: HUB_OG_DESCRIPTION,
    url: HUB_CANONICAL_URL,
    siteName: HUB_OG_SITE_NAME,
    type: "website",
    images: [
      {
        url: HUB_OG_IMAGE_PATH,
        width: HUB_OG_IMAGE_WIDTH,
        height: HUB_OG_IMAGE_HEIGHT,
        alt: HUB_OG_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: HUB_OG_TITLE,
    description: HUB_OG_DESCRIPTION,
    images: [
      {
        url: HUB_OG_IMAGE_URL,
        width: HUB_OG_IMAGE_WIDTH,
        height: HUB_OG_IMAGE_HEIGHT,
        alt: HUB_OG_IMAGE_ALT,
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const configuredClaimActuality = await loadPromotedClaimActualityState();
  const [registryData, historical2012Full, confirmedPortfolios] = await Promise.all([
    loadHubRegistryData(configuredClaimActuality),
    loadHistorical2012PayloadResolution(),
    loadHistorical2012ConfirmedPortfoliosResolution(),
  ]);
  const { applicationPayload: historical2012, structuralSummary } = prepareHistorical2012SharedLayout(historical2012Full);
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <HubClaimActualityProvider claimActualityState={claimActualityAssertedForBrowser(configuredClaimActuality, registryData)}>
          <HubRegistryDataProvider resolution={registryData}>
            <HubHistorical2012Provider
              applicationPayload={historical2012}
              confirmedPortfolios={confirmedPortfolios}
              structuralSummary={structuralSummary}
            >
              {children}
            </HubHistorical2012Provider>
          </HubRegistryDataProvider>
        </HubClaimActualityProvider>
      </body>
    </html>
  );
}
