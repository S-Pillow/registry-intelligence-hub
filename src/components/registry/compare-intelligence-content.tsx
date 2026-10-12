"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import {
  formatCompareMetricValue,
  numericValuesDiffer,
  type CompareIntelViewModel,
  type CompareMetricValue,
} from "@/lib/compare-intelligence";
import {
  clearCompareTray,
  compareTrayOpenHref,
  removeFromCompareTray,
} from "@/lib/compare-tray-storage";
import {
  getCompareTrayServerSnapshot,
  getCompareTraySnapshot,
  notifyCompareTrayListeners,
  subscribeCompareTray,
} from "@/lib/compare-tray-subscribe";

function HubChrome() {
  const items = [
    { label: "Command Center", href: "/" },
    { label: "Explore", href: "/explore" },
    { label: "Competitive Landscape", href: "/competitive-landscape" },
    { label: "Contention", href: "/contention" },
    { label: "Changes", href: "/changes" },
  ] as const;
  return (
    <>
      <header className="border-b border-white/10 bg-[#101923] text-white">
        <div className="mx-auto flex h-14 max-w-[1480px] items-center px-4 sm:px-6">
          <Link href="/" className="font-mono text-sm font-semibold tracking-[0.2em]">
            FORGE<span className="text-[#72dfb4]">/</span>FORWARD
          </Link>
        </div>
      </header>
      <div className="border-b bg-white" data-testid="hub-primary-nav">
        <div className="mx-auto flex max-w-[1480px] px-2 sm:px-6">
          <nav aria-label="Hub business navigation" className="flex flex-wrap gap-1">
            {items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="px-3 py-3 text-sm font-semibold text-slate-600 hover:text-slate-950"
              >
                {item.label}
              </Link>
            ))}
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

function MetricCell({
  value,
  emphasize,
}: {
  value: CompareMetricValue;
  emphasize: boolean;
}) {
  const display = formatCompareMetricValue(value);
  const unavailable = value.kind === "unavailable";
  return (
    <td
      className={`px-3 py-2 align-top text-sm ${
        unavailable
          ? "text-slate-500 italic"
          : emphasize
            ? "font-semibold tabular-nums text-slate-950"
            : "tabular-nums text-slate-800"
      }`}
    >
      {display}
    </td>
  );
}

function CompareTrayPanel() {
  const tray = useSyncExternalStore(
    subscribeCompareTray,
    getCompareTraySnapshot,
    getCompareTrayServerSnapshot,
  );

  if (!tray || tray.items.length === 0) return null;

  return (
    <aside
      className="mb-6 rounded-lg border border-[#006a56]/30 bg-emerald-50/60 px-4 py-3"
      data-testid="compare-tray-v2"
      aria-label="Compare tray"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#006a56]">
          Compare tray · {tray.type === "applicant" ? "Applicants" : "Organizations"}
        </p>
        <div className="flex flex-wrap gap-2">
          {tray.items.length >= 2 ? (
            <Link
              href={compareTrayOpenHref(tray)}
              className="rounded-lg bg-[#006a56] px-3 py-1.5 text-xs font-bold text-white"
              data-testid="compare-tray-open"
            >
              Open Compare
            </Link>
          ) : (
            <span className="text-xs text-slate-600">Add one more to compare</span>
          )}
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
            data-testid="compare-tray-clear"
            onClick={() => {
              clearCompareTray();
              notifyCompareTrayListeners();
            }}
          >
            Clear
          </button>
        </div>
      </div>
      <ul className="mt-2 flex flex-wrap gap-2">
        {tray.items.map((item) => (
          <li
            key={item.key}
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs"
            data-testid={`compare-tray-chip-${item.key}`}
          >
            <span className="font-semibold text-slate-900">{item.label}</span>
            <span className="text-slate-500">
              {tray.type === "applicant" ? "Applicant" : "Organization"}
            </span>
            <button
              type="button"
              className="font-bold text-slate-500 hover:text-slate-900"
              aria-label={`Remove ${item.label} from Compare`}
              data-testid={`compare-tray-remove-${item.key}`}
              onClick={() => {
                removeFromCompareTray(item.key);
                notifyCompareTrayListeners();
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function CompareIntelligenceContent({ model }: { model: CompareIntelViewModel }) {
  const foundColumns = model.columns.filter((c) => c.lookup.found);
  const grainLabel = model.grain === "applicant" ? "Applicant comparison" : "Organization comparison";

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-slate-900" data-testid="compare-intelligence-page">
      <HubChrome />
      <main className="mx-auto max-w-[1480px] px-4 py-8">
        <CompareTrayPanel />
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]" data-testid="compare-grain-label">
          {grainLabel}
        </p>
        <header className="mt-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl" data-testid="compare-title">
            {model.title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-700" data-testid="compare-subtitle">
            {model.subtitle}
          </p>
        </header>

        {model.warnings.length > 0 ? (
          <ul className="mt-4 space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" data-testid="compare-warnings">
            {model.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}

        {model.emptyReason ? (
          <section className="mt-6 rounded-lg border border-slate-300 bg-white px-4 py-6 text-sm" data-testid="compare-empty">
            <p className="font-semibold text-slate-900">{model.emptyReason}</p>
            <p className="mt-3 flex flex-wrap gap-3">
              <Link href="/competitive-landscape" className="font-semibold text-[#006a56] underline">
                Competitive Landscape
              </Link>
              <Link href="/explore" className="font-semibold text-[#006a56] underline">
                Explore
              </Link>
              <Link href="/contention" className="font-semibold text-[#006a56] underline">
                Contention
              </Link>
            </p>
          </section>
        ) : null}

        {foundColumns.length > 0 ? (
          <>
            <section
              className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              data-testid="compare-summary-row"
              aria-label="Compared entities"
            >
              {foundColumns.map((col, colIdx) => (
                <div
                  key={col.key}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-3"
                  data-testid={`compare-column-${colIdx}`}
                  data-compare-key={col.key}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {col.grain === "applicant" ? "Applicant" : "Organization"}
                  </p>
                  <p className="mt-1 text-base font-bold text-slate-950">{col.label}</p>
                  <Link
                    href={col.profileHref}
                    className="mt-2 inline-block text-sm font-semibold text-[#006a56] underline-offset-2 hover:underline"
                    data-testid={`compare-profile-link-${colIdx}`}
                  >
                    View full profile
                  </Link>
                </div>
              ))}
            </section>

            <div className="mt-8 space-y-8">
              {model.sections.map((section) => (
                <section
                  key={section.id}
                  className="rounded-lg border border-slate-200 bg-white"
                  data-testid={`compare-section-${section.id}`}
                  aria-labelledby={`compare-section-heading-${section.id}`}
                >
                  <h2
                    id={`compare-section-heading-${section.id}`}
                    className="border-b border-slate-100 px-4 py-3 text-sm font-bold uppercase tracking-wide text-slate-800"
                  >
                    {section.title}
                  </h2>
                  {/* Desktop table */}
                  <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2 font-semibold">Metric</th>
                          {foundColumns.map((col) => (
                            <th key={col.key} className="px-3 py-2 font-semibold">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row) => {
                          const differ =
                            Boolean(row.emphasizeDifference) && numericValuesDiffer(row.values);
                          return (
                            <tr key={row.id} className="border-b border-slate-50" data-testid={`compare-row-${row.id}`}>
                              <th className="px-3 py-2 align-top text-sm font-medium text-slate-700">
                                {row.label}
                                {row.note ? (
                                  <p className="mt-1 text-xs font-normal text-slate-500">{row.note}</p>
                                ) : null}
                              </th>
                              {row.values.map((value, idx) => (
                                <MetricCell
                                  key={`${row.id}-${foundColumns[idx]?.key ?? idx}`}
                                  value={value}
                                  emphasize={differ && value.kind === "number"}
                                />
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {/* Mobile stacked cards */}
                  <div className="space-y-4 p-3 md:hidden" data-testid={`compare-section-mobile-${section.id}`}>
                    {foundColumns.map((col, colIdx) => (
                      <div key={col.key} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                        <p className="text-xs font-bold uppercase text-slate-500">{col.label}</p>
                        <dl className="mt-2 space-y-2">
                          {section.rows.map((row) => (
                            <div key={row.id}>
                              <dt className="text-xs text-slate-500">{row.label}</dt>
                              <dd
                                className={`text-sm ${
                                  row.values[colIdx]?.kind === "unavailable"
                                    ? "italic text-slate-500"
                                    : "font-semibold tabular-nums text-slate-900"
                                }`}
                              >
                                {formatCompareMetricValue(row.values[colIdx]!)}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <p className="mt-6 flex flex-wrap gap-4 text-sm" data-testid="compare-drilldowns">
              {model.contentionHref ? (
                <Link
                  href={model.contentionHref}
                  className="font-semibold text-[#006a56] underline-offset-2 hover:underline"
                  data-testid="compare-contention-link"
                >
                  Open Contention
                </Link>
              ) : null}
              <Link href="/cross-round" className="font-semibold text-[#006a56] underline-offset-2 hover:underline">
                2012 vs 2026 structural comparison
              </Link>
              <span className="text-slate-500">Shareable URL uses canonical keys in this page address.</span>
            </p>
          </>
        ) : null}
      </main>
    </div>
  );
}
