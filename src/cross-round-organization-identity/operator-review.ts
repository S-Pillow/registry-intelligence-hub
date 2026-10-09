import type { CrossRoundOrganizationIdentitySnapshot } from "./types";

const TSV_COLUMNS = [
  "organization2026Id",
  "organization2026Key",
  "organization2026CanonicalName",
  "organization2026ApplicationCount",
  "organization2012Id",
  "organization2012Key",
  "organization2012CanonicalName",
  "organization2012ApplicationCount",
  "relationshipType",
  "state",
  "reviewRecommendation",
  "strongestEvidenceStrength",
  "temporalContinuityClaim",
  "acquisitionAfter2012",
  "evidenceRefIds",
  "recommendationReason",
  "stewardDecision",
  "crossRoundIdentityId",
] as const;

function escapeTsv(value: string | number | boolean | null): string {
  const s = value === null || value === undefined ? "" : String(value);
  return s.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

export function crossRoundOperatorReviewTsv(snapshot: CrossRoundOrganizationIdentitySnapshot): string {
  const evidenceStrength = new Map(snapshot.evidence.map((e) => [e.evidenceId, e.strength]));
  const rows = [...snapshot.mappings]
    .sort((a, b) => a.organization2026Key.localeCompare(b.organization2026Key))
    .map((m) => {
      const strengths = m.evidenceRefIds.map((id) => evidenceStrength.get(id) ?? "");
      const strongest = strengths.includes("A")
        ? "A"
        : strengths.includes("B")
          ? "B"
          : strengths.includes("C")
            ? "C"
            : strengths.includes("D")
              ? "D"
              : "";
      return [
        m.organization2026Id,
        m.organization2026Key,
        m.organization2026CanonicalName,
        m.organization2026ApplicationCount,
        m.organization2012Id,
        m.organization2012Key,
        m.organization2012CanonicalName,
        m.organization2012ApplicationCount,
        m.relationshipType,
        m.state,
        m.reviewRecommendation,
        strongest,
        m.temporalAssessment.continuityClaim,
        m.temporalAssessment.acquisitionAfter2012,
        m.evidenceRefIds.join("|"),
        m.recommendationReason,
        m.stewardDecision,
        m.crossRoundIdentityId,
      ]
        .map(escapeTsv)
        .join("\t");
    });
  return [TSV_COLUMNS.join("\t"), ...rows].join("\n") + "\n";
}

export function crossRoundOperatorReviewMarkdown(snapshot: CrossRoundOrganizationIdentitySnapshot): string {
  const q = snapshot.quality;
  const lines: string[] = [
    `# Cross-round Organization identity — steward review`,
    ``,
    `Method: \`${snapshot.methodVersion}\``,
    `Semantic hash: \`${snapshot.semanticContentSha256}\``,
    ``,
    `## Pins`,
    ``,
    `| Layer | Pin |`,
    `| --- | --- |`,
    `| 2012 promotion registry | \`${snapshot.pin2012.contentSha256}\` |`,
    `| 2026 Organization resolution | \`${snapshot.pin2026Resolution.contentSha256}\` |`,
    `| 2026 Application graph | \`${snapshot.pin2026Resolution.applicationGraphContentSha256}\` |`,
    ``,
    `## Quality`,
    ``,
    `| Metric | Value |`,
    `| --- | --- |`,
    `| 2026 confirmed Organizations examined | ${q.examined2026ConfirmedOrganizations} |`,
    `| 2012 confirmed Organizations available | ${q.available2012ConfirmedOrganizations} |`,
    `| recommend CONFIRM | ${q.recommendConfirm} |`,
    `| recommend REJECT | ${q.recommendReject} |`,
    `| recommend AMBIGUOUS | ${q.recommendAmbiguous} |`,
    `| no plausible confirmed-2012 match | ${q.noPlausibleConfirmed2012Match} |`,
    `| cross-round CONFIRMED (steward) | ${q.crossRoundConfirmed} |`,
    `| returning/new/expanded/contracted finalized | ${q.returningClassificationsFinalized}/${q.newClassificationsFinalized}/${q.expandedClassificationsFinalized}/${q.contractedClassificationsFinalized} |`,
    `| Applications in recommend-CONFIRM mappings | ${q.applicationsInRecommendConfirmMappings} |`,
    ``,
    `> Unmatched ≠ NEW. Returning/new remain blocked until steward-approved CONFIRMED cross-round mappings exist.`,
    ``,
    `## Dossiers`,
    ``,
  ];

  for (const m of [...snapshot.mappings].sort((a, b) =>
    a.organization2026Key.localeCompare(b.organization2026Key),
  )) {
    lines.push(`### ${m.organization2026CanonicalName}`);
    lines.push(``);
    lines.push(`| Field | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| 2026 Organization ID | \`${m.organization2026Id}\` |`);
    lines.push(`| 2026 Applications | ${m.organization2026ApplicationCount} |`);
    lines.push(
      `| 2012 Candidate | ${m.organization2012CanonicalName ? `${m.organization2012CanonicalName} (\`${m.organization2012Id}\`)` : "*(none — unmatched)*"} |`,
    );
    lines.push(`| 2012 Applications | ${m.organization2012ApplicationCount || "—"} |`);
    lines.push(`| Relationship | ${m.relationshipType} |`);
    lines.push(`| State | ${m.state} |`);
    lines.push(`| Recommendation | **${m.reviewRecommendation}** |`);
    lines.push(`| Steward decision | ${m.stewardDecision ?? "*(pending)*"} |`);
    lines.push(`| Temporal | ${m.temporalAssessment.continuityClaim} |`);
    lines.push(`| Acquisition after 2012 | ${m.temporalAssessment.acquisitionAfter2012} |`);
    lines.push(`| Evidence | ${m.evidenceRefIds.map((id) => `\`${id}\``).join(", ")} |`);
    lines.push(`| Reason | ${m.recommendationReason} |`);
    lines.push(``);
  }

  lines.push(`## Limitations`);
  lines.push(``);
  for (const lim of snapshot.limitations) {
    lines.push(`- ${lim}`);
  }
  lines.push(``);
  return lines.join("\n");
}

export function inventoryFromCrossRoundSnapshot(snapshot: CrossRoundOrganizationIdentitySnapshot) {
  return {
    methodVersion: snapshot.methodVersion,
    semanticContentSha256: snapshot.semanticContentSha256,
    pin2012: snapshot.pin2012.contentSha256,
    pin2026: snapshot.pin2026Resolution.contentSha256,
    applicationGraphPin: snapshot.pin2026Resolution.applicationGraphContentSha256,
    quality: snapshot.quality,
    recommendConfirmIds: snapshot.mappings
      .filter((m) => m.reviewRecommendation === "CONFIRM")
      .map((m) => ({
        organization2026Id: m.organization2026Id,
        organization2012Id: m.organization2012Id,
        relationshipType: m.relationshipType,
      })),
    returningNewEligible: false,
  };
}
