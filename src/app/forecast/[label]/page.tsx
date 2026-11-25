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
  };
}

export default async function ForecastDetailPage({
  params,
}: {
  params: Promise<{ label: string }>;
}) {
  const { label: raw } = await params;
  const label = decodeForecastLabelParam(raw);
  if (!label) notFound();

  const loaded = await loadForecastCatalog();
  if (loaded.status === "disabled") notFound();
  if (loaded.status !== "ok") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8" data-testid="forecast-detail-unavailable">
        <h1 className="text-xl font-bold">Forecast unavailable</h1>
        <p className="mt-2 text-sm text-slate-700">{loaded.reason}</p>
      </main>
    );
  }

  const row = findForecastStringView(loaded.catalog, label);
  if (!row) notFound();

  return <ForecastDetailContent catalog={loaded.catalog} row={row} />;
}
