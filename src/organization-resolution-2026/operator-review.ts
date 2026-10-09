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

export function stewardReviewQueueTsv(snapshot: OrganizationResolutionSnapshot): string {
  const dossiers = snapshot.stewardReviewDossiers ?? [];
  const evidenceById = new Map(snapshot.evidence.map((e) => [e.evidenceId, e]));
  const headers = [
    "applicantLegalName",
    "observedApplications",
    "officialContentionMemberships",
    "candidateOrganization",
    "organizationId",
    "currentState",
    "recommendation",
    "evidenceStrength",
    "evidenceSummary",
    "evidenceUrls",
    "temporalNote",
    "historicalCandidateMatch",
    "stewardDecision",
    "requiredStewardAction",
  ] as const;
  const lines = [headers.join("\t")];
  for (const d of [...dossiers].sort(
    (a, b) =>
      b.observedApplicationCount - a.observedApplicationCount ||
      a.applicantLegalName.localeCompare(b.applicantLegalName),
  )) {
    const summaries = d.evidenceIds.map((id) => evidenceById.get(id)?.summary ?? "").filter(Boolean);
    const urls = d.evidenceIds.map((id) => evidenceById.get(id)?.sourceIdentifier ?? "").filter(Boolean);
    const row = {
      applicantLegalName: d.applicantLegalName,
      observedApplications: String(d.observedApplicationCount),
      officialContentionMemberships: String(d.officialContentionMemberships),
      candidateOrganization: d.candidateCanonicalName ?? "",
      organizationId: d.candidateOrganizationId ?? "",
      currentState: d.resolutionState,
      recommendation: d.reviewRecommendation,
      evidenceStrength: d.strongestEvidenceStrength ?? "",
      evidenceSummary: summaries.join(" | "),
      evidenceUrls: urls.join(" | "),
      temporalNote: d.temporalNote,
      historicalCandidateMatch: d.possible2012OrganizationKey ?? "",
      stewardDecision: d.stewardDecision,
      requiredStewardAction: d.requiredStewardAction,
    };
    lines.push(headers.map((h) => escapeTsv(row[h])).join("\t"));
  }
  return `${lines.join("\n")}\n`;
}

export function operatorReviewMarkdownSummary(snapshot: OrganizationResolutionSnapshot): string {
  const q = snapshot.quality;
  const topConfirmed = snapshot.organizations
    .filter((o) => o.status === "CONFIRMED")
    .sort((a, b) => b.memberApplicationIds.length - a.memberApplicationIds.length)
    .slice(0, 20);
  const dossiers = [...(snapshot.stewardReviewDossiers ?? [])].sort(
    (a, b) =>
      b.observedApplicationCount - a.observedApplicationCount ||
      a.applicantLegalName.localeCompare(b.applicantLegalName),
  );
  const confirmRecs = dossiers.filter((d) => d.reviewRecommendation === "CONFIRM");
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
    `| Confirmed Organizations (actual) | ${q.confirmedOrganizationCount} |`,
    `| Confirmed Applications covered | ${q.applicationsCoveredByConfirmedOrganizations} |`,
    `| Candidate Organizations | ${q.candidateOrganizationCount} |`,
    `| Ambiguous Organizations | ${q.ambiguousOrganizationCount} |`,
    `| Unresolved legal names | ${q.unresolvedApplicantLegalNames} |`,
    `| Dossiers researched | ${q.dossiersResearched ?? 0} |`,
    `| Recommend CONFIRM | ${q.recommendConfirm ?? 0} |`,
    `| Recommend KEEP_CANDIDATE | ${q.recommendKeepCandidate ?? 0} |`,
    `| Recommend AMBIGUOUS | ${q.recommendAmbiguous ?? 0} |`,
    `| Recommend REJECT | ${q.recommendReject ?? 0} |`,
    `| No evidence | ${q.recommendNoEvidence ?? 0} |`,
    `| Product-eligible Organizations | ${q.productEligibleOrganizationCount} |`,
    `| Returning/new classifications | ${q.returningNewClassificationsCreated} |`,
    `| Cross-round identities | ${q.crossRoundIdentitiesCreated} |`,
    ``,
    `> Recommendations are **not** confirmations. Organization product metrics remain blocked while confirmed count is 0.`,
    ``,
    `## Proposed steward APPROVE queue (recommendation=CONFIRM)`,
    ``,
  ];
  if (confirmRecs.length === 0) {
    lines.push(`_None._`, ``);
  } else {
    lines.push(
      `| Applicant | Candidate Organization | Apps | Contention | Evidence | Action |`,
      `| --- | --- | ---: | ---: | --- | --- |`,
    );
    for (const d of confirmRecs) {
      lines.push(
        `| ${d.applicantLegalName} | ${d.candidateCanonicalName ?? ""} (\`${d.candidateOrganizationKey ?? ""}\`) | ${d.observedApplicationCount} | ${d.officialContentionMemberships} | ${d.strongestEvidenceStrength ?? ""} | ${d.requiredStewardAction.replace(/\|/g, "/")} |`,
      );
    }
    lines.push(``);
  }
  lines.push(`## Top-impact researched dossiers`, ``);
  lines.push(
    `| Applicant | Apps | Contention | State | Recommendation | Candidate |`,
    `| --- | ---: | ---: | --- | --- | --- |`,
  );
  for (const d of dossiers.slice(0, 25)) {
    lines.push(
      `| ${d.applicantLegalName} | ${d.observedApplicationCount} | ${d.officialContentionMemberships} | ${d.resolutionState} | ${d.reviewRecommendation} | ${(d.candidateCanonicalName ?? "").replace(/\|/g, "/")} |`,
    );
  }
  lines.push(``, `## Top confirmed portfolios`, ``);
  if (topConfirmed.length === 0) {
    lines.push(`_None — no steward-approved CONFIRMED Organizations._`, ``);
  } else {
    lines.push(`| Organization | Applications | Applicant legal names |`, `| --- | ---: | --- |`);
    for (const org of topConfirmed) {
      lines.push(
        `| ${org.canonicalName} (\`${org.organizationKey}\`) | ${org.memberApplicationIds.length} | ${org.applicantLegalNames.join("; ")} |`,
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
