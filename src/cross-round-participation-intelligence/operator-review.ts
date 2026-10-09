import { portfolioChangeDisclosureSentence } from "./portfolio-change";
import type { CrossRoundParticipationIntelligenceSnapshot } from "./types";

function escapeTsv(value: string | number | boolean | null): string {
  const s = value === null || value === undefined ? "" : String(value);
  return s.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

const TSV_COLUMNS = [
  "rowKind",
  "organization2026Id",
  "canonicalDisplayName",
  "organization2012Id",
  "applications2012",
  "applications2026",
  "applicationDelta",
  "applicationPercentDelta",
  "portfolioChange",
  "participationStatus",
  "crossRoundState",
  "relationshipType",
  "label",
  "crossRoundIdentityId",
] as const;

export function participationOperatorReviewTsv(
  snapshot: CrossRoundParticipationIntelligenceSnapshot,
): string {
  const rows: string[] = [];

  for (const c of [...snapshot.organizationComparisons].sort((a, b) =>
    a.canonicalDisplayName.localeCompare(b.canonicalDisplayName),
  )) {
    rows.push(
      [
        "confirmed-returning",
        c.organization2026Id,
        c.canonicalDisplayName,
        c.organization2012Id,
        c.applications2012,
        c.applications2026,
        c.applicationDelta,
        c.applicationPercentDelta.toFixed(4),
        c.portfolioChange,
        c.participationStatus,
        "CONFIRMED",
        c.relationshipType,
        "Steward-confirmed returning Organization",
        c.crossRoundIdentityId,
      ]
        .map(escapeTsv)
        .join("\t"),
    );
  }

  for (const e of [...snapshot.excludedCases].sort((a, b) =>
    a.organization2026CanonicalName.localeCompare(b.organization2026CanonicalName),
  )) {
    rows.push(
      [
        "excluded",
        e.organization2026Id,
        e.organization2026CanonicalName,
        e.organization2012Id,
        "",
        "",
        "",
        "",
        "",
        "",
        e.crossRoundState,
        e.relationshipType,
        e.label,
        "",
      ]
        .map(escapeTsv)
        .join("\t"),
    );
  }

  return [TSV_COLUMNS.join("\t"), ...rows].join("\n") + "\n";
}

export function participationOperatorReviewMarkdown(
  snapshot: CrossRoundParticipationIntelligenceSnapshot,
): string {
  const s = snapshot.summary;
  const c = snapshot.coverage;
  const lines: string[] = [
    `# Confirmed-subset returning + portfolio-change intelligence`,
    ``,
    `Method: \`${snapshot.methodVersion}\``,
    `Semantic hash: \`${snapshot.semanticContentSha256}\``,
    `Source cross-round hash: \`${snapshot.sourceCrossRoundIdentityHash}\``,
    ``,
    `## Summary`,
    ``,
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Confirmed returning Organizations | ${s.confirmedReturningOrganizations} |`,
    `| Expanded (confirmed subset) | ${s.expandedConfirmed} |`,
    `| Contracted (confirmed subset) | ${s.contractedConfirmed} |`,
    `| Unchanged (confirmed subset) | ${s.unchangedConfirmed} |`,
    `| Represented 2012 Applications | ${s.representedApplications2012} |`,
    `| Represented 2026 Applications | ${s.representedApplications2026} |`,
    `| Combined confirmed-subset Application delta | ${s.combinedConfirmedSubsetApplicationDelta} |`,
    `| New Organization metric | ${s.newOrganizationMetric.status} (numeric count absent) |`,
    ``,
    `## Coverage (identity-resolution, not round coverage)`,
    ``,
    `| Measure | Value |`,
    `| --- | --- |`,
    `| Cross-round identities / 2026 confirmed Orgs | ${c.confirmedCrossRoundIdentities} / ${c.confirmed2026Organizations} |`,
    `| Represented 2026 Apps / 2026 confirmed Apps | ${c.representedApplications2026} / ${c.confirmed2026Applications} |`,
    `| Cross-round identities / 2012 confirmed Orgs | ${c.confirmedCrossRoundIdentities} / ${c.confirmed2012Organizations} |`,
    `| Represented 2012 Apps / 2012 confirmed Apps | ${c.representedApplications2012} / ${c.confirmed2012Applications} |`,
    ``,
    `> This table is **not exhaustive**. Excluded cases below are intentionally outside returning/portfolio-change metrics.`,
    ``,
    `## Confirmed returning Organizations`,
    ``,
  ];

  for (const org of [...snapshot.organizationComparisons].sort((a, b) =>
    a.canonicalDisplayName.localeCompare(b.canonicalDisplayName),
  )) {
    lines.push(`### ${org.canonicalDisplayName}`);
    lines.push(``);
    lines.push(`| Field | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| 2026 Organization | \`${org.organization2026Id}\` |`);
    lines.push(`| 2012 Organization | \`${org.organization2012Id}\` |`);
    lines.push(`| Participation | ${org.participationStatus} |`);
    lines.push(`| Relationship | ${org.relationshipType} |`);
    lines.push(`| 2012 Applications | ${org.applications2012} |`);
    lines.push(`| 2026 Applications | ${org.applications2026} |`);
    lines.push(`| Delta | ${org.applicationDelta} |`);
    lines.push(`| Percent delta (context) | ${org.applicationPercentDelta.toFixed(2)}% |`);
    lines.push(`| Portfolio change | **${org.portfolioChange}** |`);
    lines.push(
      `| Disclosure | ${portfolioChangeDisclosureSentence(org.canonicalDisplayName, org.applications2012, org.applications2026)} |`,
    );
    lines.push(``);
  }

  lines.push(`## Excluded from returning / portfolio-change`);
  lines.push(``);
  for (const e of [...snapshot.excludedCases].sort((a, b) =>
    a.organization2026CanonicalName.localeCompare(b.organization2026CanonicalName),
  )) {
    lines.push(
      `- **${e.organization2026CanonicalName}** — ${e.label} (\`${e.crossRoundState}\` / ${e.relationshipType})`,
    );
  }
  lines.push(``);
  lines.push(`## Limitations`);
  lines.push(``);
  for (const lim of snapshot.limitations) {
    lines.push(`- ${lim}`);
  }
  lines.push(``);
  return lines.join("\n");
}

export function inventoryFromParticipationSnapshot(
  snapshot: CrossRoundParticipationIntelligenceSnapshot,
) {
  return {
    methodVersion: snapshot.methodVersion,
    semanticContentSha256: snapshot.semanticContentSha256,
    sourceCrossRoundIdentityHash: snapshot.sourceCrossRoundIdentityHash,
    summary: snapshot.summary,
    coverage: snapshot.coverage,
    eligibilityNotes: snapshot.eligibilityNotes,
  };
}
