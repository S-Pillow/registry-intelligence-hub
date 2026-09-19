import { crossRoundIdentityCliReport } from "../cross-round-identity/load-registry";
import type { ClaimActualityState } from "./claim-actuality";
import { buildComparisonUnlockReport } from "./comparison-unlock";
import { assertNoFixtureContaminationInRealBuild } from "./contamination";
import type { DryRunDiagnostics, Registry2026PublicationSnapshot } from "./types";
import { ORGANIZATION_RESOLUTION_METHOD } from "./types";
import type { SanityCheckReport } from "./sanity-checks";

export type RevealDayVerificationReport = {
  reportVersion: "reveal-day-verification/1.0.0";
  generatedAt: string;
  source: {
    snapshotId: string;
    snapshotContentHash: string;
    publicationKind: string;
    publishedAt: string;
    retrievedAt: string;
    sourceName: string;
    sourceUrl: string;
  };
  hashes: {
    snapshotContentHash: string;
  };
  recordCounts: DryRunDiagnostics["recordCounts"];
  normalization: DryRunDiagnostics["normalization"];
  validation: DryRunDiagnostics["validation"];
  unresolvedFields: string[];
  organizationResolution: {
    methodVersion: string;
    status: "not-promoted" | "rehearsal-fixture-only" | "steward-registry-required";
    crossRoundIdentityMethod: string;
    rehearsalLinkCount: number;
    claimsReal2026IdentityInFixtureLinks: boolean;
  };
  claimActuality: ClaimActualityState;
  eligibilityChanges: ReturnType<typeof buildComparisonUnlockReport>;
  uiMetricsNewlyUnlocked: string[];
  sanity: SanityCheckReport;
  lineage: Registry2026PublicationSnapshot["lineage"] | null;
};

export async function buildRevealDayVerificationReport(
  snapshot: Registry2026PublicationSnapshot,
  diagnostics: DryRunDiagnostics,
  claimState: ClaimActualityState,
  workspaceRoot: string,
  sanity: SanityCheckReport,
): Promise<RevealDayVerificationReport> {
  const contamination = assertNoFixtureContaminationInRealBuild(snapshot, "verify");
  if (!contamination.ok && snapshot.publicationKind === "immutable-publication") {
    throw new Error(contamination.message);
  }

  const identityReport = await crossRoundIdentityCliReport(workspaceRoot);
  const unlock = buildComparisonUnlockReport(claimState);

  return {
    reportVersion: "reveal-day-verification/1.0.0",
    generatedAt: new Date().toISOString(),
    source: {
      snapshotId: diagnostics.snapshotId,
      snapshotContentHash: diagnostics.snapshotContentHash,
      publicationKind: diagnostics.publicationKind,
      publishedAt: diagnostics.provenance.publishedAt,
      retrievedAt: diagnostics.provenance.retrievedAt,
      sourceName: diagnostics.provenance.sourceName,
      sourceUrl: diagnostics.provenance.sourceUrl,
    },
    hashes: {
      snapshotContentHash: diagnostics.snapshotContentHash,
    },
    recordCounts: diagnostics.recordCounts,
    normalization: diagnostics.normalization,
    validation: diagnostics.validation,
    unresolvedFields: diagnostics.normalization.unresolvedFields,
    organizationResolution: {
      methodVersion: ORGANIZATION_RESOLUTION_METHOD,
      status:
        snapshot.publicationKind === "rehearsal-for-pipeline-only"
          ? "rehearsal-fixture-only"
          : claimState.round2026ApplicationActuality === "REAL_SOURCE_READY"
            ? "steward-registry-required"
            : "not-promoted",
      crossRoundIdentityMethod: identityReport.methodVersion,
      rehearsalLinkCount: identityReport.links.length,
      claimsReal2026IdentityInFixtureLinks: identityReport.links.some((l) => l.claimsReal2026Identity),
    },
    claimActuality: claimState,
    eligibilityChanges: unlock,
    uiMetricsNewlyUnlocked: unlock.metrics
      .filter((m) => m.unlockStatus === "newly-eligible")
      .map((m) => m.metricId),
    sanity,
    lineage: snapshot.lineage ?? null,
  };
}
