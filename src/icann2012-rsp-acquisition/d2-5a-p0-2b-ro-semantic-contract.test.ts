import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getProjectDocsRootForContractTests,
  PROJECT_STORE_DOC_TEST_NAME,
  projectDocPath,
  shouldSkipProjectStoreDocContractTests,
} from "@/test/project-store-docs";
import {
  APPLICANT_RO_TRANSITION_ANCHOR,
  IANA_TLD_MANAGER_RECONCILIATION_ANCHOR,
  MAPPING_APPROVE_ROUND_WIDE_REJECTION,
  PARTIAL_MAPPING_PILOT_ALTERNATE_PATH_ANCHOR,
  RO_DEFINITION_ANCHOR,
  RO_EVIDENCE_TIER_1_ANCHOR,
  RO_RSP_CONTRACT_REVISION,
  RO_RSP_RELATIONSHIP_CONTRACT_DOC,
  RSP_VS_RO_ANCHOR,
  TLD_GRAPH_ROOT_ANCHOR,
} from "./ro-rsp-relationship-contract-anchors";
import { validateMappingApprovalPacket, RSP_MAPPING_REVIEW_SCHEMA_VERSION } from "./mapping-review-approval";
import type { MappingReviewReport } from "./mapping-review";

const skipDocs = shouldSkipProjectStoreDocContractTests();
const workspaceRoot = process.cwd();

describe("D2.5A-P0.2B RO/RSP relationship contract (project docs)", () => {
  it.skipIf(skipDocs)(
    `${PROJECT_STORE_DOC_TEST_NAME} registry-operator contract defines RO, RSP, DNS, IANA, and time semantics`,
    async () => {
      const root = getProjectDocsRootForContractTests();
      const contract = await readFile(
        projectDocPath(root, RO_RSP_RELATIONSHIP_CONTRACT_DOC),
        "utf8",
      );

      expect(contract).toContain(RO_RSP_CONTRACT_REVISION);
      expect(contract).toContain(RO_DEFINITION_ANCHOR);
      expect(contract).toContain(RSP_VS_RO_ANCHOR);
      expect(contract).toContain(IANA_TLD_MANAGER_RECONCILIATION_ANCHOR);
      expect(contract).toContain(TLD_GRAPH_ROOT_ANCHOR);
      expect(contract).toContain(APPLICANT_RO_TRANSITION_ANCHOR);
      expect(contract).toContain(RO_EVIDENCE_TIER_1_ANCHOR);
      expect(contract).toContain("IANA Root Zone Database");
      expect(contract).toContain(PARTIAL_MAPPING_PILOT_ALTERNATE_PATH_ANCHOR);
      expect(contract).toMatch(/Back-End Registry Operator/i);
      expect(contract).toMatch(/separate typed facts/i);
    },
  );

  it("mapping-review runbook documents PARTIAL_MAPPING pilot alternate path", async () => {
    const runbook = await readFile(
      join(workspaceRoot, "scripts/acquire-icann2012-rsp-portions.md"),
      "utf8",
    );
    expect(runbook).toContain("PARTIAL_MAPPING");
    expect(runbook).toContain("pilotOnlyExactCandidate");
    expect(runbook).toContain(PARTIAL_MAPPING_PILOT_ALTERNATE_PATH_ANCHOR);
    expect(runbook).toContain(RO_RSP_RELATIONSHIP_CONTRACT_DOC);
  });

  it("approval validation copy matches contract-linked ROUND_WIDE_EXACT anchor", () => {
    const report = {
      runId: "partial",
      mappingArtifactSha256: "d".repeat(64),
      mappingReviewPass: true,
      reviewHold: false,
      integrityFailures: [],
      roundWideExact: false,
      pilotOnlyExactCandidate: true,
    } as unknown as MappingReviewReport;

    const result = validateMappingApprovalPacket(report, {
      reviewVersion: RSP_MAPPING_REVIEW_SCHEMA_VERSION,
      mappingArtifactSha256: "d".repeat(64),
      runId: "partial",
      reviewer: "steward@test",
      reviewedAt: "2026-09-22T00:00:00.000Z",
      decision: "APPROVE",
    });

    expect(result.errors).toContain(MAPPING_APPROVE_ROUND_WIDE_REJECTION);
  });
});
