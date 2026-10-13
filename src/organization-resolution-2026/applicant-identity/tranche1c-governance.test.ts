import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { runFirstPassOrganizationResolution } from "../run-first-pass";
import { applyIdentityEvidencePackageToSnapshot } from "./apply-identity-evidence";
import { validateReviewRecommendation } from "../validate-recommendation";
import { hashOrganizationResolutionSnapshot } from "../semantic-hash";
import type { IdentityEvidencePackage } from "./types";

const workspaceRoot = process.cwd();

const PACKAGE_PATH = join(
  workspaceRoot,
  "src/organization-resolution-2026/fixtures/applicant-identity-evidence-package-tranche1c.json",
);

const EXPECTED_HASH =
  "52aca2c47520e42da7773b546fff4996f307a677e2ec679546dc568d9a0b2ad8";

const SCOPE = [
  "Amazon Registry Services, Inc.",
  "AT&T Services, Inc.",
  "Taisho Pharmaceutical Co., Ltd.",
  "Corporation Service Company",
  "Registered Agents Inc",
  "Cam Connecting SARL",
  "ALIBABA INNOVATION PRIVATE LIMITED",
  "American Lebanese Syrian Associated Charities, Inc.",
  "NAME SPACE LLC",
  "TechEdge Limited",
] as const;

const ONE_B = [
  "Suffix Inc.",
  "Endpoint Domains, Inc.",
  "Public Interest Registry",
  "Dine Brands Global, Inc.",
  "Axon Enterprise, Inc.",
  "Canadian Imperial Bank of Commerce",
  "Epic systems corporation",
  "Industria de Diseño Textil S.A.",
  "Hostinger UAB",
] as const;

function loadPackage(): IdentityEvidencePackage {
  return JSON.parse(readFileSync(PACKAGE_PATH, "utf8")) as IdentityEvidencePackage;
}

describe("ORG-RES-TRANCHE-1C package governance", () => {
  it("covers exactly the ten scoped Applicants and never pre-confirms", () => {
    const pkg = loadPackage();
    expect(pkg.decisionId).toMatch(/TRANCHE-1C/);
    expect(pkg.dossiers).toHaveLength(10);
    expect(pkg.dossiers.map((d) => d.applicantLegalName).sort()).toEqual([...SCOPE].sort());
    for (const d of pkg.dossiers) {
      expect(d.resolutionState).not.toBe("CONFIRMED");
    }
  });

  it("CONFIRM recommendations require A/B and forbid website-only / C|D-only / Brand-only", () => {
    const pkg = loadPackage();
    const confirms = pkg.dossiers.filter((d) => d.reviewRecommendation === "CONFIRM");
    expect(confirms.length).toBe(7);
    for (const d of confirms) {
      const isGroupReuse = d.candidateOrganizationKey === "alibaba-group";
      validateReviewRecommendation({
        recommendation: d.reviewRecommendation,
        evidence: d.evidence,
        claimsParentSubsidiaryCollapse: isGroupReuse,
        selfResolution: !isGroupReuse,
      });
      expect(d.evidence.some((e) => e.strength === "A" || e.strength === "B")).toBe(true);
      expect(d.evidence.every((e) => e.strength === "C" || e.strength === "D")).toBe(false);
      const websiteOnly = d.evidence.every(
        (e) => /website/i.test(e.evidenceId) && (e.strength === "C" || e.strength === "D"),
      );
      expect(websiteOnly).toBe(false);
    }
  });

  it("keeps parents / St. Jude / Amazon.com / AT&T Inc. / Holdings out of Organization keys", () => {
    const pkg = loadPackage();
    const amazon = pkg.dossiers.find((d) => d.applicantLegalName === "Amazon Registry Services, Inc.")!;
    expect(amazon.candidateOrganizationKey).toBe("amazon-registry-services");
    expect(amazon.directParentLegalName).toBe("Amazon.com, Inc.");
    expect(amazon.candidateOrganizationKey).not.toBe("amazon");

    const att = pkg.dossiers.find((d) => d.applicantLegalName === "AT&T Services, Inc.")!;
    expect(att.candidateOrganizationKey).toBe("att-services");
    expect(att.directParentLegalName).toBe("AT&T Inc.");

    const taisho = pkg.dossiers.find((d) => d.applicantLegalName === "Taisho Pharmaceutical Co., Ltd.")!;
    expect(taisho.candidateOrganizationKey).toBe("taisho-pharmaceutical");
    expect(taisho.directParentLegalName).toBe("Taisho Pharmaceutical Holdings Co., Ltd.");

    const alsac = pkg.dossiers.find(
      (d) => d.applicantLegalName === "American Lebanese Syrian Associated Charities, Inc.",
    )!;
    expect(alsac.candidateOrganizationKey).toBe("alsac");
    expect(alsac.candidateCanonicalName).toBe("ALSAC");
    expect(alsac.candidateOrganizationKey).not.toMatch(/st-jude/);

    const alibaba = pkg.dossiers.find((d) => d.applicantLegalName === "ALIBABA INNOVATION PRIVATE LIMITED")!;
    expect(alibaba.candidateOrganizationKey).toBe("alibaba-group");
    expect(alibaba.ultimateControlLegalName).toBe("Alibaba Group Holding Limited");
  });

  it("attaching the package does not CONFIRMED-transition and preserves 1B + hash", async () => {
    const baseline = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: true,
      applyWeb1Identity: true,
      applyBrand1Identity: true,
      applyTranche1bIdentity: true,
    });
    expect(baseline.snapshot.quality.confirmedOrganizationMappings).toBe(154);
    expect(baseline.snapshot.quality.confirmedOrganizationCount).toBe(98);
    expect(baseline.snapshot.quality.candidateOrganizationMappings).toBe(2);
    expect(baseline.snapshot.quality.ambiguousMappings).toBe(2);
    expect(baseline.snapshot.quality.unresolvedApplicantLegalNames).toBe(322);
    expect(baseline.snapshot.semanticContentSha256).toBe(EXPECTED_HASH);

    for (const name of ONE_B) {
      const m = baseline.snapshot.applicantIdentityMappings.find((x) => x.applicantLegalName === name);
      expect(m?.resolutionState).toBe("CONFIRMED");
    }

    const pkg = loadPackage();
    const after = applyIdentityEvidencePackageToSnapshot({
      snapshot: baseline.snapshot,
      package: pkg,
      passLabel: "ORG-RES-TRANCHE-1C",
    });

    for (const d of pkg.dossiers) {
      const mapping = after.applicantIdentityMappings.find((m) => m.applicantLegalName === d.applicantLegalName);
      expect(mapping).toBeTruthy();
      expect(mapping!.resolutionState).not.toBe("CONFIRMED");
    }

    for (const name of ONE_B) {
      const prior = baseline.snapshot.applicantIdentityMappings.find((x) => x.applicantLegalName === name)!;
      const next = after.applicantIdentityMappings.find((x) => x.applicantLegalName === name)!;
      expect(next.resolutionState).toBe("CONFIRMED");
      expect(next.organizationId).toBe(prior.organizationId);
    }

    expect(after.applicantIdentityMappings.filter((m) => m.resolutionState === "CONFIRMED")).toHaveLength(154);
    expect(hashOrganizationResolutionSnapshot(baseline.snapshot)).toBe(EXPECTED_HASH);

    const sha = createHash("sha256").update(readFileSync(PACKAGE_PATH)).digest("hex");
    expect(sha).toMatch(/^[a-f0-9]{64}$/);
  });
});
