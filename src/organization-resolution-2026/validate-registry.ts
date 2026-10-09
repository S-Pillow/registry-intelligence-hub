import {
  ORGANIZATION_RESOLUTION_METHOD_VERSION,
  ORGANIZATION_RESOLUTION_REGISTRY_VERSION,
} from "./constants";
import type {
  OrganizationEvidenceRef,
  OrganizationResolutionOperation,
  OrganizationResolutionRegistry,
} from "./types";

const CONFIRMING_STRENGTHS = new Set(["A", "B"]);

export function validateOrganizationResolutionRegistry(registry: OrganizationResolutionRegistry): void {
  if (registry.registryVersion !== ORGANIZATION_RESOLUTION_REGISTRY_VERSION) {
    throw new Error(
      `Organization resolution registry version mismatch: expected ${ORGANIZATION_RESOLUTION_REGISTRY_VERSION}, got ${registry.registryVersion}`,
    );
  }
  if (registry.methodVersion !== ORGANIZATION_RESOLUTION_METHOD_VERSION) {
    throw new Error(
      `Organization resolution methodVersion must be ${ORGANIZATION_RESOLUTION_METHOD_VERSION}`,
    );
  }

  const evidenceById = new Map<string, OrganizationEvidenceRef>();
  for (const evidence of registry.evidence) {
    if (evidenceById.has(evidence.evidenceId)) {
      throw new Error(`Duplicate evidenceId ${evidence.evidenceId}`);
    }
    if (!evidence.summary.trim() || !evidence.supportsClaim.trim() || !evidence.sourceIdentifier.trim()) {
      throw new Error(`Evidence ${evidence.evidenceId} requires non-empty provenance fields`);
    }
    evidenceById.set(evidence.evidenceId, evidence);
  }

  const seenOpIds = new Set<string>();
  const applicantToOp = new Map<string, string>();

  for (const op of registry.operations) {
    validateResolutionOperation(op, evidenceById);
    if (seenOpIds.has(op.opId)) {
      throw new Error(`Duplicate opId ${op.opId}`);
    }
    seenOpIds.add(op.opId);

    for (const legalName of op.applicantLegalNames) {
      const existing = applicantToOp.get(legalName);
      if (existing) {
        throw new Error(
          `Silent merge blocked: applicant legal name "${legalName}" appears in both ${existing} and ${op.opId}`,
        );
      }
      applicantToOp.set(legalName, op.opId);
    }
  }
}

export function validateResolutionOperation(
  op: OrganizationResolutionOperation,
  evidenceById: Map<string, OrganizationEvidenceRef>,
): void {
  if (op.methodVersion !== ORGANIZATION_RESOLUTION_METHOD_VERSION) {
    throw new Error(`Resolution op ${op.opId} methodVersion must be ${ORGANIZATION_RESOLUTION_METHOD_VERSION}`);
  }
  if (op.applicantLegalNames.length === 0) {
    throw new Error(`Resolution op ${op.opId} requires at least one applicantLegalName`);
  }
  if (op.evidenceRefIds.length === 0) {
    throw new Error(`Resolution op ${op.opId} requires non-empty evidenceRefIds`);
  }
  for (const evidenceId of op.evidenceRefIds) {
    if (!evidenceById.has(evidenceId)) {
      throw new Error(`Resolution op ${op.opId} references missing evidence ${evidenceId}`);
    }
  }

  if (op.resolutionState === "CONFIRMED") {
    if (op.reviewState !== "steward-approved") {
      throw new Error(`CONFIRMED resolution ${op.opId} requires reviewState steward-approved`);
    }
    if (op.confidence === "low") {
      throw new Error(`CONFIRMED resolution ${op.opId} requires confidence high or medium`);
    }
    const strengths = op.evidenceRefIds.map((id) => evidenceById.get(id)!.strength);
    if (!strengths.some((s) => CONFIRMING_STRENGTHS.has(s))) {
      throw new Error(
        `CONFIRMED resolution ${op.opId} requires at least one A/B evidence ref (got ${strengths.join(",")})`,
      );
    }
  }
}

/** Rejects parent/subsidiary collapse without A/B ownership evidence. */
export function assertNotUnsupportedParentCollapse(input: {
  opId: string;
  applicantLegalNames: string[];
  evidence: OrganizationEvidenceRef[];
  claimsParentSubsidiaryCollapse: boolean;
}): void {
  if (!input.claimsParentSubsidiaryCollapse) return;
  const hasOwnership = input.evidence.some((e) => e.strength === "A" || e.strength === "B");
  if (!hasOwnership) {
    throw new Error(
      `Unsupported parent/subsidiary collapse rejected for ${input.opId}: requires A/B ownership/control evidence`,
    );
  }
}
