import type {
  ApplicantEntity,
  NormalizedEntity,
  OrganizationEntity,
  OrganizationPromotionOperation,
  OrganizationPromotionRegistry,
  OrganizationPromotionState,
} from "./types";
import {
  ORGANIZATION_PROMOTION_METHOD_VERSION,
  ORGANIZATION_PROMOTION_REGISTRY_VERSION,
} from "./types";

const HIGH_IMPACT_PORTFOLIO_THRESHOLD = 10;

export function validateOrganizationPromotionRegistryVersion(registryVersion: string): void {
  if (registryVersion !== ORGANIZATION_PROMOTION_REGISTRY_VERSION) {
    throw new Error(
      `Organization promotion registry version mismatch: expected ${ORGANIZATION_PROMOTION_REGISTRY_VERSION}, got ${registryVersion}`,
    );
  }
}

export function validatePromotionOperation(op: OrganizationPromotionOperation): void {
  if (op.methodVersion !== ORGANIZATION_PROMOTION_METHOD_VERSION) {
    throw new Error(`Promotion op ${op.opId} methodVersion must be ${ORGANIZATION_PROMOTION_METHOD_VERSION}`);
  }
  if (op.evidence.length === 0) {
    throw new Error(`Promotion op ${op.opId} requires non-empty evidence`);
  }
  if (op.applicationIds.length === 0) {
    throw new Error(`Promotion op ${op.opId} requires at least one applicationId`);
  }
  if (op.promotionState === "UNRESOLVED") {
    throw new Error(`Promotion op ${op.opId} must not use UNRESOLVED — omit op instead`);
  }
  if (op.promotionState === "CONFIRMED") {
    if (op.reviewState !== "steward-approved") {
      throw new Error(`CONFIRMED promotion ${op.opId} requires reviewState steward-approved`);
    }
    if (op.confidence === "low") {
      throw new Error(`CONFIRMED promotion ${op.opId} requires confidence high or medium`);
    }
  }
}

function applicantEntityId(applicationId: string): string {
  return `applicant:${applicationId}`;
}

function promotedOrganizationEntityId(organizationKey: string): string {
  return `organization:promoted:${organizationKey}`;
}

export function applyOrganizationPromotions(
  entities: NormalizedEntity[],
  registry: OrganizationPromotionRegistry,
): NormalizedEntity[] {
  validateOrganizationPromotionRegistryVersion(registry.registryVersion);
  if (registry.methodVersion !== ORGANIZATION_PROMOTION_METHOD_VERSION) {
    throw new Error(`Promotion registry methodVersion must be ${ORGANIZATION_PROMOTION_METHOD_VERSION}`);
  }

  for (const op of registry.operations) {
    validatePromotionOperation(op);
  }

  const applicationToOp = new Map<string, OrganizationPromotionOperation>();
  for (const op of registry.operations) {
    for (const applicationId of op.applicationIds) {
      const existing = applicationToOp.get(applicationId);
      if (existing) {
        throw new Error(
          `Silent merge blocked: application ${applicationId} appears in both ${existing.opId} and ${op.opId}`,
        );
      }
      applicationToOp.set(applicationId, op);
    }
  }

  const byId = new Map(entities.map((entity) => [entity.entityId, { ...entity } as NormalizedEntity]));
  const promotedOrganizations = new Map<string, OrganizationEntity>();

  for (const op of registry.operations) {
    for (const applicationId of op.applicationIds) {
      const applicantId = applicantEntityId(applicationId);
      const applicant = byId.get(applicantId);
      if (!applicant || applicant.entityKind !== "applicant") {
        throw new Error(`Promotion ${op.opId} references missing applicant ${applicantId}`);
      }

      const applicantRecord = applicant as ApplicantEntity;
      applicantRecord.organizationPromotion = {
        organizationKey: op.organizationKey,
        canonicalOrganizationName: op.canonicalOrganizationName,
        promotionState: op.promotionState,
        confidence: op.confidence,
        reviewState: op.reviewState,
        methodVersion: op.methodVersion,
        evidence: [...op.evidence],
        promotionOpId: op.opId,
      };
      applicantRecord.lineage = {
        ...applicantRecord.lineage,
        overrideOpIds: [...applicantRecord.lineage.overrideOpIds, op.opId],
      };
      applicantRecord.reconciliationNotes = [
        ...applicantRecord.reconciliationNotes,
        `Organization promotion ${op.opId}: ${op.promotionState} → ${op.canonicalOrganizationName}`,
      ];
      byId.set(applicantId, applicantRecord);
    }

    const orgEntityId = promotedOrganizationEntityId(op.organizationKey);
    const firstApplicant = byId.get(applicantEntityId(op.applicationIds[0]));
    const lineage =
      firstApplicant?.lineage ??
      ({
        rawSnapshotSha256: "",
        parsedRecordHash: "",
        observationIds: [],
        overrideOpIds: [op.opId],
      } as OrganizationEntity["lineage"]);

    const existingOrg = promotedOrganizations.get(op.organizationKey);
    if (existingOrg) {
      const mergedIds = [...new Set([...existingOrg.promotion!.memberApplicationIds, ...op.applicationIds])].sort();
      existingOrg.promotion = {
        ...existingOrg.promotion!,
        memberApplicationIds: mergedIds,
        promotionOpIds: [...new Set([...existingOrg.promotion!.promotionOpIds, op.opId])],
        evidence: [...new Set([...existingOrg.promotion!.evidence, ...op.evidence])],
      };
      existingOrg.reconciliationNotes = [
        ...existingOrg.reconciliationNotes,
        `Promotion op ${op.opId}: ${op.reason}`,
      ];
      existingOrg.lineage = {
        ...existingOrg.lineage,
        overrideOpIds: [...new Set([...existingOrg.lineage.overrideOpIds, op.opId])],
      };
    } else {
      promotedOrganizations.set(op.organizationKey, {
        entityKind: "organization",
        entityId: orgEntityId,
        candidates: [],
        promotion: {
          organizationKey: op.organizationKey,
          canonicalOrganizationName: op.canonicalOrganizationName,
          promotionState: op.promotionState,
          memberApplicationIds: [...op.applicationIds].sort(),
          confidence: op.confidence,
          reviewState: op.reviewState,
          methodVersion: op.methodVersion,
          evidence: [...op.evidence],
          promotionOpIds: [op.opId],
        },
        reconciliationState:
          op.promotionState === "CONFIRMED"
            ? "MATCHED"
            : op.promotionState === "AMBIGUOUS"
              ? "AMBIGUOUS_ENTITY"
              : "REQUIRES_REVIEW",
        reconciliationNotes: [`Explicit promotion registry — ${op.promotionState}`, op.reason],
        lineage: {
          ...lineage,
          overrideOpIds: [...lineage.overrideOpIds, op.opId],
        },
        normalizerVersion: firstApplicant?.normalizerVersion ?? ORGANIZATION_PROMOTION_METHOD_VERSION,
        normalizedAt: firstApplicant?.normalizedAt ?? op.createdAt,
      });
    }
  }

  const result = [...byId.values()];
  for (const org of promotedOrganizations.values()) {
    result.push(org);
  }

  return result.sort((a, b) => a.entityId.localeCompare(b.entityId));
}

export interface OrganizationPromotionReport {
  reportVersion: "1.0.0";
  bundleId: string;
  registryVersion: typeof ORGANIZATION_PROMOTION_REGISTRY_VERSION;
  methodVersion: typeof ORGANIZATION_PROMOTION_METHOD_VERSION;
  applicationCount: number;
  promotedApplicationCount: number;
  unresolvedApplicationCount: number;
  promotionOperationCount: number;
  promotedOrganizationCount: number;
  applicationsByPromotionState: Record<OrganizationPromotionState, number>;
  organizationsByPromotionState: Record<OrganizationPromotionState, number>;
  highImpactPortfolioThreshold: number;
  highImpactLegalNames: Array<{ legalName: string; applicationCount: number; coveredByPromotion: boolean }>;
  highImpactCoverageComplete: boolean;
  portfolioMetricsComparable: boolean;
  returningMetricsComparable: boolean;
  portfolioMetricGates: string[];
  returningMetricGates: string[];
  topPromotedPortfolios: Array<{
    organizationKey: string;
    canonicalOrganizationName: string;
    promotionState: OrganizationPromotionState;
    applicationCount: number;
  }>;
}

export function buildOrganizationPromotionReport(input: {
  bundleId: string;
  registry: OrganizationPromotionRegistry;
  entities: NormalizedEntity[];
  applicationCount: number;
  portfolioSizeByLegalName: Map<string, number>;
}): OrganizationPromotionReport {
  const applicants = input.entities.filter((e): e is ApplicantEntity => e.entityKind === "applicant");
  const promotedOrgs = input.entities.filter(
    (e): e is OrganizationEntity => e.entityKind === "organization" && Boolean(e.promotion),
  );

  const applicationsByPromotionState: Record<OrganizationPromotionState, number> = {
    CONFIRMED: 0,
    CANDIDATE: 0,
    AMBIGUOUS: 0,
    UNRESOLVED: 0,
  };

  for (const applicant of applicants) {
    const state = applicant.organizationPromotion?.promotionState ?? "UNRESOLVED";
    applicationsByPromotionState[state]++;
  }

  const organizationsByPromotionState: Record<OrganizationPromotionState, number> = {
    CONFIRMED: 0,
    CANDIDATE: 0,
    AMBIGUOUS: 0,
    UNRESOLVED: 0,
  };
  for (const org of promotedOrgs) {
    organizationsByPromotionState[org.promotion!.promotionState]++;
  }

  const highImpactLegalNames = [...input.portfolioSizeByLegalName.entries()]
    .filter(([, count]) => count >= HIGH_IMPACT_PORTFOLIO_THRESHOLD)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([legalName, applicationCount]) => {
      const coveredByPromotion = applicants.some(
        (a) =>
          a.legalName.value === legalName &&
          a.organizationPromotion &&
          a.organizationPromotion.promotionState !== "UNRESOLVED",
      );
      return { legalName, applicationCount, coveredByPromotion };
    });

  const highImpactCoverageComplete = highImpactLegalNames.every((row) => row.coveredByPromotion);

  const portfolioMetricGates: string[] = [];
  if (!highImpactCoverageComplete) {
    portfolioMetricGates.push(
      `High-impact portfolios (≥${HIGH_IMPACT_PORTFOLIO_THRESHOLD} applications per legal name) must each have explicit promotion state`,
    );
  }
  if (applicationsByPromotionState.CONFIRMED + applicationsByPromotionState.CANDIDATE === 0) {
    portfolioMetricGates.push("At least one promoted application required");
  }
  portfolioMetricGates.push("Product sign-off required before UI portfolio swap");
  portfolioMetricGates.push("Full-round promotion coverage remains partial — majority of applications UNRESOLVED");

  const returningMetricGates = [
    "Post-Reveal application status and delegation not ingested",
    "Returning-applicant analysis requires promotion coverage plus outcome history",
    "Product sign-off required before returning metrics in UI",
  ];

  const promotedApplicationCount =
    applicationsByPromotionState.CONFIRMED +
    applicationsByPromotionState.CANDIDATE +
    applicationsByPromotionState.AMBIGUOUS;

  return {
    reportVersion: "1.0.0",
    bundleId: input.bundleId,
    registryVersion: ORGANIZATION_PROMOTION_REGISTRY_VERSION,
    methodVersion: ORGANIZATION_PROMOTION_METHOD_VERSION,
    applicationCount: input.applicationCount,
    promotedApplicationCount,
    unresolvedApplicationCount: applicationsByPromotionState.UNRESOLVED,
    promotionOperationCount: input.registry.operations.length,
    promotedOrganizationCount: promotedOrgs.length,
    applicationsByPromotionState,
    organizationsByPromotionState,
    highImpactPortfolioThreshold: HIGH_IMPACT_PORTFOLIO_THRESHOLD,
    highImpactLegalNames,
    highImpactCoverageComplete,
    portfolioMetricsComparable: highImpactCoverageComplete,
    returningMetricsComparable: false,
    portfolioMetricGates,
    returningMetricGates,
    topPromotedPortfolios: promotedOrgs
      .map((org) => ({
        organizationKey: org.promotion!.organizationKey,
        canonicalOrganizationName: org.promotion!.canonicalOrganizationName,
        promotionState: org.promotion!.promotionState,
        applicationCount: org.promotion!.memberApplicationIds.length,
      }))
      .sort((a, b) => b.applicationCount - a.applicationCount || a.organizationKey.localeCompare(b.organizationKey))
      .slice(0, 15),
  };
}

export function portfolioSizeByLegalNameFromRows(rows: { applicantLegalName: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const name = row.applicantLegalName.trim();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}
