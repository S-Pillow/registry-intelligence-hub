"use client";

import Link from "next/link";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";
import type { ClaimActualityState } from "@/reveal-day-2026/claim-actuality";
import {
  buildCommandCenterIntelligenceV2,
  type CommandCenterIntelligenceV2,
  type CrossRoundDeltaVm,
} from "@/lib/command-center-intelligence-v2";
import { CommandCenterRecentChangesCard } from "@/components/registry/changes-content";
import type { ChangeIntelFeedState } from "@/change-intel/types";
import { crossRoundStructuralHref } from "@/lib/cross-round-structural-intelligence";
import { historicalCohortsHref } from "@/lib/historical-cohort-intelligence";

function CrossRoundCard({
  title,
  comparison,
  testIdPrefix,
}: {
  title: string;
  comparison: CrossRoundDeltaVm;
  testIdPrefix: string;
}) {
  const direction =
    comparison.difference === 0 ? "unchanged" : comparison.difference < 0 ? "down" : "up";
  return (
    <article
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      data-testid={`${testIdPrefix}-card`}
    >
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center sm:text-left">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">2012</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums" data-testid={`${testIdPrefix}-2012`}>
            {comparison.baseline2012}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">2026</dt>
          <dd className="mt-1 text-2xl font-bold tabular-nums" data-testid={`${testIdPrefix}-2026`}>
            {comparison.active2026}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">Change</dt>
          <dd
            className="mt-1 text-2xl font-bold tabular-nums text-[#006a56]"
            data-testid={`${testIdPrefix}-delta`}
            data-direction={direction}
          >
            {comparison.difference > 0 ? `+${comparison.difference}` : comparison.difference}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-5 text-slate-600" data-testid={`${testIdPrefix}-limitation`}>
        {comparison.limitationLabel}
      </p>
    </article>
  );
}

function PostureStat({
  label,
  value,
  testId,
  hint,
}: {
  label: string;
  value: number | string;
  testId: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums" data-testid={testId}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}

function IntelligenceSections({
  intelligence,
  changeFeed,
}: {
  intelligence: CommandCenterIntelligenceV2;
  changeFeed: ChangeIntelFeedState;
}) {
  const { roundPosture, crossRound, competitiveStructure, roundComposition, coverage, drilldown } =
    intelligence;

  return (
    <div className="space-y-10" data-testid="command-center-intelligence-v2">
      <CommandCenterRecentChangesCard feed={changeFeed} />
      {/* Section 1 — Round posture */}
      <section aria-labelledby="cc-round-posture-heading" data-testid="cc-section-round-posture">
        <header className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">
            Round posture
          </p>
          <h1 id="cc-round-posture-heading" className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
            2026 round at a glance
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Official ICANN aggregates anchor round posture. RIH coverage is disclosed separately and is
            not the official round total.
          </p>
        </header>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <PostureStat
            label="Official applications"
            value={roundPosture.officialApplications}
            testId="cc-v2-official-apps"
            hint="Official aggregate · not observed rows"
          />
          <PostureStat
            label="Official applicants"
            value={roundPosture.officialApplicants}
            testId="cc-v2-official-applicants"
            hint="Applicant ≠ Organization"
          />
          <PostureStat
            label="Official initial contention sets"
            value={roundPosture.officialContentionSets ?? "—"}
            testId="cc-v2-contention-sets"
            hint="Official initial contention"
          />
          <PostureStat
            label="Official initial memberships"
            value={roundPosture.officialContentionMemberships ?? "—"}
            testId="cc-v2-contention-memberships"
            hint="Joined official memberships"
          />
        </div>
      </section>

      {/* Section 2 — What changed since 2012 */}
      <section aria-labelledby="cc-cross-round-heading" data-testid="cc-section-cross-round">
        <header className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">
            Structural change
          </p>
          <h2 id="cc-cross-round-heading" className="mt-2 text-2xl font-bold tracking-tight">
            What changed since 2012
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Only currently defensible Reveal Day comparisons. Community, Geographic, unique strings,
            contention sets, and organization identity remain blocked.
          </p>
        </header>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {crossRound.applications ? (
            <CrossRoundCard
              title="Applications"
              comparison={crossRound.applications}
              testIdPrefix="cc-v2-cross-apps"
            />
          ) : null}
          {crossRound.idn ? (
            <CrossRoundCard
              title="IDN applications"
              comparison={crossRound.idn}
              testIdPrefix="cc-v2-cross-idn"
            />
          ) : null}
        </div>
        {crossRound.applications || crossRound.idn ? (
          <p className="mt-4 flex flex-wrap items-center gap-3">
            <Link
              href={crossRoundStructuralHref()}
              className="inline-flex items-center rounded-lg bg-[#007d65] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#006a56] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007d65]"
              data-testid="cc-v2-explore-cross-round"
            >
              Explore 2012 vs 2026
            </Link>
            <Link
              href={historicalCohortsHref()}
              className="inline-flex items-center text-sm font-semibold text-[#006a56] underline-offset-2 hover:underline"
              data-testid="cc-v2-explore-historical-cohorts"
            >
              Explore 2012 Applicant structure
            </Link>
          </p>
        ) : null}
        <ul className="sr-only" data-testid="cc-v2-omitted-blocked-cross-round">
          {crossRound.omittedBlocked.map((id) => (
            <li key={id}>{id}</li>
          ))}
        </ul>
      </section>

      {/* Section 3 — Competitive structure */}
      <section aria-labelledby="cc-contention-heading" data-testid="cc-section-contention">
        <header className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">
            Competitive structure
          </p>
          <h2 id="cc-contention-heading" className="mt-2 text-2xl font-bold tracking-tight">
            Official initial contention
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Based on ICANN&apos;s official initial contention publication.
          </p>
        </header>

        {competitiveStructure.status === "available" ? (
          <div className="mt-5 space-y-4" data-testid="cc-v2-contention-available">
            <div className="rounded-xl border border-[#007d65]/30 bg-white p-5 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Official initial contention sets
                  </p>
                  <p
                    className="mt-2 text-4xl font-bold tabular-nums"
                    data-testid="cc-v2-contention-sets-hero"
                  >
                    {competitiveStructure.setCount}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Official initial memberships
                  </p>
                  <p
                    className="mt-2 text-4xl font-bold tabular-nums"
                    data-testid="cc-v2-contention-memberships-hero"
                  >
                    {competitiveStructure.membershipCount}
                  </p>
                </div>
              </div>
              <p
                className="mt-4 text-xs leading-5 text-slate-600"
                data-testid="cc-v2-contention-may-change"
              >
                Reveal Day contention state can change as the program progresses. This is the official
                initial contention snapshot, not a live lifecycle forecast.
              </p>
              <p className="mt-2 text-xs text-slate-600" data-testid="cc-v2-contention-not-exact-string">
                Based on ICANN&apos;s official initial contention publication. Source organization name
                on that publication is not a confirmed Organization mapping.
              </p>
            </div>

            {competitiveStructure.largestSetSize != null ? (
              <div
                className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-4"
                data-testid="cc-v2-contention-set-sizes"
              >
                <p className="text-sm font-semibold text-slate-900">
                  How crowded are the contention sets?
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  ICANN groups competing Applications into contention sets. A larger Application count
                  means more Applications in that competition group — not necessarily that many distinct
                  Applicants.
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  Largest contention set:{" "}
                  <span data-testid="cc-v2-contention-largest-set">
                    {competitiveStructure.largestSetSize}
                  </span>{" "}
                  competing Applications
                </p>
                {competitiveStructure.setSizeDistribution.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2" aria-label="Contention Application-count distribution">
                    {competitiveStructure.setSizeDistribution.slice(0, 8).map((row) => (
                      <li
                        key={row.size}
                        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
                      >
                        {row.size} Applications · {row.setCount} set{row.setCount === 1 ? "" : "s"}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-3 text-xs">
                  <Link
                    href="/contention"
                    className="font-semibold text-[#006a56] underline"
                    data-testid="cc-v2-inspect-contention-sets"
                  >
                    Inspect actual sets on Contention
                  </Link>
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <div
            className="mt-5 rounded-xl border border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-700"
            data-testid="cc-v2-contention-unavailable"
          >
            <p className="font-semibold">Official initial contention unavailable</p>
            <p className="mt-1 text-xs leading-5">{competitiveStructure.reason}</p>
            <p className="mt-2 text-xs text-slate-600">
              Application round posture remains active. Contention is unavailable independently and
              is not inferred from applied-string grouping.
            </p>
          </div>
        )}
      </section>

      {/* Section 4 — Round composition */}
      {roundComposition ? (
        <section aria-labelledby="cc-composition-heading" data-testid="cc-section-composition">
          <header className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">
              Round composition
            </p>
            <h2 id="cc-composition-heading" className="mt-2 text-2xl font-bold tracking-tight">
              Published application characteristics
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              Designation and relationship orientation — not industries, sectors, or market
              categories.
            </p>
          </header>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["idn", roundComposition.idn, "cc-v2-composition-idn"],
                ["brand", roundComposition.brand, "cc-v2-composition-brand"],
                ["community", roundComposition.community, "cc-v2-composition-community"],
                ["geographic", roundComposition.geographic, "cc-v2-composition-geographic"],
                ["variants", roundComposition.variants, "cc-v2-composition-variants"],
                ["replacements", roundComposition.replacements, "cc-v2-composition-replacements"],
              ] as const
            ).map(([key, item, testId]) => (
              <div
                key={key}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3"
                data-testid={testId}
              >
                <dt className="text-xs font-medium text-slate-600">{item.label}</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums">{item.value}</dd>
                {"selfIdentified" in item && item.selfIdentified ? (
                  <p className="mt-1 text-[11px] text-slate-500" data-testid="cc-v2-geo-self-identified">
                    Self-identified Geographic designation
                  </p>
                ) : null}
                {"relationshipGrain" in item && item.relationshipGrain ? (
                  <p
                    className="mt-1 text-[11px] text-slate-500"
                    data-testid="cc-v2-replacement-relationship-grain"
                  >
                    Relationship grain — not extra applications
                  </p>
                ) : null}
                {"orientationOnly" in item && item.orientationOnly ? (
                  <p className="mt-1 text-[11px] text-slate-500">2026 orientation only</p>
                ) : null}
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {/* Section 5 — Evidence / coverage + drilldown */}
      <section aria-labelledby="cc-coverage-heading" data-testid="cc-section-coverage">
        <header className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">
            Coverage
          </p>
          <h2 id="cc-coverage-heading" className="mt-2 text-2xl font-bold tracking-tight">
            What RIH currently represents
          </h2>
        </header>
        <div
          className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm"
          data-testid="cc-v2-coverage-panel"
        >
          <ul className="space-y-1.5">
            <li>
              Official applications:{" "}
              <strong data-testid="cc-v2-coverage-official">{coverage.officialApplications}</strong>
            </li>
            <li>
              Application rows represented in RIH:{" "}
              <strong data-testid="cc-v2-coverage-observed">{coverage.observedApplicationRecords}</strong>
              <span className="text-slate-600"> — coverage context only, not the round total</span>
            </li>
            <li>
              Coverage:{" "}
              <strong data-testid="cc-v2-coverage-completeness">{coverage.completeness}</strong>
            </li>
            <li data-testid="cc-v2-coverage-excluded">
              Known excluded: {coverage.knownExcludedCount === 1
                ? "one administrative-check record"
                : `${coverage.knownExcludedCount} records`}{" "}
              (not a normal Application row)
            </li>
          </ul>
          <p className="mt-3">
            <Link
              href={coverage.dataHealthHref}
              className="font-semibold text-[#006a56] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007d65]"
              data-testid="cc-v2-data-health-link"
            >
              Data &amp; methodology
            </Link>
          </p>
        </div>

        <nav
          className="mt-5 flex flex-wrap gap-3"
          aria-label="Evidence drilldown"
          data-testid="cc-v2-drilldown"
        >
          <Link
            href="/competitive-landscape"
            className="inline-flex items-center rounded-lg bg-[#007d65] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#006a56] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007d65]"
            data-testid="cc-v2-competitive-landscape-cta"
          >
            Open Competitive Landscape
          </Link>
          <Link
            href={drilldown.exploreApplicationsHref}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007d65]"
          >
            Explore applications
          </Link>
          <Link
            href={drilldown.searchRecordsHref}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007d65]"
          >
            Search records
          </Link>
          <Link
            href={drilldown.exploreContentionHref}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007d65]"
            data-testid="cc-v2-contention-cta"
          >
            Explore contention
          </Link>
        </nav>
      </section>
    </div>
  );
}

/**
 * Intelligence-first Command Center for active 2.x — no legacy org/category/returning panels,
 * no APS-style browsing wall, no blocked metrics as zeros.
 */
export function CommandCenterOrientationV2({
  document,
  claimActuality,
  changeFeed = { initialized: false },
}: {
  document: RegistryApplicationsDocumentV2;
  claimActuality: ClaimActualityState;
  changeFeed?: ChangeIntelFeedState;
}) {
  const intelligence = buildCommandCenterIntelligenceV2({ document, claimActuality });
  return (
    <section data-testid="command-center-orientation-v2" className="space-y-4">
      <IntelligenceSections intelligence={intelligence} changeFeed={changeFeed} />
    </section>
  );
}
