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
  title: {
    default: "Registry Intelligence Hub",
    template: "%s · Registry Intelligence Hub",
  },
  description: "Historical 2012 evidence for ICANN application intelligence. 2026 Reveal Day data is shown only after it is promoted.",
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
