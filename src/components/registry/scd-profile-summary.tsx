"use client";

import type { ReactNode, RefObject } from "react";
import {
  formatProfileSourceLine,
  PROFILE_PORTFOLIO_FILTERS,
  SCD_UNCONTESTED_NOT_AWARDED_PLAIN_LANGUAGE,
  type ApplicationPortfolioFilter,
  type ApplicationStringStatusObservation,
  type ApplicationStringStatusSummary,
} from "@/lib/application-string-status";

export type ScdSummaryCardId =
  | "all"
  | "no_scd_contention"
  | "still_in_contention"
  | "selected_replacements";

type SummaryCardSpec = {
  id: ScdSummaryCardId;
  filter: ApplicationPortfolioFilter;
  label: string;
  testId: string;
  value: string | number;
  available: boolean;
  unavailableLabel?: string;
};

export function ScdProfileSummaryCards({
  summary,
  observation,
  activeFilter,
  onSelect,
}: {
  summary: ApplicationStringStatusSummary;
  observation: ApplicationStringStatusObservation;
  activeFilter: ApplicationPortfolioFilter;
  onSelect: (filter: ApplicationPortfolioFilter) => void;
}) {
  const scdReady = observation.scdContentionEvidence === "ready";
  const cards: SummaryCardSpec[] = [
    {
      id: "all",
      filter: "all",
      label: "Total applications",
      testId: "scd-summary-total",
      value: summary.applicationCount,
      available: true,
    },
    {
      id: "no_scd_contention",
      filter: "no_scd_contention",
      label: "No competing applications",
      testId: "scd-summary-uncontested",
      value: summary.activeUncontestedInScdCapture,
      available: scdReady,
      unavailableLabel: "Unavailable",
    },
    {
      id: "still_in_contention",
      filter: "still_in_contention",
      label: "Still contested",
      testId: "scd-summary-contested",
      value: summary.activeContestedInScdCapture,
      available: scdReady,
      unavailableLabel: "Unavailable",
    },
    {
      id: "selected_replacements",
      filter: "selected_replacements",
      label: "Replacement strings selected",
      testId: "scd-summary-replacements",
      value: summary.selectedReplacements,
      available: true,
    },
  ];

  return (
    <section
      className="mt-6"
      aria-labelledby="scd-summary-heading"
      data-testid="scd-profile-summary"
    >
      <h2 id="scd-summary-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-[#006a56]">
        Application status summary
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => {
          const active = activeFilter === card.filter;
          const display = card.available ? card.value : (card.unavailableLabel ?? "Unavailable");
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onSelect(card.filter)}
              disabled={!card.available && card.id !== "all" && card.id !== "selected_replacements"}
              className={`rounded-lg border px-3 py-3 text-left transition ${
                active
                  ? "border-[#006a56] bg-[#006a56] text-white shadow-sm"
                  : card.available
                    ? "border-slate-300 bg-white text-slate-950 hover:border-[#006a56]"
                    : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"
              }`}
              data-testid={card.testId}
              aria-pressed={active}
              aria-disabled={!card.available && card.id !== "all" && card.id !== "selected_replacements"}
            >
              <p
                className={`text-[11px] font-semibold uppercase tracking-wide ${
                  active ? "text-white/80" : "text-slate-500"
                }`}
              >
                {card.label}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{display}</p>
              {!card.available ? (
                <p className={`mt-1 text-[11px] ${active ? "text-white/80" : "text-slate-500"}`}>
                  Published contention data not available
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ProfileSourceSummary({
  observation,
  extraDetails,
}: {
  observation: ApplicationStringStatusObservation;
  extraDetails?: ReactNode;
}) {
  return (
    <div className="mt-4" data-testid="profile-source-summary">
      <p className="text-sm font-semibold text-slate-900" data-testid="profile-source-line">
        {formatProfileSourceLine(observation)}
      </p>
      <p className="mt-1 text-xs text-slate-600">{SCD_UNCONTESTED_NOT_AWARDED_PLAIN_LANGUAGE}</p>
      <details className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" data-testid="source-details">
        <summary className="cursor-pointer font-semibold text-slate-900">Source details</summary>
        <div className="mt-2 space-y-1 text-xs text-slate-600">
          <p>{observation.publicationBasisLabel}</p>
          <p>
            Application snapshot {observation.applicationSnapshotId} · published {observation.publishedAt} ·
            retrieved {observation.retrievedAt}
          </p>
          <p>
            {observation.contentionSnapshotId
              ? `Contention snapshot ${observation.contentionSnapshotId} · overlay ${observation.contentionOverlayStatus}`
              : "Contention snapshot not bound"}
          </p>
          <p>
            SCD contention evidence:{" "}
            {observation.scdContentionEvidence === "ready" ? "ready" : "unavailable"}
          </p>
          {extraDetails}
          <p>
            <a href="/data-health" className="font-semibold text-[#006a56] underline">
              Data &amp; methodology
            </a>
          </p>
        </div>
      </details>
    </div>
  );
}

export function ProfilePortfolioFilterBar({
  activeFilter,
  onChange,
  showClear,
}: {
  activeFilter: ApplicationPortfolioFilter;
  onChange: (filter: ApplicationPortfolioFilter) => void;
  showClear?: boolean;
}) {
  return (
    <div
      className="mt-3 flex flex-wrap items-center gap-2"
      role="group"
      aria-label="Portfolio filters"
      data-testid="portfolio-filters"
    >
      {PROFILE_PORTFOLIO_FILTERS.map((f) => {
        const active = activeFilter === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onChange(f.id)}
            className={`rounded border px-2.5 py-1 text-xs font-semibold ${
              active
                ? "border-[#006a56] bg-[#006a56] text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
            }`}
            data-testid={`portfolio-filter-${f.id}`}
            aria-pressed={active}
          >
            {f.label}
          </button>
        );
      })}
      {showClear && activeFilter !== "all" ? (
        <button
          type="button"
          onClick={() => onChange("all")}
          className="text-xs font-semibold text-[#006a56] underline"
          data-testid="portfolio-filter-clear"
        >
          Show all applications
        </button>
      ) : null}
    </div>
  );
}

export function usePortfolioFilterNavigation(
  portfolioRef: RefObject<HTMLElement | null>,
  setFilter: (filter: ApplicationPortfolioFilter) => void,
) {
  return (filter: ApplicationPortfolioFilter) => {
    setFilter(filter);
    // Defer scroll until filter state commits and rows update.
    requestAnimationFrame(() => {
      portfolioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
}
