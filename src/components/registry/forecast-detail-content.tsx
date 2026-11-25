import Link from "next/link";
import { ForecastMethodologyDisclosure } from "@/components/registry/forecast-methodology-disclosure";
import { ForecastScenarioBars } from "@/components/registry/forecast-scenario-bars";
import { ForecastUnknownValue } from "@/components/registry/forecast-unknown";
import {
  formatForecastOriginLabel,
  type ForecastCatalogView,
  type ForecastStringView,
} from "@/lib/forecast-publication-candidate";
import { forecastOverviewHref } from "@/lib/forecast-routes";

function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function ForecastDetailContent({
  catalog,
  row,
}: {
  catalog: ForecastCatalogView;
  row: ForecastStringView;
}) {
  return (
    <div className="min-h-screen bg-[#f4f7f8]" data-testid="forecast-detail-page">
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
            <Link
              href={forecastOverviewHref()}
              className="px-3 py-3 text-sm font-semibold text-slate-600 hover:text-slate-950"
            >
              Forecast (experimental)
            </Link>
            <span className="border-b-2 border-[#006a56] px-3 py-3 text-sm font-semibold text-[#006a56]">
              {row.extension}
            </span>
          </nav>
        </div>
      </div>

      <main className="mx-auto max-w-[960px] px-4 py-6 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">
          Experimental forecast
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950" data-testid="forecast-detail-heading">
          {row.extension}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-700">
          These scenarios are experimental estimates, not verified registration demand or a
          prediction of application approval.
        </p>

        <section
          className="mt-5 grid gap-3 rounded border border-slate-200 bg-white p-4 sm:grid-cols-2"
          data-testid="forecast-detail-summary"
        >
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Measured matches
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">
              {formatCount(row.measuredDomainCount)}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              Existing domains whose second-level names equal or literally end with this string.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Forecast availability
            </p>
            <p className="mt-1 text-lg font-bold text-slate-950">
              {row.status === "estimated" ? "Scenarios available" : "Scenarios not recommended"}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {row.status === "estimated"
                ? "Low / Middle / High apply fixed experimental factors to the measured count."
                : "Measured matches are shown; numeric scenarios are intentionally withheld."}
            </p>
          </div>
        </section>

        <section className="mt-5 rounded border border-slate-200 bg-white p-4" data-testid="forecast-detail-scenarios">
          <h2 className="text-sm font-bold text-slate-950">Estimated registrations (Low / Middle / High)</h2>
          <div className="mt-3">
            <ForecastScenarioBars
              scenarios={row.scenarios}
              measuredDomainCount={row.measuredDomainCount}
            />
          </div>
        </section>

        <section className="mt-5 rounded border border-slate-200 bg-white p-4 text-sm" data-testid="forecast-detail-context">
          <h2 className="text-sm font-bold text-slate-950">Application context (observed)</h2>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Brand designation</dt>
              <dd className="mt-0.5 text-slate-900">
                <ForecastUnknownValue value={row.brandDesignationObserved} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-slate-500">Contested</dt>
              <dd className="mt-0.5 text-slate-900">
                <ForecastUnknownValue value={row.contested} />
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase text-slate-500">Source</dt>
              <dd className="mt-0.5 text-slate-800">{row.sourceDetail}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase text-slate-500">Observed origins</dt>
              <dd className="mt-0.5 text-slate-800">
                {(row.origins ?? []).length
                  ? row.origins!.map(formatForecastOriginLabel).join("; ")
                  : "Unknown"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-600">
            Brand designation and contention metadata do not suppress measured matches. Missing
            application-export details are not a rejection or ineligibility finding.
          </p>
        </section>

        <div className="mt-5">
          <ForecastMethodologyDisclosure catalog={catalog} compact />
        </div>

        <p className="mt-6 text-sm">
          <Link href={forecastOverviewHref()} className="font-semibold text-[#006a56] underline">
            Back to forecast overview
          </Link>
        </p>
      </main>
    </div>
  );
}
