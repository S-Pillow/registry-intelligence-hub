import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runFirstPassOrganizationResolution } from "../run-first-pass";
import { hashOrganizationResolutionSnapshot } from "../semantic-hash";
import type { IdentityEvidencePackage } from "./types";
import {
  TRANCHE1B_APPROVED_TRANSITIONS,
  TRANCHE1B_EXPECTED_AMBIGUOUS_MAPPINGS,
  TRANCHE1B_EXPECTED_CANDIDATE_MAPPINGS,
  TRANCHE1B_EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES,
  TRANCHE1B_EXPECTED_CONFIRMED_APPLICATIONS,
  TRANCHE1B_EXPECTED_CONFIRMED_BRAND_APPLICATIONS,
  TRANCHE1B_EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS,
  TRANCHE1B_EXPECTED_CONFIRMED_ORGANIZATIONS,
  TRANCHE1B_EXPECTED_UNRESOLVED_APPLICANT_LEGAL_NAMES,
  TRANCHE1B_EXPECTED_UNRESOLVED_APPLICATIONS,
  TRANCHE1B_EXPECTED_UNRESOLVED_BRAND_APPLICATIONS,
  TRANCHE1B_EXPECT_PRE_SEMANTIC_HASH,
  TRANCHE1B_STEWARD_DECISION_ID,
  TRANCHE1_IDENTITY_EVIDENCE_PACKAGE,
  tranche1bApprovedOrganizationKeys,
} from "./steward-decision-tranche1b";

const workspaceRoot = process.cwd();

const PACKAGE_PATH = join(
  workspaceRoot,
  "src/organization-resolution-2026/fixtures/applicant-identity-evidence-package-tranche1.json",
);

const NON_APPROVED_KEEP = [
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
  "Innovation Service Limited",
  "Internet DotTrademark Organisation Limited",
] as const;

const NON_APPROVED_AMBIGUOUS = [
  "CareCredit LLC",
  "ML 35 LLC",
  "Beijing Zitiao Network Technology Co., Ltd.",
  "Douyin Vision Co., Ltd.",
] as const;

const NON_APPROVED_NO_EVIDENCE = ["NextGEN TLDs GmbH", "NETDREAM PTE. LTD."] as const;

describe("ORG-RES-TRANCHE-1B approval exactness", () => {
  it("approves exactly nine CONFIRM dossiers with exact Applicant → Organization mappings", async () => {
    const pkg = JSON.parse(readFileSync(PACKAGE_PATH, "utf8")) as IdentityEvidencePackage;
    expect(pkg).toEqual(TRANCHE1_IDENTITY_EVIDENCE_PACKAGE);
    expect(TRANCHE1B_APPROVED_TRANSITIONS.length).toBe(9);

    const pre = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: true,
      applyWeb1Identity: true,
      applyBrand1Identity: true,
      applyTranche1bIdentity: false,
    });
    expect(pre.snapshot.semanticContentSha256).toBe(TRANCHE1B_EXPECT_PRE_SEMANTIC_HASH);
    const priorConfirmed = new Map(
      pre.snapshot.applicantIdentityMappings
        .filter((m) => m.resolutionState === "CONFIRMED")
        .map((m) => [m.applicantLegalName, m.organizationId]),
    );
    const priorConfirmedKeys = new Set(
      pre.snapshot.organizations.filter((o) => o.status === "CONFIRMED").map((o) => o.organizationKey),
    );
    for (const key of tranche1bApprovedOrganizationKeys()) {
      expect(priorConfirmedKeys.has(key)).toBe(false);
    }

    const { snapshot } = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: true,
      applyWeb1Identity: true,
      applyBrand1Identity: true,
      applyTranche1bIdentity: true,
    });

    expect(snapshot.tranche1bStewardDecisionProvenance?.decisionId).toBe(TRANCHE1B_STEWARD_DECISION_ID);
    expect(snapshot.tranche1bStewardDecisionProvenance?.authority).toBe("operator-product-steward");
    expect(snapshot.tranche1bStewardDecisionProvenance?.approvedApplicantLegalNames).toHaveLength(9);

    const byName = new Map(pkg.dossiers.map((d) => [d.applicantLegalName, d]));
    for (const t of TRANCHE1B_APPROVED_TRANSITIONS) {
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
      expect(org?.applicantLegalNames).toEqual([t.applicantLegalName]);
    }

    for (const name of [...NON_APPROVED_KEEP, ...NON_APPROVED_AMBIGUOUS, ...NON_APPROVED_NO_EVIDENCE]) {
      const m = snapshot.applicantIdentityMappings.find((x) => x.applicantLegalName === name);
      expect(m?.resolutionState).not.toBe("CONFIRMED");
      const d = byName.get(name);
      expect(d).toBeTruthy();
      expect(d!.reviewRecommendation).not.toBe("CONFIRM");
    }

    for (const [name, orgId] of priorConfirmed) {
      const next = snapshot.applicantIdentityMappings.find((m) => m.applicantLegalName === name);
      expect(next?.resolutionState).toBe("CONFIRMED");
      expect(next?.organizationId).toBe(orgId);
    }

    // Immutable 1A research package bytes unchanged by approval implementation
    const onDisk = readFileSync(PACKAGE_PATH, "utf8");
    expect(JSON.parse(onDisk).decisionId).toMatch(/TRANCHE-1A/);
    expect(JSON.parse(onDisk).dossiers.every((d: { resolutionState: string }) => d.resolutionState !== "CONFIRMED")).toBe(
      true,
    );
  });
});

describe("ORG-RES-TRANCHE-1B coverage + semantics", () => {
  it("derives expected confirmed coverage and preserves publications / safety gates", async () => {
    const a = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: true,
      applyWeb1Identity: true,
      applyBrand1Identity: true,
      applyTranche1bIdentity: true,
    });
    const b = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyStewardApprovals: true,
      applyWeb1Identity: true,
      applyBrand1Identity: true,
      applyTranche1bIdentity: true,
    });

    const { snapshot } = a;
    expect(snapshot.quality.confirmedOrganizationMappings).toBe(
      TRANCHE1B_EXPECTED_CONFIRMED_APPLICANT_LEGAL_NAMES,
    );
    expect(snapshot.quality.confirmedOrganizationCount).toBe(TRANCHE1B_EXPECTED_CONFIRMED_ORGANIZATIONS);
    expect(snapshot.quality.unresolvedApplicantLegalNames).toBe(
      TRANCHE1B_EXPECTED_UNRESOLVED_APPLICANT_LEGAL_NAMES,
    );
    expect(snapshot.quality.candidateOrganizationMappings).toBe(TRANCHE1B_EXPECTED_CANDIDATE_MAPPINGS);
    expect(snapshot.quality.ambiguousMappings).toBe(TRANCHE1B_EXPECTED_AMBIGUOUS_MAPPINGS);
    expect(snapshot.quality.applicationsCoveredByConfirmedOrganizations).toBe(
      TRANCHE1B_EXPECTED_CONFIRMED_APPLICATIONS,
    );
    expect(snapshot.quality.confirmedContentionMemberships).toBe(
      TRANCHE1B_EXPECTED_CONFIRMED_CONTENTION_MEMBERSHIPS,
    );
    expect(snapshot.quality.officialContentionMemberships).toBe(891);

    // Re-derive Brand / unresolved Application residuals from publication + mappings
    const publication = JSON.parse(
      readFileSync(
        join(workspaceRoot, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json"),
        "utf8",
      ),
    ) as {
      applications: Array<{ applicationId: string; applicant: string; designations?: { brand?: boolean } }>;
    };
    const appById = new Map(publication.applications.map((app) => [app.applicationId, app]));
    let confirmedBrand = 0;
    let unresolvedApps = 0;
    let unresolvedBrand = 0;
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
    expect(confirmedBrand).toBe(TRANCHE1B_EXPECTED_CONFIRMED_BRAND_APPLICATIONS);
    expect(unresolvedApps).toBe(TRANCHE1B_EXPECTED_UNRESOLVED_APPLICATIONS);
    expect(unresolvedBrand).toBe(TRANCHE1B_EXPECTED_UNRESOLVED_BRAND_APPLICATIONS);

    // Semantic hash changes from BRAND-1 baseline and is deterministic
    expect(snapshot.semanticContentSha256).not.toBe(TRANCHE1B_EXPECT_PRE_SEMANTIC_HASH);
    expect(b.snapshot.semanticContentSha256).toBe(snapshot.semanticContentSha256);
    expect(hashOrganizationResolutionSnapshot(snapshot)).toBe(snapshot.semanticContentSha256);

    // Safety: no Brand-only / website-only / parent-collapse / cross-round / RSP / category approvals
    expect(snapshot.limitations.some((l) => /Confirmed Organizations are a resolved subset only/i.test(l))).toBe(
      true,
    );
    expect(snapshot.tranche1bStewardDecisionProvenance?.notes).toMatch(/KEEP_CANDIDATE/);
    expect(snapshot.tranche1bStewardDecisionProvenance?.notes).not.toMatch(/selected.?RSP|category taxonomy|returning/i);

    // Applicant legal names unchanged (exact strings from approval list)
    for (const t of TRANCHE1B_APPROVED_TRANSITIONS) {
      expect(
        snapshot.applicantIdentityMappings.some((m) => m.applicantLegalName === t.applicantLegalName),
      ).toBe(true);
    }
    expect(
      snapshot.applicantIdentityMappings.some(
        (m) => m.applicantLegalName === "Industria de Diseño Textil S.A.",
      ),
    ).toBe(true);
    expect(
      snapshot.applicantIdentityMappings.some((m) => m.applicantLegalName === "Epic systems corporation"),
    ).toBe(true);
    expect(snapshot.organizations.some((o) => o.canonicalName === "Inditex" && o.organizationKey === "inditex")).toBe(
      true,
    );
    expect(
      snapshot.organizations.some((o) => o.canonicalName === "Epic Systems" && o.organizationKey === "epic-systems"),
    ).toBe(true);
  });
});
