/**
 * Deterministic Command Center Intelligence Pulse builders.
 * Eligibility-gated; no AI; no runtime prose generation beyond approved templates.
 */

import type { CommandCenterIntelligenceV2 } from "@/lib/command-center-intelligence-v2";
import { crossRoundStructuralHref } from "@/lib/cross-round-structural-intelligence";

export type CommandCenterInsight = {
  id: string;
  category: string;
  lead: string;
  body: string;
  href: string | null;
  linkLabel: string | null;
  evidenceKeys: readonly string[];
};

export type CommandCenterInsightsInput = {
  intelligence: CommandCenterIntelligenceV2;
  godaddyUniqueContentionSets: number | null;
};

/**
 * Whole-percent decline from a positive baseline.
 * Returns null when active is not strictly below baseline (equal/increase).
 * Never uses absolute difference — direction is explicit.
 */
export function wholePercentDecline(baseline: number, active: number): number | null {
  if (!(baseline > 0)) {
    throw new Error("wholePercentDecline requires a positive baseline");
  }
  if (!(active < baseline)) {
    return null;
  }
  return Math.round(((baseline - active) / baseline) * 100);
}

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

function buildContentionConcentration(
  intelligence: CommandCenterIntelligenceV2,
  godaddyUniqueContentionSets: number | null,
): CommandCenterInsight | null {
  const { competitiveStructure } = intelligence;
  if (competitiveStructure.status !== "available") return null;
  if (godaddyUniqueContentionSets == null) return null;
  if (competitiveStructure.largestSetSize == null) return null;

  return {
    id: "contention-concentration",
    category: "Competitive structure",
    lead: "Competition is concentrated:",
    body: `GoDaddy Registry Services appears in ${formatCount(godaddyUniqueContentionSets)} of the ${formatCount(competitiveStructure.setCount)} official initial contention sets, while the largest set contains ${formatCount(competitiveStructure.largestSetSize)} applications.`,
    href: "/contention",
    linkLabel: "Explore contention",
    evidenceKeys: [
      "godaddyUniqueContentionSets",
      "competitiveStructure.setCount",
      "competitiveStructure.largestSetSize",
    ],
  };
}

function buildStructuralChange(
  intelligence: CommandCenterIntelligenceV2,
): CommandCenterInsight | null {
  const apps = intelligence.crossRound.applications;
  const idn = intelligence.crossRound.idn;
  if (apps == null || idn == null) return null;

  // Decline-only template: omit unless BOTH comparisons are actual declines.
  const appDeclinePct = wholePercentDecline(apps.baseline2012, apps.active2026);
  const idnDeclinePct = wholePercentDecline(idn.baseline2012, idn.active2026);
  if (appDeclinePct == null || idnDeclinePct == null) return null;

  return {
    id: "structural-change-2012-2026",
    category: "Structural change",
    lead: "The 2026 round is smaller and substantially less IDN-heavy than 2012:",
    body: `applications are down ${appDeclinePct}%, while IDN applications are down ${idnDeclinePct}%.`,
    href: crossRoundStructuralHref(),
    linkLabel: "Explore 2012 vs 2026",
    evidenceKeys: [
      "crossRound.applications",
      "crossRound.idn",
      `appDeclinePct:${appDeclinePct}`,
      `idnDeclinePct:${idnDeclinePct}`,
    ],
  };
}

function buildCoverageDisclosure(
  intelligence: CommandCenterIntelligenceV2,
): CommandCenterInsight | null {
  const { coverage } = intelligence;
  if (coverage.officialApplications <= 0) return null;
  if (coverage.observedApplicationRecords <= 0) return null;
  // "nearly complete … exception is explicit" requires a known excluded record.
  if (coverage.knownExcludedCount <= 0) return null;

  const excluded = coverage.knownExcludedCount;
  const excludedPhrase =
    excluded === 1
      ? "1 administrative-check Application"
      : `${formatCount(excluded)} administrative-check Applications`;

  return {
    id: "coverage-disclosure",
    category: "Coverage",
    lead: "Coverage is nearly complete, and the exception is explicit:",
    body: `RIH represents ${formatCount(coverage.observedApplicationRecords)} of the ${formatCount(coverage.officialApplications)} official Applications, with ${excludedPhrase} outside the normal list/export.`,
    href: coverage.dataHealthHref,
    linkLabel: "View methodology",
    evidenceKeys: [
      "coverage.observedApplicationRecords",
      "coverage.officialApplications",
      "coverage.knownExcludedCount",
    ],
  };
}

function buildOfficialContentionScale(
  intelligence: CommandCenterIntelligenceV2,
): CommandCenterInsight | null {
  const { competitiveStructure } = intelligence;
  if (competitiveStructure.status !== "available") return null;

  return {
    id: "official-contention-scale",
    category: "Competitive structure",
    lead: "Initial contention is broad:",
    body: `the official publication contains ${formatCount(competitiveStructure.membershipCount)} joined memberships across ${formatCount(competitiveStructure.setCount)} contention sets.`,
    href: "/contention",
    linkLabel: "Inspect contention",
    evidenceKeys: [
      "competitiveStructure.membershipCount",
      "competitiveStructure.setCount",
    ],
  };
}

function buildRoundCompositionInsight(
  intelligence: CommandCenterIntelligenceV2,
): CommandCenterInsight | null {
  const composition = intelligence.roundComposition;
  if (composition == null) return null;

  return {
    id: "round-composition-brand",
    category: "Round composition",
    lead: "Brand applications are a major part of the 2026 round:",
    body: `ICANN's official aggregates identify ${formatCount(composition.brand.value)} Brand applications, compared with ${formatCount(composition.idn.value)} IDN applications and ${formatCount(composition.community.value)} Community applications.`,
    href: intelligence.drilldown.exploreApplicationsHref,
    linkLabel: "Explore applications",
    evidenceKeys: [
      "roundComposition.brand",
      "roundComposition.idn",
      "roundComposition.community",
    ],
  };
}

/**
 * Build the ordered, eligibility-gated Intelligence Pulse set.
 * Identical inputs → identical outputs. No randomization.
 */
export function buildCommandCenterInsights(
  input: CommandCenterInsightsInput,
): CommandCenterInsight[] {
  const { intelligence, godaddyUniqueContentionSets } = input;
  const insights: CommandCenterInsight[] = [];

  const contentionConcentration = buildContentionConcentration(
    intelligence,
    godaddyUniqueContentionSets,
  );
  if (contentionConcentration) insights.push(contentionConcentration);

  const structural = buildStructuralChange(intelligence);
  if (structural) insights.push(structural);

  const coverage = buildCoverageDisclosure(intelligence);
  if (coverage) insights.push(coverage);

  const scale = buildOfficialContentionScale(intelligence);
  if (scale) insights.push(scale);

  const composition = buildRoundCompositionInsight(intelligence);
  if (composition) insights.push(composition);

  return insights;
}

export const INTELLIGENCE_PULSE_INTERVAL_MS = 20_000;
