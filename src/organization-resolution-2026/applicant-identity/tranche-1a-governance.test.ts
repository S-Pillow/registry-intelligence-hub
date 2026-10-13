import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { runFirstPassOrganizationResolution } from "../run-first-pass";
import { applyIdentityEvidencePackageToSnapshot } from "./apply-identity-evidence";
import { validateReviewRecommendation } from "../validate-recommendation";
import { selectOrgResTranche1aQueue } from "./tranche-1a-queue";
import type { IdentityEvidencePackage } from "./types";

const workspaceRoot = process.cwd();
const pkgPath = join(
  workspaceRoot,
  "src/organization-resolution-2026/fixtures/applicant-identity-evidence-package-tranche1a.json",
);
const queuePath = join(
  workspaceRoot,
  "src/organization-resolution-2026/fixtures/org-res-tranche-1a-queue.json",
);

function loadPackage(): IdentityEvidencePackage {
  return JSON.parse(readFileSync(pkgPath, "utf8")) as IdentityEvidencePackage;
}

describe("ORG-RES-TRANCHE-1A queue + evidence package", () => {
  it("selects a deterministic Brand ∪ multi-Application UNRESOLVED queue (≤30)", () => {
    const committed = JSON.parse(readFileSync(queuePath, "utf8")) as {
      dossiers: Array<{ applicantLegalName: string; lanes: string[] }>;
    };
    expect(committed.dossiers.length).toBeGreaterThan(0);
    expect(committed.dossiers.length).toBeLessThanOrEqual(30);

    const prodSnap = join(
      "/root/registry_hub/.data/reveal-2026/organization-resolution/organization-resolution-1.0.0.snapshot.json",
    );
    const prodBrowser = join(
      "/root/registry_hub/.data/reveal-2026/browser/applications-browser-v2.json",
    );
    const prodCont = join(
      "/root/registry_hub/.data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json",
    );
    if (!existsSync(prodSnap) || !existsSync(prodBrowser) || !existsSync(prodCont)) {
      // Fixture-only environments still enforce committed queue shape.
      expect(committed.dossiers.every((d) => d.lanes.length > 0)).toBe(true);
      return;
    }

    const snap = JSON.parse(readFileSync(prodSnap, "utf8")) as {
      applicantIdentityMappings: Array<{
        applicantLegalName: string;
        resolutionState: string;
        applicationIds: string[];
      }>;
      semanticContentSha256: string;
    };
    expect(snap.semanticContentSha256).toBe(
      "4837173224fc89ae617de3620396950e18c8da99a5333459a8782e032ce3bb87",
    );

    const browser = JSON.parse(readFileSync(prodBrowser, "utf8")) as {
      applications: Array<{ applicationId: string; designations?: { brand?: boolean } }>;
    };
    const cont = JSON.parse(readFileSync(prodCont, "utf8")) as {
      contentionSets: Array<{
        officialContentionSetId: string;
        members: Array<{ applicationId: string }>;
      }>;
    };

    const brandByApplicationId = new Map(
      browser.applications.map((a) => [a.applicationId, Boolean(a.designations?.brand)]),
    );
    const contentionSetByApplicationId = new Map<string, string>();
    for (const set of cont.contentionSets) {
      for (const m of set.members) {
        contentionSetByApplicationId.set(m.applicationId, set.officialContentionSetId);
      }
    }

    const selected = selectOrgResTranche1aQueue({
      unresolvedMappings: snap.applicantIdentityMappings,
      brandByApplicationId,
      contentionSetByApplicationId,
    });

    expect(selected.brandLane).toHaveLength(15);
    expect(selected.multiLane).toHaveLength(15);
    expect(selected.union.length).toBeLessThanOrEqual(30);
    expect(selected.overlap).toEqual([
      "Amazon Registry Services, Inc.",
      "Industria de Diseño Textil S.A.",
      "ML 35 LLC",
    ]);

    const committedNames = committed.dossiers.map((d) => d.applicantLegalName);
    expect(committedNames).toEqual(selected.union.map((r) => r.applicantLegalName));

    for (const name of committedNames) {
      const mapping = snap.applicantIdentityMappings.find((m) => m.applicantLegalName === name);
      expect(mapping?.resolutionState).toBe("UNRESOLVED");
    }
  });

  it("keeps every dossier non-CONFIRMED and CONFIRM recommendations A/B-backed", () => {
    const pkg = loadPackage();
    expect(pkg.stewardApprovalGranted).toBe(false);
    expect(pkg.productEligibleConfirmedMappings).toBe(0);

    for (const d of pkg.dossiers) {
      expect(d.resolutionState).not.toBe("CONFIRMED");
      validateReviewRecommendation({
        recommendation: d.reviewRecommendation,
        evidence: d.evidence,
        claimsParentSubsidiaryCollapse: Boolean(
          d.directParentLegalName || d.ultimateParentLegalName,
        ),
        selfResolution: d.candidateOrganizationKey != null && !d.directParentLegalName,
      });

      if (d.reviewRecommendation === "CONFIRM") {
        expect(d.evidence.some((e) => e.strength === "A" || e.strength === "B")).toBe(true);
        expect(d.evidence.every((e) => e.strength === "C" || e.strength === "D")).toBe(false);
        // Brand-only / website-only forbidden
        const nonCorroboration = d.evidence.filter(
          (e) =>
            !(
              e.strength === "C" &&
              (/website/i.test(e.title) ||
                /brand designation/i.test(e.title) ||
                e.sourceType === "aps-publication")
            ),
        );
        expect(nonCorroboration.some((e) => e.strength === "A" || e.strength === "B")).toBe(true);
      }
    }
  });

  it("does not make recommendations product-eligible without steward approval", async () => {
    const pkg = loadPackage();
    const pre = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: true,
      applyWeb1Identity: true,
      applyBrand1Identity: true,
    });

    const before = new Map(
      pre.snapshot.applicantIdentityMappings.map((m) => [m.applicantLegalName, m.resolutionState]),
    );
    const protectedConfirmed = [...before.entries()].filter(([, s]) => s === "CONFIRMED");

    const after = applyIdentityEvidencePackageToSnapshot({
      snapshot: pre.snapshot,
      package: pkg,
      passLabel: "ORG-RES-TRANCHE-1A",
    });

    for (const [name, state] of protectedConfirmed) {
      const next = after.applicantIdentityMappings.find((m) => m.applicantLegalName === name);
      expect(next?.resolutionState).toBe("CONFIRMED");
    }

    for (const d of pkg.dossiers) {
      const mapping = after.applicantIdentityMappings.find(
        (m) => m.applicantLegalName === d.applicantLegalName,
      );
      expect(mapping?.resolutionState).not.toBe("CONFIRMED");
    }
  });

  it("does not alter the protected product Organization semantic hash artifact", () => {
    const prodSnap = join(
      "/root/registry_hub/.data/reveal-2026/organization-resolution/organization-resolution-1.0.0.snapshot.json",
    );
    if (!existsSync(prodSnap)) return;
    const bytes = readFileSync(prodSnap);
    const hash = createHash("sha256").update(bytes).digest("hex");
    // File bytes may include non-semantic fields; pin the embedded semantic hash field.
    const snap = JSON.parse(bytes.toString("utf8")) as { semanticContentSha256: string };
    expect(snap.semanticContentSha256).toBe(
      "4837173224fc89ae617de3620396950e18c8da99a5333459a8782e032ce3bb87",
    );
    expect(hash.length).toBe(64);
  });

  it("does not recommend CONFIRM from Brand-only or website-only synthetic packages", () => {
    const brandOnly: IdentityEvidencePackage = {
      packageVersion: "applicant-identity-evidence-package/1.0.0",
      methodNote: "test",
      researchedAt: "2026-10-13",
      decisionId: "TEST",
      dossiers: [
        {
          applicantLegalName: "Suffix Inc.",
          representativeApplicationId: "TEST",
          candidateOrganizationKey: "suffix-test",
          candidateCanonicalName: "Suffix Test",
          resolutionState: "CANDIDATE",
          reviewRecommendation: "CONFIRM",
          recommendationReason: "invalid brand-only",
          requiredStewardAction: "reject",
          temporalNote: "test",
          applicantWebsiteHost: null,
          applicantWebsiteUrl: null,
          directParentLegalName: null,
          ultimateParentLegalName: null,
          ultimateControlLegalName: null,
          evidenceExplanationLines: ["Brand only"],
          evidence: [
            {
              evidenceId: "ev-brand-only",
              strength: "C",
              sourceType: "aps-publication",
              sourceIdentifier: "test://brand",
              title: "APS Brand designation",
              asOf: "2026-10-07",
              retrievedAt: "2026-10-13",
              summary: "Brand only",
              supportsClaim: "Brand",
              temporalRelevance: "test",
              limitations: "Brand alone never confirms",
            },
          ],
        },
      ],
    };
    expect(() =>
      validateReviewRecommendation({
        recommendation: "CONFIRM",
        evidence: brandOnly.dossiers[0]!.evidence,
        claimsParentSubsidiaryCollapse: false,
        selfResolution: true,
      }),
    ).toThrow(/A or B|C\/D/i);
  });
});
