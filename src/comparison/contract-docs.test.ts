import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectDocsRoot = "/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/docs";

describe("comparison eligibility contracts (project docs)", () => {
  it("documents two-axis eligibility and claimsReal2026Identity on the baseline contract", async () => {
    const baseline = await readFile(join(projectDocsRoot, "2012-comparison-baseline-contract.md"), "utf8");
    expect(baseline).toContain("claimsReal2026Identity");
    expect(baseline).toContain("REAL_SOURCE_READY");
    expect(baseline).toContain("NOT_PUBLISHED");
    expect(baseline).toMatch(/Cross-round delta/i);
  });

  it("splits identity-only returning metrics from post-Reveal BLOCKED_SOURCE metrics", async () => {
    const baseline = await readFile(join(projectDocsRoot, "2012-comparison-baseline-contract.md"), "utf8");
    expect(baseline).toContain("cross-round-identity/1.0.0");
    expect(baseline).toContain("Returning participant");
    expect(baseline).toContain("BLOCKED_SOURCE");
    expect(baseline).toContain("Returning successful applicant");
    expect(baseline).toMatch(/identity match only/i);
  });

  it("documents 2026 organization resolution before publication", async () => {
    const resolution = await readFile(join(projectDocsRoot, "2026-organization-resolution-contract.md"), "utf8");
    expect(resolution).toContain("CONFIRMED");
    expect(resolution).toContain("AMBIGUOUS");
    expect(resolution.toLowerCase()).toContain("no silent merges");
    expect(resolution).toContain("cross-round-identity/1.0.0");
  });

  it("documents 2026 reveal-day ingestion gates and contamination rule", async () => {
    const ingestion = await readFile(join(projectDocsRoot, "2026-reveal-day-ingestion.md"), "utf8");
    expect(ingestion).toContain("registry-2026-parser/1.0.0");
    expect(ingestion).toContain("rehearsal-for-pipeline-only");
    expect(ingestion).toContain("verify-reveal-day");
    expect(ingestion).toMatch(/organization-resolution-2026\/1\.0\.0/);
  });
});
