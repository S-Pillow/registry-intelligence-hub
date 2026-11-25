"use client";

import { ForecastLink, type ForecastAvailability } from "@/components/registry/forecast-link";
import { sharedMiddleScenarioScaleMax } from "@/lib/forecast-publication-candidate";

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export type ForecastMiddleComparisonRow = {
  stringLabel: string;
  extension: string;
  middle: number | null;
  measuredDomainCount: number;
};

/**
 * Cross-extension Middle scenario comparison on one shared numerical scale.
 * Missing estimates are labeled, never charted as zero-length forecasts.
 */
export function ForecastMiddleComparison({
  rows,
  availability,
}: {
  rows: ReadonlyArray<ForecastMiddleComparisonRow>;
  availability: ForecastAvailability;
}) {
  const scaleMax = sharedMiddleScenarioScaleMax(rows.map((row) => row.middle));
  const ariaParts = rows.map((row) => {
    if (row.middle == null) return `${row.extension}: estimate unavailable`;
    return `${row.extension}: Middle ${formatCount(row.middle)}`;
  });

  return (
    <div
      className="space-y-3"
      data-testid="forecast-middle-comparison"
      role="img"
      aria-label={`Middle scenario comparison on a shared scale. ${ariaParts.join("; ")}`}
    >
      {rows.map((row) => {
        const middle = row.middle;
        const hasEstimate = middle != null && Number.isFinite(middle);
        let widthPct: number | null = null;
        if (hasEstimate && scaleMax != null) {
          widthPct =
            scaleMax > 0
              ? Math.max(middle === 0 ? 0 : 2, Math.round((middle / scaleMax) * 100))
              : 0;
        }

        return (
          <div
            key={row.stringLabel}
            className="grid grid-cols-[minmax(4.5rem,6rem)_1fr_minmax(4.5rem,6.5rem)] items-center gap-2"
            data-testid={`forecast-middle-comparison-${row.stringLabel}`}
          >
            <ForecastLink
              label={row.stringLabel}
              availability={availability}
              className="font-mono text-sm font-bold text-[#006a56] underline-offset-2 hover:underline"
            />
            <div className="min-w-0">
              {hasEstimate ? (
                <div className="h-2.5 overflow-hidden rounded bg-slate-100" aria-hidden>
                  <div
                    className="h-full rounded bg-[#006a56]"
                    style={{ width: `${widthPct ?? 0}%` }}
                  />
                </div>
              ) : (
                <p
                  className="text-xs text-slate-500"
                  data-testid={`forecast-middle-unavailable-${row.stringLabel}`}
                >
                  Estimate unavailable
                </p>
              )}
              <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
                {formatCount(row.measuredDomainCount)} measured matches
              </p>
            </div>
            <span className="text-right text-sm font-semibold tabular-nums text-slate-950">
              {hasEstimate ? formatCount(middle) : "—"}
            </span>
          </div>
        );
      })}
      {scaleMax != null ? (
        <p className="text-[11px] text-slate-500">
          Shared Middle scale · max listed estimate {formatCount(scaleMax)}
        </p>
      ) : (
        <p className="text-[11px] text-slate-500">No Middle estimates in the current listing.</p>
      )}
    </div>
  );
}
