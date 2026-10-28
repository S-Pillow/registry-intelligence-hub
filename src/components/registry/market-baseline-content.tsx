"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DATA_METHODOLOGY_HREF,
  formatGrowthRatio,
  formatInteger,
  formatOptionalMetric,
  type RegistryMarketCurrentRow,
  type RegistryMarketDetailModel,
  type RegistryMarketOverviewModel,
} from "@/lib/market-baseline-ui";
import type { ProductPresentation } from "@/lib/presentation-mode";
import { withRehearsalPresentation } from "@/lib/presentation-mode";

const PAGE_SIZE = 50;

function presentationHref(href: string, presentation: ProductPresentation) {
  return withRehearsalPresentation(href, presentation);
}

function FailClosedPanel({
  title,
  message,
  presentation,
}: {
  title: string;
  message: string;
  presentation: ProductPresentation;
}) {
  return (
    <section
      data-testid="registry-market-fail-closed"
      className="rounded-xl border border-slate-300 bg-white p-6 shadow-sm"
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006a56]">
        Registry Market
      </p>
      <h1 className="mt-2 text-2xl font-bold text-slate-950">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">{message}</p>
      <p className="mt-4 text-sm">
        <Link
          href={presentationHref(DATA_METHODOLOGY_HREF, presentation)}
          className="font-semibold text-[#006a56] underline"
        >
          Data &amp; methodology
        </Link>
      </p>
    </section>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

type SortKey =
  | "domains"
  | "mom"
  | "yoy"
  | "breadth"
  | "tld";

function sortRows(
  rows: RegistryMarketCurrentRow[],
  sortKey: SortKey,
  direction: "asc" | "desc",
): RegistryMarketCurrentRow[] {
  const dir = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const aAvail = a.availability === "AVAILABLE";
    const bAvail = b.availability === "AVAILABLE";
    if (sortKey !== "tld") {
      if (aAvail !== bAvail) return aAvail ? -1 : 1;
    }
    if (sortKey === "tld") {
      return dir * a.tldAsciiLabel.localeCompare(b.tldAsciiLabel);
    }
    if (sortKey === "domains") {
      return dir * ((a.totalDomains ?? -1) - (b.totalDomains ?? -1));
    }
    if (sortKey === "mom") {
      const av = a.monthOverMonthGrowth?.available
        ? a.monthOverMonthGrowth.value!
        : Number.NEGATIVE_INFINITY;
      const bv = b.monthOverMonthGrowth?.available
        ? b.monthOverMonthGrowth.value!
        : Number.NEGATIVE_INFINITY;
      return dir * (av - bv);
    }
    if (sortKey === "yoy") {
      const av = a.yearOverYearGrowth?.available
        ? a.yearOverYearGrowth.value!
        : Number.NEGATIVE_INFINITY;
      const bv = b.yearOverYearGrowth?.available
        ? b.yearOverYearGrowth.value!
        : Number.NEGATIVE_INFINITY;
      return dir * (av - bv);
    }
    return dir * ((a.registrarBreadth ?? -1) - (b.registrarBreadth ?? -1));
  });
}

function AllTldExplorer({
  rows,
  presentation,
}: {
  rows: RegistryMarketCurrentRow[];
  presentation: ProductPresentation;
}) {
  const [query, setQuery] = useState("");
  const [availability, setAvailability] = useState<"all" | "available" | "missing">(
    "all",
  );
  const [sortKey, setSortKey] = useState<SortKey>("domains");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\./, "");
    let next = rows;
    if (availability === "available") {
      next = next.filter((r) => r.availability === "AVAILABLE");
    } else if (availability === "missing") {
      next = next.filter((r) => r.availability === "MISSING");
    }
    if (q) {
      next = next.filter((r) => r.tldAsciiLabel.includes(q));
    }
    return sortRows(next, sortKey, direction);
  }, [rows, query, availability, sortKey, direction]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  return (
    <section data-testid="registry-market-explorer" className="mt-8">
      <h2 className="text-lg font-bold text-slate-950">All TLDs in baseline</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">
        Report unavailable means no accepted Transactions report for the source
        period — not zero domains.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Search TLD</span>
          <input
            data-testid="registry-market-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            className="h-9 w-48 rounded-lg border border-slate-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]"
            placeholder="com"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Data state</span>
          <select
            data-testid="registry-market-availability-filter"
            value={availability}
            onChange={(e) => {
              setAvailability(e.target.value as typeof availability);
              setPage(0);
            }}
            className="h-9 rounded-lg border border-slate-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]"
          >
            <option value="all">All</option>
            <option value="available">Available</option>
            <option value="missing">Report unavailable</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Sort</span>
          <select
            data-testid="registry-market-sort"
            value={`${sortKey}:${direction}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(":") as [SortKey, "asc" | "desc"];
              setSortKey(k);
              setDirection(d);
              setPage(0);
            }}
            className="h-9 rounded-lg border border-slate-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]"
          >
            <option value="domains:desc">Reported domains (high → low)</option>
            <option value="domains:asc">Reported domains (low → high)</option>
            <option value="mom:desc">MoM (high → low)</option>
            <option value="yoy:desc">YoY (high → low)</option>
            <option value="breadth:desc">Registrar breadth (high → low)</option>
            <option value="tld:asc">TLD (A → Z)</option>
          </select>
        </label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[720px] w-full border-collapse text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="px-3 py-2 font-semibold">
                TLD
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Data state
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Reported domains
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                MoM
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                YoY
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Registrar breadth
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Top registrar share
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Open
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.tldAsciiLabel} className="border-t border-slate-100">
                <td className="px-3 py-2 font-semibold text-slate-950">
                  {row.displayLabel}
                </td>
                <td className="px-3 py-2 text-slate-700">{row.dataStateLabel}</td>
                <td className="px-3 py-2 tabular-nums text-slate-800">
                  {row.totalDomains === null ? "—" : formatInteger(row.totalDomains)}
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-800">
                  {row.monthOverMonthGrowth?.available
                    ? formatGrowthRatio(row.monthOverMonthGrowth.value!)
                    : "—"}
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-800">
                  {row.yearOverYearGrowth?.available
                    ? formatGrowthRatio(row.yearOverYearGrowth.value!)
                    : "—"}
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-800">
                  {row.registrarBreadth === null ? "—" : formatInteger(row.registrarBreadth)}
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-800">
                  {formatOptionalMetric(row.topRegistrarShare, { percent: true })}
                </td>
                <td className="px-3 py-2">
                  <Link
                    href={presentationHref(row.href, presentation)}
                    className="font-semibold text-[#006a56] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]"
                  >
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Top registrar share is relative to this TLD&apos;s reported total domains only.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]"
          disabled={safePage <= 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          Previous
        </button>
        <span data-testid="registry-market-page-indicator">
          Page {safePage + 1} of {pageCount} · {filtered.length} TLDs
        </span>
        <button
          type="button"
          className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007d65]"
          disabled={safePage >= pageCount - 1}
          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
        >
          Next
        </button>
      </div>
    </section>
  );
}

export function MarketBaselineOverviewContent({
  model,
  presentation = "pre-reveal",
}: {
  model: RegistryMarketOverviewModel;
  presentation?: ProductPresentation;
}) {
  if (model.status !== "READY" || !model.coverage) {
    return (
      <FailClosedPanel
        title="Registry Market unavailable"
        message={model.userMessage}
        presentation={presentation}
      />
    );
  }

  const topDomain = model.domainBaseRanking.slice(0, 10);
  const topGrowth = model.monthOverMonthGrowthRanking.slice(0, 10);

  return (
    <div data-testid="registry-market-overview" className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006a56]">
          Registry Market
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Registry lifecycle intelligence
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
          Public ICANN registry operational data from Monthly Registry Reports
          (Transactions). This baseline is period-specific and is not Applicant or
          Competitive Landscape intelligence.
        </p>
        <p className="mt-3 text-sm">
          <Link
            href={presentationHref(DATA_METHODOLOGY_HREF, presentation)}
            className="font-semibold text-[#006a56] underline"
          >
            Data &amp; methodology
          </Link>
        </p>
        <p
          className="mt-3 max-w-3xl text-sm leading-6 text-slate-600"
          data-testid="registry-market-source-rights-note"
        >
          Registry Market metrics are derived from ICANN Monthly Registry Reports and related public
          registry data. Source material retains its original ownership and terms. RIH publishes
          derived intelligence and provenance rather than relicensing the underlying reports.
        </p>
      </header>

      <section
        data-testid="registry-market-source-orientation"
        className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm"
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Source period
            </dt>
            <dd className="mt-1 text-lg font-bold text-slate-950">
              {model.sourcePeriodLabel}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Source
            </dt>
            <dd className="mt-1 text-sm font-medium text-slate-900">
              {model.sourceSystemLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              TLDs in baseline
            </dt>
            <dd className="mt-1 text-lg font-bold tabular-nums">
              {formatInteger(model.coverage.tldCountInPublication)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Report available
            </dt>
            <dd className="mt-1 text-lg font-bold tabular-nums text-[#006a56]">
              {formatInteger(model.coverage.availableAtSourcePeriod)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Report unavailable
            </dt>
            <dd className="mt-1 text-lg font-bold tabular-nums text-slate-800">
              {formatInteger(model.coverage.missingAtSourcePeriod)}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-slate-600">
          A missing report does <strong>not</strong> mean the TLD has zero domains.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          data-testid="registry-market-domain-ranking"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 className="text-base font-bold text-slate-950">
            Largest TLDs by reported domains
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                <tr>
                  <th scope="col" className="px-2 py-2">
                    Rank
                  </th>
                  <th scope="col" className="px-2 py-2">
                    TLD
                  </th>
                  <th scope="col" className="px-2 py-2">
                    Reported domains
                  </th>
                  <th scope="col" className="px-2 py-2">
                    MoM
                  </th>
                </tr>
              </thead>
              <tbody>
                {topDomain.map((row) => (
                  <tr key={row.tldAsciiLabel} className="border-t border-slate-100">
                    <td className="px-2 py-2 tabular-nums">{row.rank}</td>
                    <td className="px-2 py-2">
                      <Link
                        href={presentationHref(row.href, presentation)}
                        className="font-semibold text-[#006a56] underline"
                      >
                        {row.displayLabel}
                      </Link>
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {formatInteger(row.totalDomains)}
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {row.monthOverMonthGrowth?.available
                        ? formatGrowthRatio(row.monthOverMonthGrowth.value!)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section
          data-testid="registry-market-growth-ranking"
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <h2 className="text-base font-bold text-slate-950">
            Fastest monthly growth
          </h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                <tr>
                  <th scope="col" className="px-2 py-2">
                    Rank
                  </th>
                  <th scope="col" className="px-2 py-2">
                    TLD
                  </th>
                  <th scope="col" className="px-2 py-2">
                    MoM
                  </th>
                  <th scope="col" className="px-2 py-2">
                    Reported domains
                  </th>
                </tr>
              </thead>
              <tbody>
                {topGrowth.map((row) => (
                  <tr key={row.tldAsciiLabel} className="border-t border-slate-100">
                    <td className="px-2 py-2 tabular-nums">{row.rank}</td>
                    <td className="px-2 py-2">
                      <Link
                        href={presentationHref(row.href, presentation)}
                        className="font-semibold text-[#006a56] underline"
                      >
                        {row.displayLabel}
                      </Link>
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {formatGrowthRatio(row.monthOverMonthGrowth)}
                    </td>
                    <td className="px-2 py-2 tabular-nums">
                      {formatInteger(row.totalDomains)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <AllTldExplorer rows={model.currentPeriodRows} presentation={presentation} />
    </div>
  );
}

export function MarketBaselineDetailContent({
  model,
  presentation = "pre-reveal",
}: {
  model: RegistryMarketDetailModel;
  presentation?: ProductPresentation;
}) {
  if (
    model.status === "PUBLICATION_ABSENT"
    || model.status === "PUBLICATION_INVALID"
    || model.status === "TLD_SHARD_INVALID"
  ) {
    return (
      <FailClosedPanel
        title="Registry Market unavailable"
        message={model.userMessage}
        presentation={presentation}
      />
    );
  }

  if (model.status === "TLD_NOT_FOUND") {
    return (
      <FailClosedPanel
        title="TLD not found"
        message={model.userMessage}
        presentation={presentation}
      />
    );
  }

  const m = model.metrics;

  return (
    <div data-testid="registry-market-detail" className="space-y-6">
      <p className="text-sm">
        <Link
          href={presentationHref("/market", presentation)}
          className="font-semibold text-[#006a56] underline"
        >
          Registry Market
        </Link>
        {" · "}
        <Link
          href={presentationHref(DATA_METHODOLOGY_HREF, presentation)}
          className="font-semibold text-[#006a56] underline"
        >
          Data &amp; methodology
        </Link>
      </p>

      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006a56]">
          Registry Market
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          {model.displayLabel}
        </h1>
        <dl className="mt-3 flex flex-wrap gap-4 text-sm text-slate-700">
          <div>
            <dt className="inline font-medium text-slate-500">Source period: </dt>
            <dd className="inline font-semibold text-slate-900">
              {model.sourcePeriodLabel}
            </dd>
          </div>
          <div>
            <dt className="inline font-medium text-slate-500">Data state: </dt>
            <dd className="inline font-semibold text-slate-900">
              {model.dataStateLabel}
            </dd>
          </div>
        </dl>
        {model.status === "MISSING_CURRENT_REPORT" ? (
          <p
            data-testid="registry-market-missing-note"
            className="mt-3 max-w-2xl rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          >
            {model.userMessage}
          </p>
        ) : null}
      </header>

      {m ? (
        <>
          <section
            data-testid="registry-market-current-metrics"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            <MetricCard
              label="Reported domains"
              value={formatInteger(m.totalDomains ?? 0)}
            />
            <MetricCard
              label="Monthly growth"
              value={formatOptionalMetric(m.monthOverMonthGrowth, { percent: true })}
              hint={
                m.monthOverMonthGrowth && !m.monthOverMonthGrowth.available
                  ? m.monthOverMonthGrowth.reason ?? undefined
                  : undefined
              }
            />
            <MetricCard
              label="Year-over-year growth"
              value={formatOptionalMetric(m.yearOverYearGrowth, { percent: true })}
              hint={
                m.yearOverYearGrowth && !m.yearOverYearGrowth.available
                  ? m.yearOverYearGrowth.reason ?? undefined
                  : undefined
              }
            />
            <MetricCard
              label="Registrar breadth"
              value={
                m.registrarBreadth === null ? "Unavailable" : formatInteger(m.registrarBreadth)
              }
            />
            <MetricCard
              label="Top registrar share"
              value={formatOptionalMetric(m.topRegistrarShare, { percent: true })}
              hint="Share of this TLD's reported total domains"
            />
            <MetricCard
              label="Top 5 registrar share"
              value={formatOptionalMetric(m.top5RegistrarShare, { percent: true })}
              hint="Share of this TLD's reported total domains"
            />
          </section>

          <section data-testid="registry-market-activity-counts">
            <h2 className="text-base font-bold text-slate-950">
              Current-period activity counts
            </h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard
                label="Net adds count"
                value={formatInteger(m.netAddsCount ?? 0)}
              />
              <MetricCard
                label="Net renew count"
                value={formatInteger(m.netRenewCount ?? 0)}
                hint="This is a count, not a percentage"
              />
              <MetricCard label="Deletes" value={formatInteger(m.deleteCount ?? 0)} />
              <MetricCard
                label="Transfers gaining"
                value={formatInteger(m.transferGainingCount ?? 0)}
              />
              <MetricCard
                label="Transfers losing"
                value={formatInteger(m.transferLosingCount ?? 0)}
              />
            </div>
          </section>
        </>
      ) : null}

      <section data-testid="registry-market-history">
        <h2 className="text-base font-bold text-slate-950">Historical coverage</h2>
        {model.historyNote ? (
          <p
            data-testid="registry-market-history-note"
            className="mt-2 text-sm text-slate-600"
          >
            {model.historyNote}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            {model.historyRows.length} reporting period
            {model.historyRows.length === 1 ? "" : "s"} in this publication shard.
          </p>
        )}
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-[640px] w-full border-collapse text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Period
                </th>
                <th scope="col" className="px-3 py-2">
                  Reported domains
                </th>
                <th scope="col" className="px-3 py-2">
                  MoM
                </th>
                <th scope="col" className="px-3 py-2">
                  YoY
                </th>
                <th scope="col" className="px-3 py-2">
                  Net adds
                </th>
                <th scope="col" className="px-3 py-2">
                  Deletes
                </th>
                <th scope="col" className="px-3 py-2">
                  Registrar breadth
                </th>
              </tr>
            </thead>
            <tbody>
              {model.historyRows.map((row) => (
                <tr key={row.reportingPeriod} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    {row.periodLabel}
                    {row.availability === "MISSING" ? (
                      <span className="ml-2 text-xs text-slate-500">
                        Report unavailable
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.totalDomains === null ? "—" : formatInteger(row.totalDomains)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.monthOverMonthGrowth?.available
                      ? formatGrowthRatio(row.monthOverMonthGrowth.value!)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.yearOverYearGrowth?.available
                      ? formatGrowthRatio(row.yearOverYearGrowth.value!)
                      : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.netAddsCount === null ? "—" : formatInteger(row.netAddsCount)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.deleteCount === null ? "—" : formatInteger(row.deleteCount)}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.registrarBreadth === null
                      ? "—"
                      : formatInteger(row.registrarBreadth)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {m ? (
        <section data-testid="registry-market-registrars">
          <h2 className="text-base font-bold text-slate-950">Registrar structure</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Registrar breadth"
              value={formatInteger(m.registrarBreadth ?? 0)}
            />
            <MetricCard
              label="Top registrar share"
              value={formatOptionalMetric(m.topRegistrarShare, { percent: true })}
            />
            <MetricCard
              label="Accredited registrar domains"
              value={formatInteger(m.accreditedRegistrarDomains ?? 0)}
            />
            <MetricCard
              label="Special/system domains"
              value={formatInteger(m.specialOrSystemDomains ?? 0)}
            />
          </div>
          {model.specialSystemNote ? (
            <p
              data-testid="registry-market-special-note"
              className="mt-3 text-sm text-slate-600"
            >
              {model.specialSystemNote}
            </p>
          ) : null}
          <h3 className="mt-4 text-sm font-bold text-slate-900">
            Top accredited registrars
          </h3>
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-[520px] w-full border-collapse text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-2">
                    Registrar
                  </th>
                  <th scope="col" className="px-3 py-2">
                    IANA ID
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Reported domains
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Share of TLD total
                  </th>
                </tr>
              </thead>
              <tbody>
                {model.topAccreditedRegistrars.map((row) => (
                  <tr key={row.ianaRegistrarId} className="border-t border-slate-100">
                    <td className="px-3 py-2">{row.registrarName}</td>
                    <td className="px-3 py-2 tabular-nums">{row.ianaRegistrarId}</td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatInteger(row.totalDomains)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {formatOptionalMetric(row.shareOfTldTotal, { percent: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {model.provenance ? (
        <details
          data-testid="registry-market-provenance"
          className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm"
        >
          <summary className="cursor-pointer font-semibold text-slate-900">
            Data provenance
          </summary>
          <dl className="mt-3 grid gap-2 text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-slate-500">Source system</dt>
              <dd>ICANN MRR Transactions</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Reporting period</dt>
              <dd>{model.provenance.reportingPeriod}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase text-slate-500">Source URL</dt>
              <dd className="break-all">{model.provenance.sourceUrl}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Raw SHA-256</dt>
              <dd className="font-mono text-xs">{model.provenance.rawShaShort}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Normalized SHA-256</dt>
              <dd className="font-mono text-xs">
                {model.provenance.normalizedShaShort}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Publication SHA</dt>
              <dd className="font-mono text-xs">
                {model.provenance.publicationShaShort}
              </dd>
            </div>
          </dl>
        </details>
      ) : null}
    </div>
  );
}

export function MarketBaselineContent({
  overview,
  detail,
  presentation = "pre-reveal",
}: {
  overview?: RegistryMarketOverviewModel | null;
  detail?: RegistryMarketDetailModel | null;
  presentation?: ProductPresentation;
}) {
  return (
    <main
      data-testid="registry-market-content"
      className="mx-auto max-w-[1480px] px-4 py-8 sm:px-6"
    >
      {detail ? (
        <MarketBaselineDetailContent model={detail} presentation={presentation} />
      ) : overview ? (
        <MarketBaselineOverviewContent
          model={overview}
          presentation={presentation}
        />
      ) : (
        <FailClosedPanel
          title="Registry Market unavailable"
          message="Registry Market unavailable. The accepted market publication is not available in this runtime."
          presentation={presentation}
        />
      )}
    </main>
  );
}
