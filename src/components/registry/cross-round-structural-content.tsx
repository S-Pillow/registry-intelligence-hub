"use client";

import Link from "next/link";
import type {
  BlockedComparisonCard,
  CrossRoundStructuralIntelligence,
  ReturningOrganizationCard,
  StructuralComparisonCard,
} from "@/lib/cross-round-structural-intelligence";

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function PairedBar({
  value2012,
  value2026,
  testIdPrefix,
}: {
  value2012: number;
  value2026: number;
  testIdPrefix: string;
}) {
  const max = Math.max(value2012, value2026, 1);
  const w2012 = Math.round((value2012 / max) * 100);
  const w2026 = Math.round((value2026 / max) * 100);
  return (
    <div className="mt-4 space-y-2" aria-hidden="true" data-testid={`${testIdPrefix}-bars`}>
      <div className="flex items-center gap-3">
        <span className="w-10 shrink-0 text-[11px] font-semibold uppercase text-slate-500">2012</span>
        <div className="h-3 flex-1 rounded bg-slate-100">
          <div className="h-3 rounded bg-slate-500" style={{ width: `${w2012}%` }} />
        </div>
        <span className="w-16 shrink-0 text-right text-sm font-bold tabular-nums text-slate-900">
          {value2012.toLocaleString()}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="w-10 shrink-0 text-[11px] font-semibold uppercase text-slate-500">2026</span>
        <div className="h-3 flex-1 rounded bg-slate-100">
          <div className="h-3 rounded bg-[#007d65]" style={{ width: `${w2026}%` }} />
        </div>
        <span className="w-16 shrink-0 text-right text-sm font-bold tabular-nums text-slate-900">
          {value2026.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function ComparisonCard({ card }: { card: StructuralComparisonCard }) {
  return (
    <article
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      data-testid={`cross-round-card-${card.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-950">{card.label}</h3>
        <span
          className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-[#006a56]"
          data-testid={`cross-round-status-${card.id}`}
        >
          Directly comparable
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center sm:text-left">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">2012</dt>
          <dd
            className="mt-1 text-2xl font-bold tabular-nums text-slate-950"
            data-testid={`cross-round-${card.id}-2012`}
          >
            {card.value2012.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">2026</dt>
          <dd
            className="mt-1 text-2xl font-bold tabular-nums text-slate-950"
            data-testid={`cross-round-${card.id}-2026`}
          >
            {card.value2026.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-slate-500">Change</dt>
          <dd
            className="mt-1 text-2xl font-bold tabular-nums text-[#006a56]"
            data-testid={`cross-round-${card.id}-delta`}
          >
            {formatSigned(card.delta)}
          </dd>
        </div>
      </dl>
      <PairedBar
        value2012={card.value2012}
        value2026={card.value2026}
        testIdPrefix={`cross-round-${card.id}`}
      />
      <p className="mt-3 text-xs leading-5 text-slate-600" data-testid={`cross-round-${card.id}-limitation`}>
        {card.limitation}
      </p>
      <p className="mt-2 text-[11px] leading-5 text-slate-500">
        2012: {card.source2012}. 2026: {card.source2026}.
      </p>
      {card.exploreHref ? (
        <p className="mt-3">
          <Link href={card.exploreHref} className="text-sm font-semibold text-[#006a56] underline">
            {card.id === "idn-applications" ? "Explore 2026 IDN Applications" : "Explore 2026 Applications"}
          </Link>
        </p>
      ) : null}
    </article>
  );
}

function ReturningCard({ org }: { org: ReturningOrganizationCard }) {
  return (
    <article
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      data-testid={`returning-org-${org.organizationKey}`}
    >
      <h3 className="text-base font-semibold text-slate-950">{org.displayName}</h3>
      <p className="mt-1 text-xs font-medium text-[#006a56]" data-testid={`returning-wording-${org.organizationKey}`}>
        {org.wording}
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        <div>
          <dt className="text-[11px] uppercase text-slate-500">2012</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums" data-testid={`returning-${org.organizationKey}-2012`}>
            {org.applications2012}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-slate-500">2026</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums" data-testid={`returning-${org.organizationKey}-2026`}>
            {org.applications2026}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-slate-500">Change</dt>
          <dd className="mt-1 text-xl font-bold tabular-nums text-[#006a56]" data-testid={`returning-${org.organizationKey}-delta`}>
            {formatSigned(org.delta)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-slate-600">
        Organization continuity is confirmed — this does not claim identical Applicant legal-entity wording across rounds.
      </p>
      <p className="mt-3">
        <Link
          href={org.profileHref}
          className="text-sm font-semibold text-[#006a56] underline"
          data-testid={`returning-profile-link-${org.organizationKey}`}
        >
          Open Organization Profile
        </Link>
      </p>
    </article>
  );
}

function BlockedCard({ card }: { card: BlockedComparisonCard }) {
  return (
    <li
      className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
      data-testid={`blocked-${card.dimensionId}`}
    >
      <p className="text-sm font-semibold text-slate-950">{card.label}</p>
      <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Not directly comparable yet
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{card.reason}</p>
    </li>
  );
}

export function CrossRoundStructuralContent({
  intelligence,
}: {
  intelligence: CrossRoundStructuralIntelligence;
}) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7faf8_0%,#eef3f0_40%,#f8fafc_100%)]" data-testid="cross-round-page">
      <header className="border-b border-slate-200 bg-white/90">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="font-mono text-sm font-semibold tracking-[0.18em] text-slate-800">
            FORGE/FORWARD
          </Link>
          <nav className="flex flex-wrap gap-3 text-sm">
            <Link href="/" className="font-medium text-slate-600 hover:text-slate-900">
              Command Center
            </Link>
            <Link href="/data-health" className="font-medium text-slate-600 hover:text-slate-900">
              Data &amp; methodology
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#006a56]">Cross-round research</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl" data-testid="cross-round-title">
          {intelligence.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700" data-testid="cross-round-subtitle">
          {intelligence.subtitle}
        </p>

        {/* 1. What changed */}
        <section className="mt-10" aria-labelledby="what-changed-heading" data-testid="cross-round-what-changed">
          <h2 id="what-changed-heading" className="text-xl font-bold text-slate-950">
            What changed
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Observation first — only currently defensible official comparisons.
          </p>
          {intelligence.summary.length === 0 ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Official cross-round Application and IDN comparisons unlock when 2026 Application actuality is ready.
            </p>
          ) : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {intelligence.summary.map((card) => (
                <ComparisonCard key={card.id} card={card} />
              ))}
            </div>
          )}
        </section>

        {/* 2. Confirmed structural comparisons (same cards, explicit section when present) */}
        {intelligence.confirmedComparisons.length > 0 ? (
          <section className="mt-10" aria-labelledby="confirmed-comparisons-heading" data-testid="cross-round-confirmed">
            <h2 id="confirmed-comparisons-heading" className="text-xl font-bold text-slate-950">
              Confirmed structural comparisons
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Status: directly comparable official aggregates. Absolute change only — no interpretive market narrative.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-700">
              {intelligence.confirmedComparisons.map((card) => (
                <li key={`sum-${card.id}`}>
                  <strong>{card.label}:</strong> {card.value2012.toLocaleString()} →{" "}
                  {card.value2026.toLocaleString()} ({formatSigned(card.delta)})
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* 3. Participation shape */}
        <section className="mt-10" aria-labelledby="participation-heading" data-testid="cross-round-participation">
          <h2 id="participation-heading" className="text-xl font-bold text-slate-950">
            Participation shape
          </h2>
          <p className="mt-1 text-sm text-slate-600">{intelligence.participationShape.label}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {intelligence.participationShape.facts.map((fact) => (
              <div
                key={fact.id}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3"
                data-testid={`participation-fact-${fact.id}`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{fact.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-950">{fact.value.toLocaleString()}</p>
                <p className="mt-1 text-xs text-slate-600">{fact.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-600">{intelligence.participationShape.note}</p>
          <p className="mt-2 text-xs text-slate-600" data-testid="cross-round-coverage-note">
            {intelligence.coverage.wdoDisclosure}
          </p>
        </section>

        {/* 4. Confirmed returning Organizations */}
        <section className="mt-10" aria-labelledby="returning-heading" data-testid="cross-round-returning">
          <h2 id="returning-heading" className="text-xl font-bold text-slate-950">
            Confirmed returning Organizations
          </h2>
          <p className="mt-1 text-sm text-slate-600" data-testid="returning-scope-wording">
            {intelligence.returningOrganizations.scopeWording}
          </p>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {intelligence.returningOrganizations.organizations.map((org) => (
              <ReturningCard key={org.organizationKey} org={org} />
            ))}
          </div>
          <div
            className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3"
            data-testid="returning-sample"
          >
            <p className="text-sm font-semibold text-slate-950">
              {intelligence.returningOrganizations.sample.label}
            </p>
            <p className="mt-1 text-sm tabular-nums text-slate-800">
              {intelligence.returningOrganizations.sample.applications2012} →{" "}
              {intelligence.returningOrganizations.sample.applications2026} (
              {formatSigned(intelligence.returningOrganizations.sample.delta)})
            </p>
            <p className="mt-2 text-xs text-slate-600" data-testid="unmatched-not-new">
              {intelligence.returningOrganizations.unmatchedIsNotNew}
            </p>
          </div>
        </section>

        {/* 5. Blocked */}
        <section className="mt-10" aria-labelledby="blocked-heading" data-testid="cross-round-blocked">
          <h2 id="blocked-heading" className="text-xl font-bold text-slate-950">
            What RIH does not compare yet
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Incompatible metrics are withheld rather than forced into charts. This is a trust feature.
          </p>
          <ul className="mt-4 space-y-3">
            {intelligence.blockedComparisons.map((card) => (
              <BlockedCard key={card.dimensionId} card={card} />
            ))}
          </ul>
        </section>

        {/* 6. Sources */}
        <section className="mt-10 mb-8" aria-labelledby="sources-heading" data-testid="cross-round-sources">
          <h2 id="sources-heading" className="text-xl font-bold text-slate-950">
            Sources and methodology
          </h2>
          <dl className="mt-3 space-y-2 text-sm text-slate-700">
            <div>
              <dt className="font-semibold text-slate-900">2012</dt>
              <dd>{intelligence.sources.source2012}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">2026 Applications</dt>
              <dd>{intelligence.sources.source2026Applications}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">2026 orientation designations</dt>
              <dd>{intelligence.sources.source2026Orientation}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Returning Organizations</dt>
              <dd>{intelligence.sources.returningMethod}</dd>
            </div>
          </dl>
          <p className="mt-4 flex flex-wrap gap-4 text-sm">
            <Link href={intelligence.sources.dataHealthHref} className="font-semibold text-[#006a56] underline">
              Data &amp; methodology
            </Link>
            <Link href={intelligence.commandCenterHref} className="font-semibold text-[#006a56] underline">
              Back to Command Center
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
