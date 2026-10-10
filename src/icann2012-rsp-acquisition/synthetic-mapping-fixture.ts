import type { Registry2012RspMappingArtifact, RspMappingEntry } from "./types";

const PLACEHOLDER_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

/** Generates unmistakable TEST_ONLY round-wide synthetic rows (never production-eligible). */
export function buildSyntheticRoundWideMappingFixture(
  applicationIds: string[],
): Registry2012RspMappingArtifact {
  const entries: RspMappingEntry[] = applicationIds.map((applicationId, index) => ({
    applicationId,
    gtldresultAcId: 900_000 + index,
    mappingSourceClass: "SYNTHETIC_TEST",
    evidenceSnapshotId: "snap-synthetic-not-real",
    sourceUrl: "https://example.invalid/synthetic-rsp-mapping-fixture",
    evidenceContentSha256: PLACEHOLDER_HASH,
    notes: "SYNTHETIC_TEST_FIXTURE — not approved evidence",
  }));

  return {
    mappingVersion: "registry-2012-rsp-mapping/1.0.0",
    artifactPurpose: "TEST_ONLY",
    approvalState: "DRAFT",
    bundleId: "icann2012-rsp-public-portions-v1",
    scope: "round-wide-synthetic-exact",
    entries,
  };
}
