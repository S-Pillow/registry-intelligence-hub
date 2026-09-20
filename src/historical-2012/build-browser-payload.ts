import { APPROVED_2012_BASELINE, APPROVED_2012_BASELINE_BUNDLE } from "@/comparison/approved-2012-baseline";
import { contentHash } from "@/normalization/hashes";
import { loadFixtureBundle } from "@/normalization/load-bundle";
import type { RevealDayCsvRow } from "@/normalization/parse-reveal-csv";
import { PARSER_VERSION } from "@/normalization/types";
import type { Application } from "@/lib/registry-data";
import {
  REGISTRY_2012_BROWSER_PAYLOAD_GENERATED_AT,
  REGISTRY_2012_BROWSER_SNAPSHOT_ID,
  REGISTRY_BROWSER_2012_APPLICATION_PAYLOAD_VERSION,
} from "@/historical-2012/browser-payload-types";
import type { Registry2012ApplicationsDocument } from "@/historical-2012/browser-payload-document";

function applicationTypeFromRow(row: RevealDayCsvRow): Application["type"] {
  const community = row.preservedColumns["Community?"]?.trim().toUpperCase();
  const geographic = row.preservedColumns["Geographic?"]?.trim().toUpperCase();
  if (community === "Y" || community === "YES") return "Community";
  if (geographic === "Y" || geographic === "YES") return "Geographic";
  return "Generic";
}

function rowToBrowserApplication(
  row: RevealDayCsvRow,
  contentionSetId: string | undefined,
): Application {
  const region = row.preservedColumns.Region?.trim() || "Unknown region";
  const country = row.applicantJurisdiction?.trim() || "—";
  return {
    id: row.applicationId,
    string: row.stringUlabel,
    ...(row.stringAlabel ? { aLabel: row.stringAlabel } : {}),
    applicant: row.applicantLegalName,
    organization: row.applicantLegalName,
    country,
    region,
    category: "Unclassified",
    type: applicationTypeFromRow(row),
    returning: false,
    idn: row.isIdn,
    replacement: null,
    contentionSet: contentionSetId ?? null,
    confidence: 1,
  } as Application;
}

type CorpusRecord = {
  id: string;
  string: string;
  aLabel?: string;
  applicant: string;
  country: string;
  region: string;
  type: Application["type"];
  idn: boolean;
  contentionSet: string | null;
};

function canonicalCorpusRecords(applications: Application[]): CorpusRecord[] {
  return applications.map((app) => ({
    id: app.id,
    string: app.string,
    ...(app.aLabel ? { aLabel: app.aLabel } : {}),
    applicant: app.applicant,
    country: app.country,
    region: app.region,
    type: app.type,
    idn: app.idn,
    contentionSet: app.contentionSet,
  }));
}

export async function buildRegistry2012BrowserPayload(
  workspaceRoot: string,
): Promise<Registry2012ApplicationsDocument> {
  const bundle = await loadFixtureBundle(APPROVED_2012_BASELINE_BUNDLE, workspaceRoot);
  const rows = bundle.applicationLinesPrimary
    .map((line) => line.parsed as unknown as RevealDayCsvRow)
    .sort((a, b) => a.applicationId.localeCompare(b.applicationId, "en"));

  if (rows.length !== APPROVED_2012_BASELINE.applications) {
    throw new Error(
      `Expected ${APPROVED_2012_BASELINE.applications} applications, got ${rows.length}`,
    );
  }

  const applications = rows.map((row) =>
    rowToBrowserApplication(row, bundle.contentionMembershipByApplicationId.get(row.applicationId)),
  );

  const corpusContentHash = contentHash({
    payloadVersion: REGISTRY_BROWSER_2012_APPLICATION_PAYLOAD_VERSION,
    roundProgramYear: 2012,
    snapshotId: REGISTRY_2012_BROWSER_SNAPSHOT_ID,
    inputContentHash: bundle.inputContentHash,
    records: canonicalCorpusRecords(applications),
  });

  const csvSnapshot = bundle.rawSnapshots.find((s) => s.snapshotId === "snap-2012-reveal-day-csv-v1");
  if (!csvSnapshot?.provenance?.contentSha256) {
    throw new Error("Missing CSV snapshot provenance for 2012 browser payload");
  }

  const baselineAt = APPROVED_2012_BASELINE.baselineAt;

  return {
    payloadVersion: REGISTRY_BROWSER_2012_APPLICATION_PAYLOAD_VERSION,
    payloadMode: "historical-2012",
    roundProgramYear: 2012,
    fixtureId: APPROVED_2012_BASELINE_BUNDLE,
    snapshotId: REGISTRY_2012_BROWSER_SNAPSHOT_ID,
    corpusContentHash,
    provenance: {
      normalizationBundleId: APPROVED_2012_BASELINE_BUNDLE,
      normalizationBundleVersion: bundle.definition.version,
      inputContentHash: bundle.inputContentHash,
      csvSnapshotId: csvSnapshot.snapshotId,
      csvContentSha256: csvSnapshot.provenance.contentSha256,
      roundProgramYear: 2012,
      applicationIdStrategy: "icann-application-id",
    },
    baselineAt,
    retrievedAt: csvSnapshot.retrievedAt,
    checkedAt: REGISTRY_2012_BROWSER_PAYLOAD_GENERATED_AT,
    changedAt: baselineAt,
    parserVersion: PARSER_VERSION,
    methodVersion: "historical-2012-browser/1.0.0",
    source: {
      name: "ICANN 2012 Reveal Day application strings export (CSV)",
      url: csvSnapshot.provenance.originalIcannUrl,
      evidenceClass: "historical-archive-preserved",
    },
    limitations: [
      "Historical 2012 Reveal Day entity slice — not merged with 2026 rehearsal or promoted 2026 payloads.",
      "Applicant legal name is shown for browse grouping; steward organization resolution and portfolio metrics remain gated.",
      "Category is Unclassified for all rows — taxonomy coverage is partial offline only.",
      "Returning-applicant participation is a 2026 concept; all 2012 rows are historical Reveal Day submissions.",
      "Compare cross-round and portfolio intelligence remain deferred (Ticket D1 Explore-only).",
    ],
    applications,
  };
}
