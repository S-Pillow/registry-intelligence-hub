"use client";

import { useId, useState } from "react";
import Link from "next/link";
import {
  CONTENTION_SET_PLAIN_LANGUAGE,
  buildContentionApplicationCountDistribution,
} from "@/lib/applicant-intelligence";
import type { ContentionSetRow } from "@/lib/contention-intelligence";

/**
 * Business-readable contention-set crowding explanation with keyboard-accessible
 * distribution interaction (APPLICANT-INTEL-1).
 */
export function ContentionDistributionPanel({
  sets,
  largestSetSize,
  onOpenSet,
}: {
  sets: ContentionSetRow[];
  largestSetSize: number;
  onOpenSet: (setId: string) => void;
}) {
  const headingId = useId();
  const distribution = buildContentionApplicationCountDistribution(sets);
  const [expandedSize, setExpandedSize] = useState<number | null>(null);
  const expanded = distribution.find((d) => d.applicationCount === expandedSize) ?? null;

  return (
    <section
      className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-4"
      aria-labelledby={headingId}
      data-testid="contention-distribution-panel"
    >
      <h2 id={headingId} className="text-base font-bold text-slate-950">
        How crowded are the contention sets?
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-700" data-testid="contention-set-explanation">
        {CONTENTION_SET_PLAIN_LANGUAGE}
      </p>
      <p className="mt-2 text-sm text-slate-700">
        ICANN groups competing Applications into contention sets. The distribution below shows how many
        Applications are competing within each set.
      </p>
      <p className="mt-3 text-sm font-semibold text-slate-900" data-testid="largest-contention-set-wording">
        Largest contention set:{" "}
        <span className="tabular-nums">{largestSetSize}</span> competing Applications
      </p>

      <ul
        className="mt-4 flex flex-wrap gap-2"
        aria-label="Contention set Application-count distribution"
        data-testid="contention-application-distribution"
      >
        {distribution.slice(0, 12).map((row) => {
          const selected = expandedSize === row.applicationCount;
          const label = `${row.applicationCount} Applications · ${row.setCount} set${row.setCount === 1 ? "" : "s"}`;
          return (
            <li key={row.applicationCount}>
              <button
                type="button"
                className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006a56] ${
                  selected
                    ? "border-[#006a56] bg-emerald-50 text-[#006a56]"
                    : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300"
                }`}
                aria-expanded={selected}
                aria-controls={`contention-dist-sets-${row.applicationCount}`}
                data-testid={`contention-dist-size-${row.applicationCount}`}
                onClick={() =>
                  setExpandedSize((prev) => (prev === row.applicationCount ? null : row.applicationCount))
                }
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>

      {expanded ? (
        <div
          id={`contention-dist-sets-${expanded.applicationCount}`}
          className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
          data-testid="contention-dist-reveal"
        >
          <p className="text-sm font-semibold text-slate-900">
            {expanded.setCount} contention set{expanded.setCount === 1 ? "" : "s"} with{" "}
            {expanded.applicationCount} Applications each
          </p>
          <ul className="mt-3 space-y-2">
            {expanded.sets.map((set) => (
              <li
                key={set.setId}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                data-testid={`contention-dist-set-${set.setId}`}
              >
                <p className="font-semibold text-slate-950">
                  Set #{set.setId}
                  {set.appliedForStrings[0] ? (
                    <span className="ml-2 font-medium text-slate-700">.{set.appliedForStrings[0]}</span>
                  ) : null}
                </p>
                <p className="mt-1 text-slate-700">
                  {set.applicationCount} Applications · {set.distinctApplicantCount} distinct Applicants
                  {set.includesGodaddy ? " · includes GoDaddy" : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs">
                  <button
                    type="button"
                    className="font-semibold text-[#006a56] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006a56]"
                    onClick={() => onOpenSet(set.setId)}
                  >
                    Open set detail
                  </button>
                  <Link href={set.contentionSetHref} className="font-semibold text-[#006a56] underline">
                    Deep link
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
