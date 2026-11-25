import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ForecastLocalPreviewContent } from "@/components/registry/forecast-local-preview-content";
import { isForecastLocalPreviewEnabled } from "@/lib/forecast-local-preview";
import { loadForecastLocalPreviewView } from "@/lib/forecast-local-preview-server";

export const metadata: Metadata = {
  title: "Experimental Registration Forecast — 2026 (local preview)",
};

export const dynamic = "force-dynamic";

export default async function ForecastLocalPreviewPage() {
  // Fail closed before any preview file I/O when the development gate is closed.
  if (!isForecastLocalPreviewEnabled()) {
    notFound();
  }

  const loaded = await loadForecastLocalPreviewView();

  if (loaded.status === "disabled") {
    notFound();
  }

  if (loaded.status === "error") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8" data-testid="forecast-local-preview-unavailable">
        <h1 className="text-xl font-bold text-slate-950">Local forecast preview unavailable</h1>
        <p className="mt-2 text-sm text-slate-700">
          The development preview could not be loaded. Confirm the accepted local preview file is
          present and matches the expected SHA-256 pin.
        </p>
        <p className="mt-2 font-mono text-xs text-slate-600">{loaded.reason}</p>
      </main>
    );
  }

  return <ForecastLocalPreviewContent view={loaded.view} />;
}
