import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runFirstPassOrganizationResolution } from "../run-first-pass";
import { hashOrganizationResolutionSnapshot } from "../semantic-hash";
import type { IdentityEvidencePackage } from "./types";
import {
  TRANCHE1C_IDENTITY_EVIDENCE_PACKAGE,
  TRANCHE1D_APPROVED_TRANSITIONS,
  TRANCHE1D_EXPECTED_AMBIGUOUS_MAPPINGS,
  TRANCHE1D_EXPECTED_CANDIDATE_MAPPINGS,
  TRANCHE1D_EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES,
  TRANCHE1D_EXPECTED_CONFIRMED_APPLICATIONS,
  TRANCHE1D_EXPECTED_CONFIRMED_BRAND_APPLICATIONS,
  TRANCHE1D_EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS,
  TRANCHE1D_EXPECTED_CONFIRMED_ORGANIZATIONS,
  TRANCHE1D_EXPECTED_UNRESOLVED_APPLICANT_LEGAL_NAMES,
  TRANCHE1D_EXPECTED_UNRESOLVED_APPLICATIONS,
  TRANCHE1D_EXPECTED_UNRESOLVED_BRAND_APPLICATIONS,
  TRANCHE1D_EXPECT_POST_SEMANTIC_HASH,
  TRANCHE1D_EXPECT_PRE_SEMANTIC_HASH,
  TRANCHE1D_NON_APPROVED_KEEP,
  TRANCHE1D_STEWARD_DECISION_ID,
  tranche1dNewOrganizationKeys,
  tranche1dReuseOrganizationKeys,
} from "./steward-decision-tranche1d";

const workspaceRoot = process.cwd();

const PACKAGE_PATH = join(
  workspaceRoot,
  "src/organization-resolution-2026/fixtures/applicant-identity-evidence-package-tranche1c.json",
);

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

describe("ORG-RES-TRANCHE-1D approval exactness", () => {
  it("approves exactly seven CONFIRM dossiers with exact Applicant → Organization mappings", async () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_PATH, "utf8")) as IdentityEvidencePackage;
    expect(pkg).toEqual(TRANCHE1C_IDENTITY_EVIDENCE_PACKAGE);
    expect(TRANCHE1D_APPROVED_TRANSITIONS.length).toBe(7);

    const pre = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: true,
      applyWeb1Identity: true,
      applyBrand1Identity: true,
      applyTranche1bIdentity: true,
      applyTranche1dIdentity: false,
    });
    expect(pre.snapshot.semanticContentSha256).toBe(TRANCHE1D_EXPECT_PRE_SEMANTIC_HASH);
    expect(pre.snapshot.quality.confirmedOrganizationMappings).toBe(154);
    expect(pre.snapshot.quality.confirmedOrganizationCount).toBe(98);

    const priorConfirmed = new Map(
      pre.snapshot.applicantIdentityMappings
        .filter((m) => m.resolutionState === "CONFIRMED")
        .map((m) => [m.applicantLegalName, m.organizationId]),
    );
    const priorConfirmedKeys = new Set(
      pre.snapshot.organizations.filter((o) => o.status === "CONFIRMED").map((o) => o.organizationKey),
    );
    for (const key of tranche1dNewOrganizationKeys()) {
      expect(priorConfirmedKeys.has(key)).toBe(false);
    }
    for (const key of tranche1dReuseOrganizationKeys()) {
      expect(priorConfirmedKeys.has(key)).toBe(true);
    }

    const alibabaBefore = pre.snapshot.organizations.find((o) => o.organizationKey === "alibaba-group")!;
    expect(alibabaBefore.status).toBe("CONFIRMED");
    const alibabaApplicantCountBefore = alibabaBefore.applicantLegalNames.length;
    const alibabaAppsBefore = alibabaBefore.memberApplicationIds.length;

    const { snapshot } = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: true,
      applyWeb1Identity: true,
      applyBrand1Identity: true,
      applyTranche1bIdentity: true,
      applyTranche1dIdentity: true,
    });

    expect(snapshot.tranche1dStewardDecisionProvenance?.decisionId).toBe(TRANCHE1D_STEWARD_DECISION_ID);
    expect(snapshot.tranche1dStewardDecisionProvenance?.authority).toBe("operator-product-steward");
    expect(snapshot.tranche1dStewardDecisionProvenance?.approvedApplicantLegalNames).toHaveLength(7);
    expect(snapshot.tranche1dStewardDecisionProvenance?.sourceEvidencePackageCommit).toBe(
      "1de5f3d2bdd605e76b4acd0ab9f91479edd35397",
    );

    const byName = new Map(pkg.dossiers.map((d) => [d.applicantLegalName, d]));
    for (const t of TRANCHE1D_APPROVED_TRANSITIONS) {
      const dossier = byName.get(t.applicantLegalName);
      expect(dossier).toBeTruthy();
      expect(dossier!.reviewRecommendation).toBe("CONFIRM");
      expect(dossier!.candidateOrganizationKey).toBe(t.organizationKey);
      expect(dossier!.candidateCanonicalName).toBe(t.canonicalName);
      expect(dossier!.resolutionState).not.toBe("CONFIRMED");

      const mapping = snapshot.applicantIdentityMappings.find(
        (m) => m.applicantLegalName === t.applicantLegalName,
      );
      expect(mapping?.resolutionState).toBe("CONFIRMED");
      expect(mapping?.organizationId).toBe(`organization:resolved-2026:${t.organizationKey}`);
      const org = snapshot.organizations.find((o) => o.organizationId === mapping?.organizationId);
      expect(org?.canonicalName).toBe(t.canonicalName);
      expect(org?.organizationKey).toBe(t.organizationKey);
      expect(org?.status).toBe("CONFIRMED");
      expect(org?.applicantLegalNames).toContain(t.applicantLegalName);
    }

    for (const name of TRANCHE1D_NON_APPROVED_KEEP) {
      const m = snapshot.applicantIdentityMappings.find((x) => x.applicantLegalName === name);
      expect(m?.resolutionState).not.toBe("CONFIRMED");
      const d = byName.get(name);
      expect(d).toBeTruthy();
      expect(d!.reviewRecommendation).toBe("KEEP_CANDIDATE");
    }

    for (const [name, orgId] of priorConfirmed) {
      const next = snapshot.applicantIdentityMappings.find((m) => m.applicantLegalName === name);
      expect(next?.resolutionState).toBe("CONFIRMED");
      expect(next?.organizationId).toBe(orgId);
    }

    for (const name of ONE_B) {
      const m = snapshot.applicantIdentityMappings.find((x) => x.applicantLegalName === name);
      expect(m?.resolutionState).toBe("CONFIRMED");
      expect(m?.organizationId).toBe(priorConfirmed.get(name));
    }

    const alibabaAfter = snapshot.organizations.find((o) => o.organizationKey === "alibaba-group")!;
    expect(alibabaAfter.status).toBe("CONFIRMED");
    expect(alibabaAfter.applicantLegalNames).toContain("ALIBABA INNOVATION PRIVATE LIMITED");
    expect(alibabaAfter.applicantLegalNames.length).toBe(alibabaApplicantCountBefore + 1);
    expect(alibabaAfter.memberApplicationIds.length).toBeGreaterThan(alibabaAppsBefore);
    expect(
      snapshot.organizations.filter((o) => /alibaba/i.test(o.organizationKey) && o.status === "CONFIRMED"),
    ).toHaveLength(1);

    // Parent / relationship safety — Organization keys must not be parents
    expect(
      snapshot.organizations.some((o) => o.organizationKey === "amazon" && o.status === "CONFIRMED"),
    ).toBe(false);
    expect(snapshot.organizations.some((o) => o.organizationKey === "att-inc")).toBe(false);
    expect(snapshot.organizations.some((o) => o.organizationKey === "st-jude")).toBe(false);
    const amazon = snapshot.organizations.find((o) => o.organizationKey === "amazon-registry-services")!;
    expect(amazon.canonicalName).toBe("Amazon Registry Services");
    const alsac = snapshot.organizations.find((o) => o.organizationKey === "alsac")!;
    expect(alsac.canonicalName).toBe("ALSAC");

    // Immutable 1C research package bytes unchanged by approval implementation
    const onDisk = JSON.parse(readFileSync(PACKAGE_PATH, "utf8")) as IdentityEvidencePackage;
    expect(onDisk.decisionId).toMatch(/TRANCHE-1C/);
    expect(onDisk.dossiers.every((d) => (d.resolutionState as string) !== "CONFIRMED")).toBe(true);
    expect(onDisk.dossiers.filter((d) => d.reviewRecommendation === "CONFIRM")).toHaveLength(7);
  });
});

describe("ORG-RES-TRANCHE-1D coverage + semantics", () => {
  it("derives expected confirmed coverage and preserves publications / safety gates", async () => {
    const a = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: true,
      applyWeb1Identity: true,
      applyBrand1Identity: true,
      applyTranche1bIdentity: true,
      applyTranche1dIdentity: true,
    });
    const b = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: true,
      applyWeb1Identity: true,
      applyBrand1Identity: true,
      applyTranche1bIdentity: true,
      applyTranche1dIdentity: true,
    });

    const { snapshot } = a;
    expect(snapshot.quality.confirmedOrganizationMappings).toBe(
      TRANCHE1D_EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES,
    );
    expect(snapshot.quality.confirmedOrganizationCount).toBe(TRANCHE1D_EXPECTED_CONFIRMED_ORGANIZATIONS);
    expect(snapshot.quality.unresolvedApplicantLegalNames).toBe(
      TRANCHE1D_EXPECTED_UNRESOLVED_APPLICANT_LEGAL_NAMES,
    );
    expect(snapshot.quality.candidateOrganizationMappings).toBe(TRANCHE1D_EXPECTED_CANDIDATE_MAPPINGS);
    expect(snapshot.quality.ambiguousMappings).toBe(TRANCHE1D_EXPECTED_AMBIGUOUS_MAPPINGS);
    expect(snapshot.quality.applicationsCoveredByConfirmedOrganizations).toBe(
      TRANCHE1D_EXPECTED_CONFIRMED_APPLICATIONS,
    );
    expect(snapshot.quality.confirmedContentionMemberships).toBe(
      TRANCHE1D_EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS,
    );
    expect(snapshot.quality.officialContentionMemberships).toBe(891);

    const publication = JSON.parse(
      readFileSync(
        join(workspaceRoot, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json"),
        "utf8",
      ),
    ) as {
      applications: Array<{ applicationId: string; applicant: string; designations?: { brand?: boolean } }>;
      quality?: { officialApplicationCount?: number; officialApplicantCount?: number };
    };
    expect(publication.applications).toHaveLength(1614);

    const contention = JSON.parse(
      readFileSync(
        join(workspaceRoot, ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json"),
        "utf8",
      ),
    ) as { contentionSets: Array<{ officialContentionSetId: string; members: Array<{ applicationId: string }> }> };
    expect(contention.contentionSets).toHaveLength(263);
    expect(contention.contentionSets.reduce((n, s) => n + s.members.length, 0)).toBe(891);

    const appById = new Map(publication.applications.map((app) => [app.applicationId, app]));
    let confirmedBrand = 0;
    let unresolvedApps = 0;
    let unresolvedBrand = 0;
    const confirmedNames = new Set(
      snapshot.applicantIdentityMappings
        .filter((m) => m.resolutionState === "CONFIRMED")
        .map((m) => m.applicantLegalName),
    );
    const confirmedSetIds = new Set<string>();
    for (const set of contention.contentionSets) {
      let hit = false;
      for (const member of set.members) {
        const app = appById.get(member.applicationId);
        if (app && confirmedNames.has(app.applicant)) hit = true;
      }
      if (hit) confirmedSetIds.add(set.officialContentionSetId);
    }
    for (const m of snapshot.applicantIdentityMappings) {
      for (const id of m.applicationIds) {
        const app = appById.get(id);
        const isBrand = Boolean(app?.designations?.brand);
        if (m.resolutionState === "CONFIRMED" && isBrand) confirmedBrand += 1;
        if (m.resolutionState === "UNRESOLVED") {
          unresolvedApps += 1;
          if (isBrand) unresolvedBrand += 1;
        }
      }
    }
    expect(confirmedBrand).toBe(TRANCHE1D_EXPECTED_CONFIRMED_BRAND_APPLICATIONS);
    expect(unresolvedApps).toBe(TRANCHE1D_EXPECTED_UNRESOLVED_APPLICATIONS);
    expect(unresolvedBrand).toBe(TRANCHE1D_EXPECTED_UNRESOLVED_BRAND_APPLICATIONS);
    expect(confirmedSetIds.size).toBe(256);

    expect(snapshot.semanticContentSha256).not.toBe(TRANCHE1D_EXPECT_PRE_SEMANTIC_HASH);
    expect(snapshot.semanticContentSha256).toBe(TRANCHE1D_EXPECT_POST_SEMANTIC_HASH);
    expect(b.snapshot.semanticContentSha256).toBe(snapshot.semanticContentSha256);
    expect(hashOrganizationResolutionSnapshot(snapshot)).toBe(snapshot.semanticContentSha256);

    expect(snapshot.limitations.some((l) => /Confirmed Organizations are a resolved subset only/i.test(l))).toBe(
      true,
    );
    expect(snapshot.tranche1dStewardDecisionProvenance?.notes).toMatch(/KEEP_CANDIDATE/);
    expect(snapshot.tranche1dStewardDecisionProvenance?.notes).toMatch(/alibaba-group/);
    expect(snapshot.tranche1dStewardDecisionProvenance?.notes).not.toMatch(
      /selected.?RSP|category taxonomy|returning/i,
    );

    for (const t of TRANCHE1D_APPROVED_TRANSITIONS) {
      expect(
        snapshot.applicantIdentityMappings.some((m) => m.applicantLegalName === t.applicantLegalName),
      ).toBe(true);
    }
  });
});
