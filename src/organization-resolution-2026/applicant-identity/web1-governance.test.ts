import { describe, expect, it } from "vitest";
import { runFirstPassOrganizationResolution } from "../run-first-pass";
import { applyIdentityEvidencePackageToSnapshot } from "./apply-identity-evidence";
import { WEB1_IDENTITY_EVIDENCE_PACKAGE } from "./steward-decision-web1";
import type { IdentityEvidencePackage } from "./types";

const workspaceRoot = process.cwd();

describe("ORG-RES-WEB-1 organization governance", () => {
  it("confirms Hair Apparent · Identity Digital with parent/control preserved separately", async () => {
    const { snapshot } = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyWeb1Identity: true,
    });
    const hair = snapshot.applicantIdentityMappings.find(
      (m) => m.applicantLegalName === "Hair Apparent, LLC",
    );
    expect(hair?.resolutionState).toBe("CONFIRMED");
    expect(hair?.organizationId).toBe("organization:resolved-2026:identity-digital");
    expect(hair?.identityContext?.applicantWebsiteHost).toBe("identity.digital");
    expect(hair?.identityContext?.directParentLegalName).toBe("Slow Rider, LLC");
    expect(hair?.identityContext?.ultimateParentLegalName).toBe(
      "Ethos Capital Digital Infrastructure UGP LLC",
    );
    expect(hair?.identityContext?.ultimateControlLegalName).toBe(
      "Ethos Capital Digital Infrastructure UGP LLC",
    );
    const org = snapshot.organizations.find((o) => o.organizationId === hair?.organizationId);
    expect(org?.canonicalName).toBe("Identity Digital");
    expect(org?.status).toBe("CONFIRMED");
  });

  it("does not auto-confirm from website-only evidence", async () => {
    const pre = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: true,
      applyWeb1Identity: false,
    });
    const websiteOnly: IdentityEvidencePackage = {
      packageVersion: "applicant-identity-evidence-package/1.0.0",
      methodNote: "test website-only",
      researchedAt: "2026-10-12",
      decisionId: "TEST-WEBSITE-ONLY",
      dossiers: [
        {
          applicantLegalName: "Suffix Inc.",
          representativeApplicationId: "TEST",
          candidateOrganizationKey: "suffix-test",
          candidateCanonicalName: "Suffix Test Org",
          resolutionState: "CANDIDATE",
          reviewRecommendation: "KEEP_CANDIDATE",
          recommendationReason: "Website-only discovery",
          requiredStewardAction: "Do not confirm",
          temporalNote: "test",
          applicantWebsiteHost: "suffix.example",
          applicantWebsiteUrl: "https://suffix.example",
          directParentLegalName: null,
          ultimateParentLegalName: null,
          ultimateControlLegalName: null,
          evidenceExplanationLines: ["Applicant Website: suffix.example"],
          evidence: [
            {
              evidenceId: "ev-test-website-only",
              strength: "C",
              sourceType: "icann-public-summary",
              sourceIdentifier: "test://website",
              title: "APS Applicant Website",
              asOf: "2026-10-07",
              retrievedAt: "2026-10-12",
              summary: "Website only",
              supportsClaim: "Website discovery signal",
              temporalRelevance: "test",
              limitations: "Website alone never confirms",
            },
          ],
        },
      ],
    };
    const next = applyIdentityEvidencePackageToSnapshot({
      snapshot: pre.snapshot,
      package: websiteOnly,
    });
    const row = next.applicantIdentityMappings.find((m) => m.applicantLegalName === "Suffix Inc.");
    expect(row?.resolutionState).toBe("CANDIDATE");
    expect(row?.resolutionState).not.toBe("CONFIRMED");
  });

  it("flags jt.com shared-website conflict as AMBIGUOUS without confirming", async () => {
    const { snapshot } = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyWeb1Identity: true,
    });
    for (const name of ["Japan Business Systems, Inc.", "Japan Tobacco Inc."]) {
      const m = snapshot.applicantIdentityMappings.find((x) => x.applicantLegalName === name);
      expect(m?.resolutionState).toBe("AMBIGUOUS");
      expect(m?.organizationId).toBeNull();
    }
  });

  it("reuses canonical Organization identities across Identity Digital Applicants", async () => {
    const { snapshot } = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyWeb1Identity: true,
    });
    const idNames = WEB1_IDENTITY_EVIDENCE_PACKAGE.dossiers
      .filter((d) => d.candidateOrganizationKey === "identity-digital")
      .map((d) => d.applicantLegalName);
    expect(idNames.length).toBe(28);
    const orgIds = new Set(
      idNames.map(
        (n) => snapshot.applicantIdentityMappings.find((m) => m.applicantLegalName === n)?.organizationId,
      ),
    );
    expect(orgIds).toEqual(new Set(["organization:resolved-2026:identity-digital"]));
  });

  it("preserves prior unrelated Confirmed mappings (ALL14)", async () => {
    const { snapshot } = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyWeb1Identity: true,
    });
    const msft = snapshot.applicantIdentityMappings.find(
      (m) => m.applicantLegalName === "Microsoft Corporation",
    );
    expect(msft?.resolutionState).toBe("CONFIRMED");
    expect(msft?.organizationId).toBe("organization:resolved-2026:hist-2012-microsoft");
    expect(snapshot.quality.confirmedOrganizationCount).toBe(19);
    expect(snapshot.quality.confirmedOrganizationMappings).toBe(75);
  });

  it("Affiliate is never rewritten as ownership in explanation lines", () => {
    const hair = WEB1_IDENTITY_EVIDENCE_PACKAGE.dossiers.find(
      (d) => d.applicantLegalName === "Hair Apparent, LLC",
    )!;
    const blob = hair.evidenceExplanationLines.join(" ");
    expect(blob).toMatch(/Affiliate disclosure/i);
    expect(blob).not.toMatch(/wholly owned subsidiary of Identity Digital/i);
    expect(hair.directParentLegalName).toBe("Slow Rider, LLC");
  });
});
