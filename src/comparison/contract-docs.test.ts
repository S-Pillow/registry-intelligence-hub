import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  getProjectDocsRootForContractTests,
  PROJECT_STORE_DOC_TEST_NAME,
  projectDocPath,
  shouldSkipProjectStoreDocContractTests,
} from "@/test/project-store-docs";

const skipDocs = shouldSkipProjectStoreDocContractTests();

describe("comparison eligibility contracts (project docs)", () => {
  it.skipIf(skipDocs)(`${PROJECT_STORE_DOC_TEST_NAME} documents two-axis eligibility and claimsReal2026Identity on the baseline contract`, async () => {
    const root = getProjectDocsRootForContractTests();
    const baseline = await readFile(projectDocPath(root, "2012-comparison-baseline-contract.md"), "utf8");
    expect(baseline).toContain("claimsReal2026Identity");
    expect(baseline).toContain("REAL_SOURCE_READY");
    expect(baseline).toContain("NOT_PUBLISHED");
    expect(baseline).toMatch(/Cross-round delta/i);
  });

  it.skipIf(skipDocs)(`${PROJECT_STORE_DOC_TEST_NAME} splits identity-only returning metrics from post-Reveal BLOCKED_SOURCE metrics`, async () => {
    const root = getProjectDocsRootForContractTests();
    const baseline = await readFile(projectDocPath(root, "2012-comparison-baseline-contract.md"), "utf8");
    expect(baseline).toContain("cross-round-identity/1.0.0");
    expect(baseline).toContain("Returning participant");
    expect(baseline).toContain("BLOCKED_SOURCE");
    expect(baseline).toContain("Returning successful applicant");
    expect(baseline).toMatch(/identity match only/i);
  });

  it.skipIf(skipDocs)(`${PROJECT_STORE_DOC_TEST_NAME} documents 2026 organization resolution before publication`, async () => {
    const root = getProjectDocsRootForContractTests();
    const resolution = await readFile(projectDocPath(root, "2026-organization-resolution-contract.md"), "utf8");
    expect(resolution).toContain("CONFIRMED");
    expect(resolution).toContain("AMBIGUOUS");
    expect(resolution.toLowerCase()).toContain("no silent merges");
    expect(resolution).toContain("cross-round-identity/1.0.0");
  });

  it.skipIf(skipDocs)(`${PROJECT_STORE_DOC_TEST_NAME} documents 2026 reveal-day ingestion gates and contamination rule`, async () => {
    const root = getProjectDocsRootForContractTests();
    const ingestion = await readFile(projectDocPath(root, "2026-reveal-day-ingestion.md"), "utf8");
    expect(ingestion).toContain("registry-2026-parser/1.0.0");
    expect(ingestion).toContain("rehearsal-for-pipeline-only");
    expect(ingestion).toContain("verify-reveal-day");
    expect(ingestion).toMatch(/organization-resolution-2026\/1\.0\.0/);
  });
});
