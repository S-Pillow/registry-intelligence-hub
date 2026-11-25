import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isForecastIntegratedCatalogEnabled } from "@/lib/forecast-publication-gate";
import { forecastOverviewHref } from "@/lib/forecast-routes";

export const metadata: Metadata = {
  title: "Experimental Registration Forecast — 2026 (local preview)",
};

export const dynamic = "force-dynamic";

/**
 * Legacy local-preview path.
 * Proxy issues a hard 307 when enabled; this page remains as defense in depth.
 */
export default async function ForecastLocalPreviewPage() {
  if (!isForecastIntegratedCatalogEnabled()) {
    notFound();
  }
  redirect(forecastOverviewHref());
}
