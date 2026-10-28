import type { HistoricalOrganizationLineageRegistry } from "../types";

const RETRIEVED = "2026-10-28";

/**
 * Steward-approved historical Organization lineage records.
 * Operator decision: RIH-HIST-ORG-LINEAGE-1 (GoDaddy Registry ↔ NeuStar registry business).
 * Does not authorize other candidate promotions.
 */
export const HISTORICAL_ORGANIZATION_LINEAGE_REGISTRY_1: HistoricalOrganizationLineageRegistry = {
  registryVersion: "historical-organization-lineage-registry/1.0.0",
  methodVersion: "historical-organization-lineage/1.0.0",
  records: [
    {
      lineageId: "hist-lineage:neustar-registry-business→godaddy-registry-services",
      historicalOrganizationId: "organization:promoted:neustar",
      historicalOrganizationKey: "neustar",
      historicalCanonicalName: "NeuStar, Inc.",
      historicalRoundYear: 2012,
      currentOrganizationId: "organization:resolved-2026:godaddy-registry-services",
      currentOrganizationKey: "godaddy-registry-services",
      currentCanonicalName: "GoDaddy (Registry Services, LLC)",
      relationshipType: "BUSINESS_LINE_SUCCESSION",
      effectiveDateOrYear: "2020-08",
      displayLabel: "Historical registry lineage: NeuStar, Inc. (2012)",
      displaySummary:
        "Registry operations of NeuStar Inc. were acquired by GoDaddy in August 2020. This is registry-business succession into today's GoDaddy Registry / Registry Services, LLC Organization — not a simple rename, and not identity with Go Daddy East, LLC.",
      aliases: [
        "Neustar",
        "NeuStar",
        "NeuStar, Inc.",
        "GoDaddy Registry",
        "Go Daddy Registry",
        "Registry Services, LLC",
        "GoDaddy Registry Services",
      ],
      evidence: [
        {
          evidenceId: "hl-ev-neustar-2012-csv",
          strength: "A",
          sourceType: "icann-2012-promotion",
          sourceIdentifier: "organization-promotion/1.0.0#org-prom-2012-neustar",
          title: "2012 Reveal Day — NeuStar, Inc. application 1-863-45071",
          evidenceAsOf: "2012-06-13",
          retrievedAt: RETRIEVED,
          summary:
            "Checked-in Reveal Day CSV preserves Applicant NeuStar, Inc. for String NEUSTAR (Application ID 1-863-45071).",
          supportsClaim: "Historical Organization identity is NeuStar, Inc. (organization:promoted:neustar)",
          limitations: "Single-application 2012 portfolio; does not describe later ownership changes",
        },
        {
          evidenceId: "hl-ev-godaddy-neustar-10q-2020",
          strength: "A",
          sourceType: "sec-filing",
          sourceIdentifier:
            "https://www.sec.gov/Archives/edgar/data/1609711/000160971120000145/R12.htm",
          title: "GoDaddy Inc. Form 10-Q business acquisitions note (period ended 2020-09-30)",
          evidenceAsOf: "2020-09-30",
          retrievedAt: RETRIEVED,
          summary:
            "GoDaddy completed the acquisition of the registry operations of Neustar Inc. in August 2020 for cash consideration, to expand domain registry offerings/capabilities.",
          supportsClaim:
            "Post-2012 registry-business acquisition/succession: NeuStar registry operations → GoDaddy registry business",
          limitations:
            "Describes acquisition of Neustar registry operations — not a wholesale legal rename of NeuStar, Inc. into GoDaddy Registry, and not all Neustar corporate activity",
        },
        {
          evidenceId: "hl-ev-godaddy-neustar-earnings-2020q2",
          strength: "A",
          sourceType: "first-party-corporate",
          sourceIdentifier:
            "https://aboutus.godaddy.net/newsroom/news-releases/press-release-details/2020/GoDaddy-Reports-Second-Quarter-2020-Earnings-Results/default.aspx",
          title: "GoDaddy Q2 2020 earnings — Neustar registry acquisition completed",
          evidenceAsOf: "2020-08-05",
          retrievedAt: RETRIEVED,
          summary:
            "GoDaddy first-party earnings release states completion of the previously announced acquisition of the registry business of Neustar Inc. for $215.9 million in cash.",
          supportsClaim: "Closing of Neustar registry-business acquisition in August 2020",
          limitations: "Corporate earnings narrative; scope limited to registry business",
        },
        {
          evidenceId: "hl-ev-godaddy-2026-org",
          strength: "A",
          sourceType: "steward-note",
          sourceIdentifier: "organization-resolution-2026#godaddy-registry-services",
          title: "Existing canonical 2026 GoDaddy Registry Organization",
          evidenceAsOf: "2026-10-07",
          retrievedAt: RETRIEVED,
          summary:
            "RIH already resolves Registry Services, LLC under organization:resolved-2026:godaddy-registry-services (canonical label GoDaddy (Registry Services, LLC)).",
          supportsClaim: "Current Organization end of the lineage reuses the existing canonical GoDaddy Registry identity",
          limitations: "Does not rewrite 2012 Applicant records or merge Go Daddy East, LLC",
        },
      ],
      stewardState: "steward-approved",
      confidence: "high",
      scopeNotes:
        "Links historical NeuStar, Inc. (2012) to current GoDaddy Registry / Registry Services, LLC via registry-business acquisition/succession (August 2020). Distinct Organizations remain; relationship is BUSINESS_LINE_SUCCESSION.",
      nonClaims: [
        "NeuStar, Inc. did not simply rename itself GoDaddy Registry",
        "Not all of Neustar became GoDaddy",
        "Go Daddy East, LLC is a separate 2012 Applicant and is not part of this lineage",
        "This lineage is not SAME_ORGANIZATION returning identity and does not replace GoDaddy ↔ Uniregistry ACQUIRED_AFTER_2012 rejection",
        "Does not imply selected RSP relationship",
      ],
    },
  ],
};
