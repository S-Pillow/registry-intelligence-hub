import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ForecastDetailContent } from "@/components/registry/forecast-detail-content";
import { loadForecastCatalog } from "@/lib/forecast-catalog-server";
import { findForecastStringView } from "@/lib/forecast-publication-candidate";
import { decodeForecastLabelParam } from "@/lib/forecast-routes";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ label: string }>;
}): Promise<Metadata> {
  const { label: raw } = await params;
  const label = decodeForecastLabelParam(raw);
  return {
    title: label ? `.${label} — experimental forecast` : "Experimental forecast",
    robots: { index: false, follow: false },
  };
}

/**
 * Detail UI. Hard HTTP 404/503 for missing labels and catalog failures are enforced in
 * `src/proxy.ts` under production serving; notFound() remains defense in depth.
 */
export default async function ForecastDetailPage({
  params,
}: {
  params: Promise<{ label: string }>;
}) {
  const { label: raw } = await params;
  const label = decodeForecastLabelParam(raw);
  if (!label) notFound();

  const loaded = await loadForecastCatalog();
  if (loaded.status !== "ok") notFound();

  const row = findForecastStringView(loaded.catalog, label);
  if (!row) notFound();

  return <ForecastDetailContent catalog={loaded.catalog} row={row} />;
}
