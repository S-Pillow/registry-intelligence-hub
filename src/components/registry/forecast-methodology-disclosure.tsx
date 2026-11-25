import type { ForecastCatalogView } from "@/lib/forecast-publication-candidate";

export function ForecastMethodologyDisclosure({
  catalog,
  compact = false,
}: {
  catalog: Pick<
    ForecastCatalogView,
    | "methodologySummary"
    | "disclaimer"
    | "snapshotDate"
    | "referencePanelTlds"
    | "sourceUrl"
    | "attribution"
    | "conversionFactors"
  >;
  compact?: boolean;
}) {
  return (
    <section
      className={`rounded border border-amber-200 bg-amber-50/70 text-sm text-slate-800 ${
        compact ? "space-y-2 p-3" : "space-y-3 p-4"
      }`}
      data-testid="forecast-methodology-disclosure"
    >
      <h2 className="text-sm font-bold text-slate-950">How to read these numbers</h2>
      <p>
        <strong>Measured matches</strong> count existing domains whose second-level names equal or
        literally end with the proposed extension string.{" "}
        <strong>Estimated registrations</strong> apply experimental Low / Middle / High factors (
        {catalog.conversionFactors.conservative} / {catalog.conversionFactors.expected} /{" "}
        {catalog.conversionFactors.optimistic}) to that count for an approximately four-year horizon.
        Estimates are not statistically validated market predictions.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-xs sm:text-sm">
        <li>
          ActiveDNS source:{" "}
          <a
            className="font-medium text-[#006a56] underline"
            href={catalog.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            {catalog.sourceUrl}
          </a>
        </li>
        <li>Snapshot date: November 7, 2026 ({catalog.snapshotDate})</li>
        <li>
          Reference TLDs: {catalog.referencePanelTlds.map((t) => `.${t}`).join(", ")} —{" "}
          <strong>.com and other TLDs are not represented</strong>
        </li>
        <li>
          Common word endings can produce many literal matches without establishing registration
          intent
        </li>
      </ul>
      <details className="text-xs text-slate-600" data-testid="forecast-methodology-details">
        <summary className="cursor-pointer font-semibold text-slate-800">
          Methodology and limitations
        </summary>
        <div className="mt-2 space-y-2">
          <p>{catalog.methodologySummary}</p>
          {!compact ? <p>{catalog.disclaimer}</p> : null}
          <p>{catalog.attribution}</p>
        </div>
      </details>
    </section>
  );
}
