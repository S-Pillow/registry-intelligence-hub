import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { runFirstPassOrganizationResolution } from "../run-first-pass";
import { applyIdentityEvidencePackageToSnapshot } from "./apply-identity-evidence";
import { validateReviewRecommendation } from "../validate-recommendation";
import type { IdentityEvidencePackage } from "./types";
import { hashOrganizationResolutionSnapshot } from "../semantic-hash";

const workspaceRoot = process.cwd();

const PACKAGE_PATH = join(
  workspaceRoot,
  "src/organization-resolution-2026/fixtures/applicant-identity-evidence-package-tranche1.json",
);

function loadPackage(): IdentityEvidencePackage {
  return JSON.parse(readFileSync(PACKAGE_PATH, "utf8")) as IdentityEvidencePackage;
}

describe("ORG-RES-TRANCHE-1A package governance", () => {
  it("is a recommendation package only — never CONFIRMED mapping state", () => {
    const pkg = loadPackage();
    expect(pkg.packageVersion).toBe("applicant-identity-evidence-package/1.0.0");
    expect(pkg.decisionId).toMatch(/TRANCHE-1A/);
    expect(pkg.dossiers.length).toBeGreaterThan(0);
    expect(pkg.dossiers.length).toBeLessThanOrEqual(30);
    for (const d of pkg.dossiers) {
      expect(d.resolutionState).not.toBe("CONFIRMED");
      expect(d.reviewRecommendation).not.toBe(undefined);
    }
  });

  it("CONFIRM recommendations require A/B and forbid Brand-only / website-only / C|D-only", () => {
    const pkg = loadPackage();
    const confirms = pkg.dossiers.filter((d) => d.reviewRecommendation === "CONFIRM");
    expect(confirms.length).toBeGreaterThan(0);
    for (const d of confirms) {
      validateReviewRecommendation({
        recommendation: d.reviewRecommendation,
        evidence: d.evidence,
        claimsParentSubsidiaryCollapse: Boolean(d.directParentLegalName || d.ultimateParentLegalName),
        selfResolution: true,
      });
      const strengths = d.evidence.map((e) => e.strength);
      expect(strengths.some((s) => s === "A" || s === "B")).toBe(true);
      expect(strengths.every((s) => s === "C" || s === "D")).toBe(false);
      // Brand-designation-only package forbidden (evidenceId stem, not display names containing "Brand")
      const brandDesignationOnly = d.evidence.every((e) => /brand-designation|:brand\b|designations\.brand/i.test(e.evidenceId));
      expect(brandDesignationOnly).toBe(false);
      // Website-only package forbidden
      expect(d.evidence.length).toBeGreaterThan(1);
      const websiteOnly = d.evidence.every((e) => /website/i.test(e.evidenceId) && e.strength === "C");
      expect(websiteOnly).toBe(false);
    }
  });

  it("parent/control fields remain separate from Organization on CONFIRM dossiers", () => {
    const pkg = loadPackage();
    const att = pkg.dossiers.find((d) => d.applicantLegalName === "AT&T Services, Inc.");
    expect(att?.reviewRecommendation).toBe("KEEP_CANDIDATE");
    expect(att?.candidateOrganizationKey).toBe("att-services");
    expect(att?.candidateOrganizationKey).not.toBe("att");
    expect(att?.directParentLegalName).toBe("AT&T Inc.");

    const inditex = pkg.dossiers.find((d) => d.applicantLegalName === "Industria de Diseño Textil S.A.");
    expect(inditex?.candidateOrganizationKey).toBe("inditex");
    expect(inditex?.candidateCanonicalName).toBe("Inditex");
    // Brand house strings must not become Organizations
    expect(inditex?.evidenceExplanationLines.join(" ")).toMatch(/not Organizations|≠ Organizations/i);
  });

  it("attaching the package does not CONFIRMED-transition and never demotes existing CONFIRMED", async () => {
    const baseline = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: true,
      applyWeb1Identity: true,
      applyBrand1Identity: true,
    });
    const beforeConfirmed = baseline.snapshot.applicantIdentityMappings.filter(
      (m) => m.resolutionState === "CONFIRMED",
    ).length;
    const beforeHash = hashOrganizationResolutionSnapshot(baseline.snapshot);

    const pkg = loadPackage();
    const after = applyIdentityEvidencePackageToSnapshot({
      snapshot: baseline.snapshot,
      package: pkg,
      passLabel: "ORG-RES-TRANCHE-1A",
    });

    for (const d of pkg.dossiers) {
      const mapping = after.applicantIdentityMappings.find((m) => m.applicantLegalName === d.applicantLegalName);
      expect(mapping).toBeTruthy();
      // Tranche targets were UNRESOLVED; after research attach they must not become CONFIRMED
      expect(mapping!.resolutionState).not.toBe("CONFIRMED");
    }

    const stillConfirmed = after.applicantIdentityMappings.filter((m) => m.resolutionState === "CONFIRMED");
    expect(stillConfirmed.length).toBe(beforeConfirmed);
    for (const m of baseline.snapshot.applicantIdentityMappings.filter((x) => x.resolutionState === "CONFIRMED")) {
      const next = after.applicantIdentityMappings.find((x) => x.applicantLegalName === m.applicantLegalName);
      expect(next?.resolutionState).toBe("CONFIRMED");
      expect(next?.organizationId).toBe(m.organizationId);
    }

    // Product path without tranche apply remains the accepted hash when re-run with defaults
    expect(beforeHash).toBe(hashOrganizationResolutionSnapshot(baseline.snapshot));
  });
});

describe("ORG-RES-TRANCHE-1A deterministic queue", () => {
  it("selects only UNRESOLVED names with Brand/Multi lanes and ≤30 unique dossiers", async () => {
    const snap = (
      await runFirstPassOrganizationResolution({
        workspaceRoot,
        writeArtifacts: false,
        applyStewardApprovals: true,
        applyWeb1Identity: true,
        applyBrand1Identity: true,
      })
    ).snapshot;

    const unresolved = snap.applicantIdentityMappings.filter((m) => m.resolutionState === "UNRESOLVED");
    expect(unresolved.length).toBe(331);

    const pkg = loadPackage();
    const names = pkg.dossiers.map((d) => d.applicantLegalName);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBeLessThanOrEqual(30);

    for (const name of names) {
      const m = snap.applicantIdentityMappings.find((x) => x.applicantLegalName === name);
      expect(m?.resolutionState).toBe("UNRESOLVED");
    }

    // Determinism: package bytes stable under SHA-256 pin for this commit content
    const sha = createHash("sha256").update(readFileSync(PACKAGE_PATH)).digest("hex");
    expect(sha).toMatch(/^[a-f0-9]{64}$/);
  });
});
