"use client";

import type { ForecastPublicationScenarioBand } from "@/lib/forecast-publication-candidate";
import { FORECAST_PUBLIC_SCENARIO_LABELS } from "@/lib/forecast-publication-candidate";

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

/**
 * Compact accessible horizontal comparison of Low / Middle / High scenarios.
 * Not a confidence interval — experimental scenario values only.
 */
export function ForecastScenarioBars({
  scenarios,
  measuredDomainCount,
  compact = false,
}: {
  scenarios: ForecastPublicationScenarioBand | null;
  measuredDomainCount: number;
  compact?: boolean;
}) {
  if (!scenarios) {
    return (
      <div
        className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
        data-testid="forecast-scenario-unavailable"
        role="status"
      >
        Scenario estimates are unavailable for this string. The measured match count (
        {formatCount(measuredDomainCount)}) is retained; conversion to four-year scenarios is not
        recommended.
      </div>
    );
  }

  const max = Math.max(scenarios.low, scenarios.middle, scenarios.high, 1);
  const rows: Array<{ key: keyof ForecastPublicationScenarioBand; label: string; value: number }> = [
    { key: "low", label: FORECAST_PUBLIC_SCENARIO_LABELS.low, value: scenarios.low },
    { key: "middle", label: FORECAST_PUBLIC_SCENARIO_LABELS.middle, value: scenarios.middle },
    { key: "high", label: FORECAST_PUBLIC_SCENARIO_LABELS.high, value: scenarios.high },
  ];

  return (
    <div
      className={compact ? "space-y-1.5" : "space-y-2"}
      data-testid="forecast-scenario-bars"
      role="img"
      aria-label={`Low ${scenarios.low}, Middle ${scenarios.middle}, High ${scenarios.high} experimental registration scenarios`}
    >
      {rows.map((row) => {
        const widthPct = Math.max(2, Math.round((row.value / max) * 100));
        return (
          <div key={row.key} className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-2">
            <span className="text-xs font-semibold text-slate-700">{row.label}</span>
            <div className="h-2.5 overflow-hidden rounded bg-slate-100" aria-hidden>
              <div
                className={`h-full rounded ${
                  row.key === "middle" ? "bg-[#006a56]" : "bg-[#72dfb4]"
                }`}
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <span className="text-right text-sm font-semibold tabular-nums text-slate-950">
              {formatCount(row.value)}
            </span>
          </div>
        );
      })}
      <p className="text-[11px] text-slate-500">
        Experimental scenarios — not confidence intervals or verified demand.
      </p>
    </div>
  );
}
