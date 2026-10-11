import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runFirstPassOrganizationResolution } from "../run-first-pass";
import { applyIdentityEvidencePackageToSnapshot } from "./apply-identity-evidence";
import { BRAND1_IDENTITY_EVIDENCE_PACKAGE, BRAND1_STEWARD_DECISION_ID } from "./steward-decision-brand1";
import { extractIdentityFieldsFromResponses, extractOrganizationWebsite } from "./aps-detail";
import type { ApsApplicationSummary } from "./aps-detail";
import type { IdentityEvidencePackage } from "./types";

const workspaceRoot = process.cwd();

describe("ORG-RES-BRAND-1 evidence thresholds", () => {
  it("does not confirm from Brand-only or Website-only evidence packages", async () => {
    const pre = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: true,
      applyWeb1Identity: true,
      applyBrand1Identity: false,
    });
    const brandOnly: IdentityEvidencePackage = {
      packageVersion: "applicant-identity-evidence-package/1.0.0",
      methodNote: "test brand-only",
      researchedAt: "2026-10-12",
      decisionId: "TEST-BRAND-ONLY",
      dossiers: [
        {
          applicantLegalName: "Suffix Inc.",
          representativeApplicationId: "TEST",
          candidateOrganizationKey: "suffix-brand-test",
          candidateCanonicalName: "Suffix Brand Test",
          resolutionState: "CANDIDATE",
          reviewRecommendation: "KEEP_CANDIDATE",
          recommendationReason: "Brand-only discovery",
          requiredStewardAction: "Do not confirm",
          temporalNote: "test",
          applicantWebsiteHost: null,
          applicantWebsiteUrl: null,
          directParentLegalName: null,
          ultimateParentLegalName: null,
          ultimateControlLegalName: null,
          evidenceExplanationLines: ["Brand designation only"],
          evidence: [
            {
              evidenceId: "ev-test-brand-only",
              strength: "C",
              sourceType: "aps-publication",
              sourceIdentifier: "test://brand",
              title: "APS Brand designation",
              asOf: "2026-10-07",
              retrievedAt: "2026-10-12",
              summary: "Brand only",
              supportsClaim: "Brand discovery signal",
              temporalRelevance: "test",
              limitations: "Brand alone never confirms",
            },
          ],
        },
      ],
    };
    const after = applyIdentityEvidencePackageToSnapshot({
      snapshot: pre.snapshot,
      package: brandOnly,
      passLabel: "ORG-RES-BRAND-1",
    });
    const mapping = after.applicantIdentityMappings.find((m) => m.applicantLegalName === "Suffix Inc.");
    expect(mapping?.resolutionState).not.toBe("CONFIRMED");
  });

  it("keeps explicit parent fields separate from Organization for self-identity dossiers", () => {
    const converse = BRAND1_IDENTITY_EVIDENCE_PACKAGE.dossiers.find(
      (d) => d.applicantLegalName === "Converse Inc.",
    );
    expect(converse).toBeTruthy();
    expect(converse!.candidateCanonicalName).toBe("Converse");
    expect(converse!.directParentLegalName).toBe("NIKE, Inc.");
    expect(converse!.ultimateParentLegalName).toBe("NIKE, Inc.");
    expect(converse!.candidateOrganizationKey).not.toBe("nike");
  });

  it("does not treat product strings as Organizations in Salesforce dossier", () => {
    const sf = BRAND1_IDENTITY_EVIDENCE_PACKAGE.dossiers.find(
      (d) => d.applicantLegalName === "Salesforce, Inc.",
    )!;
    expect(sf.candidateCanonicalName).toBe("Salesforce");
    expect(sf.candidateOrganizationKey).toBe("salesforce");
    const joined = sf.evidenceExplanationLines.join(" ");
    expect(joined).toMatch(/slack/);
    expect(joined).toMatch(/tableau/);
    expect(sf.candidateCanonicalName).not.toBe("Slack");
    expect(sf.candidateCanonicalName).not.toBe("Tableau");
  });
});

describe("ORG-RES-BRAND-1 Salesforce + governance", () => {
  it("confirms Salesforce self-identity from first-party fixtures and steward batch", async () => {
    const summary = JSON.parse(
      readFileSync(
        join(workspaceRoot, "src/organization-resolution-2026/fixtures/aps-detail/CRM2628T-T54007.summary.json"),
        "utf8",
      ),
    ) as ApsApplicationSummary;
    expect(extractOrganizationWebsite(summary)).toBe("https://www.salesforce.com");

    const responses = JSON.parse(
      readFileSync(
        join(
          workspaceRoot,
          "src/organization-resolution-2026/fixtures/aps-detail/CRM2628T-T54007.responses.json",
        ),
        "utf8",
      ),
    );
    const fields = extractIdentityFieldsFromResponses("CRM2628T-T54007", responses);
    expect(fields.fields.Q10?.responseText).toBe("https://www.salesforce.com");
    expect(fields.fields.Q19?.responseText).toMatch(/salesforce\.com/);

    const { snapshot } = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyWeb1Identity: true,
      applyBrand1Identity: true,
    });

    const sf = snapshot.applicantIdentityMappings.find(
      (m) => m.applicantLegalName === "Salesforce, Inc.",
    );
    expect(sf?.resolutionState).toBe("CONFIRMED");
    expect(sf?.organizationId).toBe("organization:resolved-2026:salesforce");
    expect(sf?.identityContext?.applicantWebsiteHost).toBe("salesforce.com");
    const org = snapshot.organizations.find((o) => o.organizationId === sf?.organizationId);
    expect(org?.canonicalName).toBe("Salesforce");
    expect(org?.status).toBe("CONFIRMED");
    expect(snapshot.brand1StewardDecisionProvenance?.decisionId).toBe(BRAND1_STEWARD_DECISION_ID);

    // Product strings remain Applications under Salesforce, Inc. — no Slack/Tableau orgs
    expect(snapshot.organizations.some((o) => o.organizationKey === "slack")).toBe(false);
    expect(snapshot.organizations.some((o) => o.organizationKey === "tableau")).toBe(false);
    expect(sf?.applicationIds.length).toBe(4);
  });

  it("confirms second ranked Brand self-identity (Anthropic) and preserves WEB-1 families", async () => {
    const { snapshot } = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyWeb1Identity: true,
      applyBrand1Identity: true,
    });
    const anthropic = snapshot.applicantIdentityMappings.find(
      (m) => m.applicantLegalName === "Anthropic, PBC",
    );
    expect(anthropic?.resolutionState).toBe("CONFIRMED");
    expect(anthropic?.organizationId).toBe("organization:resolved-2026:anthropic");
    expect(anthropic?.identityContext?.applicantWebsiteHost).toBe("anthropic.com");

    const id = snapshot.organizations.find((o) => o.organizationKey === "identity-digital");
    expect(id?.status).toBe("CONFIRMED");
    expect(id?.applicantLegalNames.length).toBe(28);
    const namecheap = snapshot.organizations.find((o) => o.organizationKey === "namecheap");
    expect(namecheap?.applicantLegalNames.length).toBe(20);
    const redRock = snapshot.organizations.find((o) => o.organizationKey === "red-rock");
    expect(redRock?.applicantLegalNames.length).toBe(8);
    const xserver = snapshot.organizations.find((o) => o.organizationKey === "xserver");
    expect(xserver?.applicantLegalNames.length).toBe(3);
    const alibaba = snapshot.organizations.find((o) => o.organizationKey === "alibaba-group");
    expect(alibaba?.applicantLegalNames.length).toBe(2);

    for (const name of ["Japan Business Systems, Inc.", "Japan Tobacco Inc."]) {
      const m = snapshot.applicantIdentityMappings.find((x) => x.applicantLegalName === name);
      expect(m?.resolutionState).not.toBe("CONFIRMED");
    }

    expect(snapshot.quality.confirmedOrganizationMappings).toBe(145);
    expect(snapshot.quality.confirmedOrganizationCount).toBe(89);
    expect(snapshot.quality.officialContentionMemberships).toBe(891);
  });

  it("flags existing Confirmed conflict without automatic change", async () => {
    const pre = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyWeb1Identity: true,
      applyBrand1Identity: false,
    });
    const conflictPkg: IdentityEvidencePackage = {
      packageVersion: "applicant-identity-evidence-package/1.0.0",
      methodNote: "conflict test",
      researchedAt: "2026-10-12",
      decisionId: "TEST-CONFIRMED-CONFLICT",
      dossiers: [
        {
          applicantLegalName: "Hair Apparent, LLC",
          representativeApplicationId: "SS2654T-T11896",
          candidateOrganizationKey: "not-identity-digital",
          candidateCanonicalName: "Not Identity Digital",
          resolutionState: "AMBIGUOUS",
          reviewRecommendation: "MARK_AMBIGUOUS",
          recommendationReason: "Simulated Confirmed conflict",
          requiredStewardAction: "Review CONFIRMED_MAPPING_CONFLICT",
          temporalNote: "test",
          applicantWebsiteHost: "identity.digital",
          applicantWebsiteUrl: "https://identity.digital",
          directParentLegalName: null,
          ultimateParentLegalName: null,
          ultimateControlLegalName: null,
          evidenceExplanationLines: ["conflict"],
          evidence: [
            {
              evidenceId: "ev-test-conflict",
              strength: "B",
              sourceType: "icann-public-summary",
              sourceIdentifier: "test://conflict",
              title: "Conflict probe",
              asOf: "2026-10-07",
              retrievedAt: "2026-10-12",
              summary: "Conflict",
              supportsClaim: "Conflict",
              temporalRelevance: "test",
              limitations: "test",
            },
          ],
        },
      ],
    };
    const after = applyIdentityEvidencePackageToSnapshot({
      snapshot: pre.snapshot,
      package: conflictPkg,
      passLabel: "ORG-RES-BRAND-1",
    });
    const hair = after.applicantIdentityMappings.find((m) => m.applicantLegalName === "Hair Apparent, LLC");
    expect(hair?.resolutionState).toBe("CONFIRMED");
    expect(hair?.organizationId).toBe("organization:resolved-2026:identity-digital");
    expect(hair?.ambiguityNotes).toMatch(/CONFIRMED_MAPPING_CONFLICT/);
  });
});
