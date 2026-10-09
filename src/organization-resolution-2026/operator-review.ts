import type { OrganizationResolutionSnapshot } from "./types";

export type OperatorReviewRow = {
  applicantLegalName: string;
  applicationCount: number;
  applicationIds: string;
  resolutionState: string;
  organizationId: string;
  organizationKey: string;
  possible2012OrganizationKey: string;
  evidenceRefIds: string;
  reason: string;
  ambiguityNotes: string;
};

export function buildOperatorReviewRows(snapshot: OrganizationResolutionSnapshot): OperatorReviewRow[] {
  const orgById = new Map(snapshot.organizations.map((o) => [o.organizationId, o]));
  return snapshot.applicantIdentityMappings.map((m) => {
    const org = m.organizationId ? orgById.get(m.organizationId) : undefined;
    return {
      applicantLegalName: m.applicantLegalName,
      applicationCount: m.applicationIds.length,
      applicationIds: m.applicationIds.join(";"),
      resolutionState: m.resolutionState,
      organizationId: m.organizationId ?? "",
      organizationKey: org?.organizationKey ?? "",
      possible2012OrganizationKey: m.possible2012OrganizationKey ?? "",
      evidenceRefIds: m.evidenceRefIds.join(";"),
      reason: m.reason,
      ambiguityNotes: m.ambiguityNotes ?? "",
    };
  });
}

export function operatorReviewTsv(snapshot: OrganizationResolutionSnapshot): string {
  const rows = buildOperatorReviewRows(snapshot);
  const headers = [
    "applicantLegalName",
    "applicationCount",
    "applicationIds",
    "resolutionState",
    "organizationId",
    "organizationKey",
    "possible2012OrganizationKey",
    "evidenceRefIds",
    "reason",
    "ambiguityNotes",
  ] as const;
  const lines = [headers.join("\t")];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeTsv(String(row[h]))).join("\t"));
  }
  return `${lines.join("\n")}\n`;
}

export function operatorReviewMarkdownSummary(snapshot: OrganizationResolutionSnapshot): string {
  const q = snapshot.quality;
  const topConfirmed = snapshot.organizations
    .filter((o) => o.status === "CONFIRMED")
    .sort((a, b) => b.memberApplicationIds.length - a.memberApplicationIds.length)
    .slice(0, 20);
  const candidates = snapshot.organizations.filter((o) => o.status === "CANDIDATE");
  const lines = [
    `# 2026 Organization resolution — steward review`,
    ``,
    `Method: \`${snapshot.methodVersion}\` · Schema: \`${snapshot.schemaVersion}\``,
    `Application pin: \`${snapshot.applicationPublicationPin.applicationGraphContentSha256}\``,
    `Semantic hash: \`${snapshot.semanticContentSha256}\``,
    ``,
    `## Quality`,
    ``,
    `| Metric | Value |`,
    `| --- | ---: |`,
    `| Observed Applications | ${q.observedApplications} |`,
    `| Observed Applicant legal names | ${q.observedApplicantLegalNames} |`,
    `| Multi-Application legal names | ${q.applicantLegalNamesWithMultipleApplications} |`,
    `| Confirmed Organizations | ${q.confirmedOrganizationCount} |`,
    `| Confirmed Applicant mappings | ${q.confirmedOrganizationMappings} |`,
    `| Confirmed Applications covered | ${q.applicationsCoveredByConfirmedOrganizations} |`,
    `| Candidate Organizations | ${q.candidateOrganizationCount} |`,
    `| Ambiguous Organizations | ${q.ambiguousOrganizationCount} |`,
    `| Unresolved legal names | ${q.unresolvedApplicantLegalNames} |`,
    `| Candidate name clusters | ${q.candidateClusterCount} |`,
    `| Product-eligible Organizations | ${q.productEligibleOrganizationCount} |`,
    `| Returning/new classifications | ${q.returningNewClassificationsCreated} |`,
    `| Cross-round identities | ${q.crossRoundIdentitiesCreated} |`,
    ``,
    `## Top confirmed portfolios`,
    ``,
  ];
  if (topConfirmed.length === 0) {
    lines.push(`_None — first-pass has no steward-confirmed Organizations (A/B evidence required)._`, ``);
  } else {
    lines.push(`| Organization | Applications | Applicant legal names |`, `| --- | ---: | --- |`);
    for (const org of topConfirmed) {
      lines.push(
        `| ${org.canonicalName} (\`${org.organizationKey}\`) | ${org.memberApplicationIds.length} | ${org.applicantLegalNames.join("; ")} |`,
      );
    }
    lines.push(``);
  }
  lines.push(`## Candidate historical / discovery (not product-eligible)`, ``);
  if (candidates.length === 0) {
    lines.push(`_None._`, ``);
  } else {
    lines.push(`| Candidate | Apps | possible2012 | Reason |`, `| --- | ---: | --- | --- |`);
    for (const org of candidates.slice(0, 50)) {
      lines.push(
        `| ${org.canonicalName} | ${org.memberApplicationIds.length} | ${org.possible2012OrganizationKey ?? ""} | ${(org.notes ?? "").replace(/\|/g, "/")} |`,
      );
    }
    lines.push(``);
  }
  lines.push(`## Limitations`, ``);
  for (const lim of snapshot.limitations) {
    lines.push(`- ${lim}`);
  }
  lines.push(``);
  return lines.join("\n");
}

function escapeTsv(value: string): string {
  return value.replace(/\t/g, " ").replace(/\r?\n/g, " ");
}
