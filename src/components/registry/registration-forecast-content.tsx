import Link from "next/link";
import {
  FORECAST_CONVERSION_FACTORS,
  FORECAST_ESTIMATE_DISCLAIMER,
  FORECAST_HORIZON_LABEL,
  type ForecastRow,
  type SuffixDemandEvidence,
  summarizeForecastCoverage,
} from "@/lib/registration-forecast";

function HubChrome() {
  return (
    <>
      <header className="border-b border-white/10 bg-[#101923] text-white">
        <div className="mx-auto flex h-14 max-w-[1480px] items-center px-4 sm:px-6">
          <Link href="/" className="font-mono text-sm font-semibold tracking-[0.2em]">
            FORGE<span className="text-[#72dfb4]">/</span>FORWARD
          </Link>
        </div>
      </header>
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-[1480px] px-2 sm:px-6">
          <nav aria-label="Hub business navigation" className="flex flex-wrap gap-1">
            <Link href="/" className="px-3 py-3 text-sm font-semibold text-slate-600 hover:text-slate-950">
              Command Center
            </Link>
            <Link href="/market" className="px-3 py-3 text-sm font-semibold text-slate-600 hover:text-slate-950">
              Registry Market
            </Link>
            <span className="border-b-2 border-[#006a56] px-3 py-3 text-sm font-semibold text-[#006a56]">
              Forecast (experimental)
            </span>
            <Link
              href="/data-health"
              className="px-3 py-3 text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              Data &amp; methodology
            </Link>
          </nav>
        </div>
      </div>
    </>
  );
}

function RangeChart({ row }: { row: ForecastRow }) {
  if (!row.range) {
    return (
      <div
        className="flex h-28 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 px-3 text-center text-xs text-slate-600"
        data-testid={`forecast-chart-empty-${row.stringLabel}`}
      >
        No numeric forecast — demand evidence unavailable or string excluded
      </div>
    );
  }
  const max = Math.max(row.range.optimistic, 1);
  const bars = [
    { key: "conservative", label: "Conservative", value: row.range.conservative, color: "bg-slate-400" },
    { key: "expected", label: "Expected", value: row.range.expected, color: "bg-[#006a56]" },
    { key: "optimistic", label: "Optimistic", value: row.range.optimistic, color: "bg-[#72dfb4]" },
  ] as const;
  return (
    <div className="grid grid-cols-3 gap-2" data-testid={`forecast-chart-${row.stringLabel}`}>
      {bars.map((bar) => (
        <div key={bar.key} className="flex flex-col items-center justify-end">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{bar.label}</p>
          <div className="flex h-24 w-full items-end rounded bg-slate-100 px-2 pb-1">
            <div
              className={`w-full rounded-sm ${bar.color}`}
              style={{ height: `${Math.max(8, (bar.value / max) * 100)}%` }}
              title={`${bar.value}`}
            />
          </div>
          <p className="mt-1 text-xs font-bold tabular-nums text-slate-900">{bar.value.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

export function RegistrationForecastContent({
  rows,
  demandEvidence,
  applicationSnapshotId,
}: {
  rows: ForecastRow[];
  demandEvidence: SuffixDemandEvidence;
  applicationSnapshotId: string;
}) {
  const coverage = summarizeForecastCoverage(rows);

  return (
    <div className="min-h-screen bg-[#f4f7f8]" data-testid="registration-forecast-page">
      <HubChrome />
      <main className="mx-auto max-w-[1100px] px-4 py-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">Experimental</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Registration forecast (v1)
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
          Practical estimates of how many domains an eligible 2026 extension might hold{" "}
          {FORECAST_HORIZON_LABEL}. One forecast per unique selected/current string. Closed-brand
          strings are excluded. Contested strings keep contention status — winners are not predicted.
        </p>
        <p
          className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
          data-testid="forecast-estimate-disclaimer"
        >
          {FORECAST_ESTIMATE_DISCLAIMER}
        </p>

        <section className="mt-6 rounded-lg border border-slate-200 bg-white px-4 py-4" data-testid="forecast-assumptions">
          <h2 className="text-sm font-bold text-slate-950">Assumptions</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            <li>
              Method inspiration: publicly described Toyroom suffix-demand approach (independent RIH
              implementation; Toyroom predictions are not shown as RIH facts).
            </li>
            <li>
              Experimental conversions for word-like / compound strings: conservative{" "}
              {FORECAST_CONVERSION_FACTORS.conservative}, expected {FORECAST_CONVERSION_FACTORS.expected},
              optimistic {FORECAST_CONVERSION_FACTORS.optimistic}.
            </li>
            <li>
              ICANN MRR TLD totals are <strong>not</strong> used as suffix-demand counts.
            </li>
          </ul>
        </section>

        <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-4" data-testid="forecast-source-coverage">
          <h2 className="text-sm font-bold text-slate-950">Source coverage</h2>
          <p className="mt-2 text-sm text-slate-700">
            Application basis: <span className="font-mono text-xs">{applicationSnapshotId}</span>
          </p>
          <p className="mt-1 text-sm text-slate-700" data-testid="forecast-demand-status">
            Demand evidence:{" "}
            <strong>{demandEvidence.status === "available" ? "available" : "unavailable"}</strong>
            {" — "}
            {demandEvidence.sourceLabel}
          </p>
          <p className="mt-1 text-sm text-slate-700">{demandEvidence.coverageNote}</p>
          {demandEvidence.status === "unavailable" ? (
            <div className="mt-3 space-y-1 text-sm text-slate-700" data-testid="forecast-demand-blocker">
              <p>
                <span className="font-semibold">Blocker:</span> {demandEvidence.blocker}
              </p>
              <p>
                <span className="font-semibold">Simplest alternative:</span>{" "}
                {demandEvidence.simplestAlternative}
              </p>
            </div>
          ) : null}
          <p className="mt-3 text-xs text-slate-600" data-testid="forecast-coverage-summary">
            Examples: {coverage.exampleCount} · ready: {coverage.readyCount} · demand unavailable:{" "}
            {coverage.demandUnavailableCount} · brand excluded: {coverage.excludedBrandCount} ·
            contested examples: {coverage.contestedExampleCount}
          </p>
        </section>

        <section className="mt-8" aria-labelledby="forecast-examples-heading">
          <h2 id="forecast-examples-heading" className="text-lg font-bold text-slate-950">
            Representative examples
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {rows.length} curated strings from the active application publication (when present in the
            corpus).
          </p>
          <ul className="mt-4 space-y-4">
            {rows.map((row) => (
              <li
                key={row.stringLabel}
                className="rounded-lg border border-slate-200 bg-white px-4 py-4"
                data-testid={`forecast-row-${row.stringLabel}`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-950">.{row.stringLabel}</h3>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {row.status.split("_").join(" ")}
                  </p>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {row.applicantCount} Applicant{row.applicantCount === 1 ? "" : "s"}
                  {row.contested
                    ? ` · Contested (set ${row.officialContentionSetIds.join(", ") || "—"}) — winner not predicted`
                    : " · No published contention membership in this observation"}
                </p>
                <p className="mt-2 text-sm text-slate-700">{row.statusNote}</p>
                <div className="mt-4">
                  <RangeChart row={row} />
                </div>
                {row.range ? (
                  <p className="mt-2 text-xs text-slate-600" data-testid={`forecast-range-${row.stringLabel}`}>
                    Range: {row.range.conservative.toLocaleString()} – {row.range.expected.toLocaleString()}{" "}
                    – {row.range.optimistic.toLocaleString()} registrations ({FORECAST_HORIZON_LABEL})
                    {row.suffixDemandCount != null
                      ? ` · suffix-demand count ${row.suffixDemandCount.toLocaleString()}`
                      : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {rows.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600" data-testid="forecast-examples-empty">
              None of the curated example strings are present in the active application publication.
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
