import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import { contentHash } from "@/normalization/hashes";
import type { Registry2026PublicationSnapshot } from "@/reveal-day-2026/types";
import { REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION } from "@/reveal-day-2026/browser-payload-types";
import type { Application, HistoricalContext } from "@/lib/registry-data";
import type { RegistryApplicationsDocument } from "@/lib/registry-applications-document";

export * from "@/lib/registry-application-payload-shared";

export function snapshotContentHashForPublication(snapshot: Registry2026PublicationSnapshot): string {
  return contentHash({
    snapshotId: snapshot.snapshotId,
    applications: snapshot.applications,
  });
}

/** Immutable browser document from a validated 2026 publication snapshot (server/CLI). */
export function buildBrowserApplicationPayloadFromPublication(
  snapshot: Registry2026PublicationSnapshot,
): RegistryApplicationsDocument {
  const snapshotContentHash = snapshotContentHashForPublication(snapshot);
  const applications = snapshot.applications.map((row) => ({
    id: row.id,
    string: row.string,
    ...(row.aLabel ? { aLabel: row.aLabel } : {}),
    applicant: row.applicant,
    organization: row.organization,
    country: row.country,
    region: row.region,
    category: row.category,
    type: row.type,
    returning: row.returning,
    idn: row.idn,
    replacement: row.replacement,
    contentionSet: row.contentionSet,
    confidence: row.confidence,
  })) as Application[];

  const nowIso = new Date().toISOString();

  return {
    payloadVersion: REGISTRY_BROWSER_APPLICATION_PAYLOAD_VERSION,
    payloadMode: "promoted-2026",
    fixtureId: snapshot.fixtureId,
    snapshotId: snapshot.snapshotId,
    snapshotContentHash,
    publicationSchemaVersion: snapshot.schemaVersion,
    baselineAt: snapshot.publishedAt,
    retrievedAt: snapshot.retrievedAt,
    checkedAt: nowIso,
    changedAt: snapshot.publishedAt,
    parserVersion: snapshot.parserVersion,
    methodVersion: "round-pulse/1.0.0",
    sourceHealth: {
      status: "healthy",
      recordsCovered: applications.length,
      recordsTotal: applications.length,
      requiredFieldsCovered: applications.length * 12,
      requiredFieldsTotal: applications.length * 12,
      gaps: [
        {
          status: "not-public",
          source: "Organization stewardship review",
          detail: "Organization relationships are not steward-approved for 2026 portfolio intelligence.",
          affected: "Organization confidence and portfolio grouping",
        },
        {
          status: "not-public",
          source: "Historical market demand",
          detail: "No approved public or licensed source is registered for current demand measures.",
          affected: "Market Opportunity Map",
        },
      ],
    },
    historicalContext: {
      comparisonLabel: `Approved ${APPROVED_2012_BASELINE.bundleId} baseline (offline-verified aggregates)`,
      applications: APPROVED_2012_BASELINE.applications,
      uniqueStrings: APPROVED_2012_BASELINE.uniqueStrings,
      organizations: APPROVED_2012_BASELINE.distinctCountries,
      idnApplications: APPROVED_2012_BASELINE.idnApplications,
      contentionSets: APPROVED_2012_BASELINE.extractedContentionSetEntities,
      categoryCounts: {} as HistoricalContext["categoryCounts"],
    },
    source: {
      name: snapshot.source.name,
      url: snapshot.source.url,
      evidenceClass: snapshot.source.evidenceClass,
    },
    limitations: [
      ...snapshot.limitations,
      "Promoted 2026 application rows — organization, portfolio, and returning-identity metrics remain gated per eligibility catalog.",
      "Rehearsal cohort is not merged with promoted rows; UI uses one payload mode at a time.",
    ],
    applications,
  };
}
