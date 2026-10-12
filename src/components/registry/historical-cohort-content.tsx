"use client";

import Link from "next/link";
import {
  formatCohortSharePercent,
  type HistoricalApplicantPortfolioCohortIntelligence,
  type HistoricalCohortPortfolioBand,
} from "@/lib/historical-cohort-intelligence";

function shareBarWidth(share: number): number {
  return Math.max(0, Math.min(100, Math.round(share * 100)));
}

function BandRow({ band, maxShare }: { band: HistoricalCohortPortfolioBand; maxShare: number }) {
  const width = maxShare > 0 ? Math.round((band.applicationShare / maxShare) * 100) : 0;
  return (
    <div
      className="grid grid-cols-1 gap-2 border-b border-slate-100 py-3 last:border-0 sm:grid-cols-[10rem_minmax(0,1fr)_auto]"
      data-testid={`cohort-band-${band.id}`}
    >
      <div>
        <p className="text-sm font-semibold text-slate-950">{band.label}</p>
        <p className="text-xs text-slate-600">
          {band.applicantCount.toLocaleString()} Applicant legal names (
          {formatCohortSharePercent(band.applicantShare)})
        </p>
      </div>
      <div className="flex items-center" aria-hidden="true">
        <div className="h-3 w-full rounded bg-slate-100">
          <div className="h-3 rounded bg-[#007d65]" style={{ width: `${width}%` }} />
        </div>
      </div>
      <div className="text-sm tabular-nums text-slate-900 sm:text-right">
        <strong data-testid={`cohort-band-${band.id}-apps`}>
          {band.applicationCount.toLocaleString()}
        </strong>{" "}
        Applications ({formatCohortSharePercent(band.applicationShare)})
      </div>
    </div>
  );
}

export function HistoricalCohortContent({
  intelligence,
}: {
  intelligence: HistoricalApplicantPortfolioCohortIntelligence;
}) {
  const { oneOffVsMulti: story, concentration, largest, bands, exactStringCompetition: exact } =
    intelligence;
  const maxBandShare = Math.max(...bands.map((band) => band.applicationShare), 0);

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-slate-900" data-testid="historical-cohorts-page">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href={intelligence.hrefs.commandCenter} className="text-sm font-semibold text-[#006a56]">
            ← Command Center
          </Link>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link
              href={intelligence.hrefs.crossRound}
              className="font-medium text-slate-600 hover:text-slate-900"
            >
              2012 vs 2026
            </Link>
            <Link
              href={intelligence.hrefs.exploreHistorical}
              className="font-medium text-slate-600 hover:text-slate-900"
              data-testid="cohort-header-explore"
            >
              Explore 2012 Applications
            </Link>
            <Link
              href="#exact-string-competition"
              className="font-medium text-slate-600 hover:text-slate-900"
              data-testid="cohort-header-exact-string"
            >
              Exact-string competition
            </Link>
            <Link
              href={intelligence.hrefs.dataHealth}
              className="font-medium text-slate-600 hover:text-slate-900"
            >
              Data &amp; methodology
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-8">
        <p
          className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]"
          data-testid="cohort-year-badge"
        >
          2012 only · Applicant legal name
        </p>
        <h1
          className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl"
          data-testid="cohort-title"
        >
          {intelligence.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700" data-testid="cohort-subtitle">
          {intelligence.subtitle}
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600" data-testid="cohort-product-question">
          {intelligence.productQuestion}
        </p>

        {/* 1. Participation shape */}
        <section className="mt-10" aria-labelledby="participation-shape-heading" data-testid="cohort-participation-shape">
          <h2 id="participation-shape-heading" className="text-xl font-bold text-slate-950">
            2012 participation shape
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Accepted Reveal Day denominators for this page.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Applications
              </p>
              <p
                className="mt-1 text-3xl font-bold tabular-nums text-slate-950"
                data-testid="cohort-app-denominator"
              >
                {intelligence.applicationDenominator.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Applicant legal names
              </p>
              <p
                className="mt-1 text-3xl font-bold tabular-nums text-slate-950"
                data-testid="cohort-applicant-denominator"
              >
                {intelligence.applicantLegalNameDenominator.toLocaleString()}
              </p>
            </div>
          </div>
        </section>

        {/* 2. Portfolio-size distribution */}
        <section className="mt-10" aria-labelledby="bands-heading" data-testid="cohort-bands">
          <h2 id="bands-heading" className="text-xl font-bold text-slate-950">
            Applicant portfolio-size distribution
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Each Applicant legal name is placed in exactly one band by Application count. Bar length
            reflects share of Applications, not Applicant success.
          </p>
          <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2">
            {bands.map((band) => (
              <BandRow key={band.id} band={band} maxShare={maxBandShare} />
            ))}
          </div>
        </section>

        {/* 3. One-off vs multi */}
        <section className="mt-10" aria-labelledby="one-off-heading" data-testid="cohort-one-off-vs-multi">
          <h2 id="one-off-heading" className="text-xl font-bold text-slate-950">
            One-off vs multi-Application Applicants
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-800" data-testid="cohort-primary-story">
            Most Applicant legal names submitted one Application (
            <strong>{story.oneOffApplicants.toLocaleString()}</strong>,{" "}
            {formatCohortSharePercent(story.oneOffApplicantShare)}), but multi-Application Applicants (
            <strong>{story.multiApplicants.toLocaleString()}</strong>,{" "}
            {formatCohortSharePercent(story.multiApplicantShare)}) collectively accounted for about half
            of all Applications (
            <strong>{story.multiApplications.toLocaleString()}</strong>,{" "}
            {formatCohortSharePercent(story.multiApplicationShare)}).
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div
              className="rounded-xl border border-slate-200 bg-white p-5"
              data-testid="cohort-one-off-panel"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                One-off Applicants
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
                {story.oneOffApplicants.toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {formatCohortSharePercent(story.oneOffApplicantShare)} of Applicant legal names
              </p>
              <div className="mt-4 h-3 rounded bg-slate-100" aria-hidden="true">
                <div
                  className="h-3 rounded bg-slate-500"
                  style={{ width: `${shareBarWidth(story.oneOffApplicationShare)}%` }}
                />
              </div>
              <p className="mt-2 text-sm tabular-nums text-slate-800">
                <strong data-testid="cohort-one-off-apps">{story.oneOffApplications.toLocaleString()}</strong>{" "}
                Applications ({formatCohortSharePercent(story.oneOffApplicationShare)})
              </p>
            </div>
            <div
              className="rounded-xl border border-slate-200 bg-white p-5"
              data-testid="cohort-multi-panel"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Multi-Application Applicants
              </p>
              <p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">
                {story.multiApplicants.toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {formatCohortSharePercent(story.multiApplicantShare)} of Applicant legal names
              </p>
              <div className="mt-4 h-3 rounded bg-slate-100" aria-hidden="true">
                <div
                  className="h-3 rounded bg-[#007d65]"
                  style={{ width: `${shareBarWidth(story.multiApplicationShare)}%` }}
                />
              </div>
              <p className="mt-2 text-sm tabular-nums text-slate-800">
                <strong data-testid="cohort-multi-apps">{story.multiApplications.toLocaleString()}</strong>{" "}
                Applications ({formatCohortSharePercent(story.multiApplicationShare)})
              </p>
            </div>
          </div>
        </section>

        {/* 4. Concentration */}
        <section className="mt-10" aria-labelledby="concentration-heading" data-testid="cohort-concentration">
          <h2 id="concentration-heading" className="text-xl font-bold text-slate-950">
            Portfolio concentration
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Share of all {intelligence.applicationDenominator.toLocaleString()} Applications held by the
            largest Applicant legal names. This is Application concentration by Applicant legal name —
            not economic market share.
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Top N</th>
                  <th className="px-4 py-3 font-semibold">Applications</th>
                  <th className="px-4 py-3 font-semibold">Share of 1,930</th>
                </tr>
              </thead>
              <tbody>
                {concentration.map((row) => (
                  <tr
                    key={row.topN}
                    className="border-b border-slate-100 last:border-0"
                    data-testid={`cohort-concentration-top-${row.topN}`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">Top {row.topN}</td>
                    <td
                      className="px-4 py-3 tabular-nums text-slate-900"
                      data-testid={`cohort-concentration-top-${row.topN}-apps`}
                    >
                      {row.applicationCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {formatCohortSharePercent(row.share)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 5. Largest portfolios */}
        <section className="mt-10" aria-labelledby="largest-heading" data-testid="cohort-largest">
          <h2 id="largest-heading" className="text-xl font-bold text-slate-950">
            Largest Applicant legal-name portfolios
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Ranked by Application count. Equal counts are ordered A–Z by Applicant legal name. Rows
            link to historical Explore search — not a 2026 Applicant Profile.
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Applicant legal name</th>
                  <th className="px-4 py-3 font-semibold">Applications</th>
                  <th className="px-4 py-3 font-semibold">Share</th>
                  <th className="px-4 py-3 font-semibold">Explore</th>
                </tr>
              </thead>
              <tbody>
                {largest.map((row) => (
                  <tr
                    key={row.applicantLegalName}
                    className="border-b border-slate-100 last:border-0"
                    data-testid={`cohort-largest-${row.rank}`}
                    data-applicant-legal-name={row.applicantLegalName}
                  >
                    <td className="px-4 py-3 tabular-nums text-slate-600">{row.rank}</td>
                    <td className="px-4 py-3 font-medium text-slate-950">{row.applicantLegalName}</td>
                    <td
                      className="px-4 py-3 tabular-nums text-slate-900"
                      data-testid={`cohort-largest-${row.rank}-apps`}
                    >
                      {row.applicationCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {formatCohortSharePercent(row.share)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={row.exploreHref}
                        className="font-semibold text-[#006a56] underline"
                        data-testid={`cohort-explore-${row.rank}`}
                      >
                        View in Explore
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 6. Exact-string competition exposure */}
        <section
          id="exact-string-competition"
          className="mt-10 scroll-mt-6"
          aria-labelledby="exact-string-heading"
          data-testid="cohort-exact-string"
        >
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">
            2012 only · Exact applied-for string
          </p>
          <h2 id="exact-string-heading" className="mt-2 text-xl font-bold text-slate-950">
            Exact-string competition exposure
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600" data-testid="cohort-exact-string-question">
            {exact.productQuestion}
          </p>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">
            Counts Applications for the same exact applied-for string. This is{" "}
            <strong>not</strong> official contention.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div
              className="rounded-xl border border-slate-200 bg-white px-4 py-3"
              data-testid="cohort-exact-string-applicants"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Applicant legal names exposed
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">
                {exact.applicantsExposed.toLocaleString()}
                <span className="text-base font-semibold text-slate-600">
                  {" "}
                  / {intelligence.applicantLegalNameDenominator.toLocaleString()}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {formatCohortSharePercent(exact.applicantShare)}
              </p>
            </div>
            <div
              className="rounded-xl border border-slate-200 bg-white px-4 py-3"
              data-testid="cohort-exact-string-apps"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Applications exposed
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">
                {exact.applicationsExposed.toLocaleString()}
                <span className="text-base font-semibold text-slate-600">
                  {" "}
                  / {intelligence.applicationDenominator.toLocaleString()}
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {formatCohortSharePercent(exact.applicationShare)}
              </p>
            </div>
            <div
              className="rounded-xl border border-slate-200 bg-white px-4 py-3"
              data-testid="cohort-exact-string-groups"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Exact repeated strings
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">
                {exact.repeatedStringCount.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-600">Not official contention sets</p>
            </div>
          </div>

          <p className="mt-4 text-sm text-slate-600">
            Ranked by Applications in exact-string competition. Equal counts ordered A–Z by Applicant
            legal name. Higher exposure is not labeled better or worse.
          </p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Applicant legal name</th>
                  <th className="px-4 py-3 font-semibold">Portfolio</th>
                  <th className="px-4 py-3 font-semibold">In exact-string competition</th>
                  <th className="px-4 py-3 font-semibold">Distinct repeated strings</th>
                  <th className="px-4 py-3 font-semibold">Portfolio exposure</th>
                  <th className="px-4 py-3 font-semibold">Explore</th>
                </tr>
              </thead>
              <tbody>
                {exact.ranked.map((row) => (
                  <tr
                    key={row.applicantLegalName}
                    className="border-b border-slate-100 last:border-0"
                    data-testid={`cohort-exact-string-row-${row.rank}`}
                    data-applicant-legal-name={row.applicantLegalName}
                  >
                    <td className="px-4 py-3 tabular-nums text-slate-600">{row.rank}</td>
                    <td className="px-4 py-3 font-medium text-slate-950">{row.applicantLegalName}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-900">
                      {row.portfolioApplicationCount.toLocaleString()}
                    </td>
                    <td
                      className="px-4 py-3 tabular-nums text-slate-900"
                      data-testid={`cohort-exact-string-exposed-${row.rank}`}
                    >
                      {row.applicationsInExactStringCompetition.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {row.distinctRepeatedStrings.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {formatCohortSharePercent(row.portfolioExposureShare)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={row.exploreHref}
                        className="font-semibold text-[#006a56] underline"
                        data-testid={`cohort-exact-string-explore-${row.rank}`}
                      >
                        View in Explore
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p
            className="mt-4 max-w-3xl text-xs leading-5 text-slate-600"
            data-testid="cohort-exact-string-contention-note"
          >
            Most exact-repeat Applications also appeared in preliminary contention data (
            {exact.exactRepeatApplicationsAlsoInPreliminaryContention.toLocaleString()} of{" "}
            {exact.applicationsExposed.toLocaleString()}), but RIH keeps the two historical concepts
            separate. Exact repeated strings are not official contention sets.
          </p>
          <p className="mt-2">
            <Link
              href={intelligence.hrefs.exploreHistoricalStrings}
              className="text-sm font-semibold text-[#006a56] underline"
              data-testid="cohort-exact-string-explore-strings"
            >
              Explore 2012 historical strings
            </Link>
          </p>
        </section>

        {/* 7. Methodology */}
        <section className="mt-10 mb-8" aria-labelledby="methodology-heading" data-testid="cohort-methodology">
          <h2 id="methodology-heading" className="text-xl font-bold text-slate-950">
            Historical methodology and limitations
          </h2>
          <dl className="mt-3 space-y-2 text-sm text-slate-700">
            <div>
              <dt className="font-semibold text-slate-900">Source</dt>
              <dd data-testid="cohort-provenance-source">{intelligence.provenance.sourceLabel}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Grain</dt>
              <dd data-testid="cohort-provenance-grain">{intelligence.provenance.grainLabel}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Denominators</dt>
              <dd>
                {intelligence.provenance.applicationDenominatorLabel};{" "}
                {intelligence.provenance.applicantDenominatorLabel}
              </dd>
            </div>
          </dl>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {intelligence.provenance.limitations.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-slate-600">Not included in this view:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600" data-testid="cohort-exclusions">
            {intelligence.exclusions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className="mt-6 flex flex-wrap gap-4 text-sm">
            <Link
              href={intelligence.hrefs.crossRound}
              className="font-semibold text-[#006a56] underline"
              data-testid="cohort-to-cross-round"
            >
              2012 vs 2026 structural comparison
            </Link>
            <Link
              href={intelligence.hrefs.exploreHistorical}
              className="font-semibold text-[#006a56] underline"
              data-testid="cohort-to-explore"
            >
              Explore 2012 Applications
            </Link>
            <Link
              href={intelligence.hrefs.commandCenter}
              className="font-semibold text-[#006a56] underline"
            >
              Back to Command Center
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
