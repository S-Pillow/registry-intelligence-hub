import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { loadPromotedClaimActualityState } from "@/lib/claim-actuality-server";
import { loadHubRegistryData } from "@/lib/hub-registry-data-server";
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
  description: "A fixture-backed, source-provenance command center for ICANN application intelligence.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const claimActualityState = await loadPromotedClaimActualityState();
  const registryData = await loadHubRegistryData(claimActualityState);
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <HubClaimActualityProvider claimActualityState={claimActualityState}>
          <HubRegistryDataProvider resolution={registryData}>{children}</HubRegistryDataProvider>
        </HubClaimActualityProvider>
      </body>
    </html>
  );
}
