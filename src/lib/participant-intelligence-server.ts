import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_OUTPUT_DIR_RELATIVE as PARTICIPATION_OUTPUT_DIR } from "@/cross-round-participation-intelligence/constants";
import { runParticipationIntelligencePass } from "@/cross-round-participation-intelligence/run-pass";
import type { CrossRoundParticipationIntelligenceSnapshot } from "@/cross-round-participation-intelligence/types";
import { DEFAULT_OUTPUT_DIR_RELATIVE as ORG_RES_OUTPUT_DIR } from "@/organization-resolution-2026/run-first-pass";
import { runFirstPassOrganizationResolution } from "@/organization-resolution-2026/run-first-pass";
import type { OrganizationResolutionSnapshot } from "@/organization-resolution-2026/types";
import type {
  ParticipantOrganizationOverlay,
  ParticipantOverlays,
  ParticipantReturningOverlay,
} from "@/lib/participant-intelligence";

const ORG_SNAPSHOT_RELATIVE = `${ORG_RES_OUTPUT_DIR}/organization-resolution-1.0.0.snapshot.json`;
const PARTICIPATION_SNAPSHOT_RELATIVE = `${PARTICIPATION_OUTPUT_DIR}/cross-round-participation-intelligence-1.0.0.snapshot.json`;

function organizationsFromSnapshot(snapshot: OrganizationResolutionSnapshot): ParticipantOrganizationOverlay[] {
  const orgById = new Map(snapshot.organizations.map((o) => [o.organizationId, o] as const));
  return snapshot.applicantIdentityMappings.map((m) => {
    const org = m.resolutionState === "CONFIRMED" && m.organizationId ? orgById.get(m.organizationId) : undefined;
    return {
      applicantLegalName: m.applicantLegalName,
      resolutionStatus: m.resolutionState,
      confirmedOrganizationId: m.resolutionState === "CONFIRMED" ? m.organizationId : null,
      confirmedOrganizationName: org?.canonicalName ?? null,
      confirmedOrganizationKey: org?.organizationKey ?? null,
      identityEvidence: m.identityContext
        ? {
            applicantWebsiteHost: m.identityContext.applicantWebsiteHost,
            applicantWebsiteUrl: m.identityContext.applicantWebsiteUrl,
            directParentLegalName: m.identityContext.directParentLegalName,
            ultimateParentLegalName: m.identityContext.ultimateParentLegalName,
            ultimateControlLegalName: m.identityContext.ultimateControlLegalName,
            evidenceExplanationLines: [...m.identityContext.evidenceExplanationLines],
          }
        : null,
    };
  });
}

/** Read steward Organization-resolution snapshot (Confirmed Organizations source of truth). */
export async function loadOrganizationResolutionSnapshot(
  workspaceRoot: string = process.cwd(),
): Promise<OrganizationResolutionSnapshot> {
  return loadOrganizationSnapshot(workspaceRoot);
}

function returningFromSnapshots(
  organizations: ParticipantOrganizationOverlay[],
  participation: CrossRoundParticipationIntelligenceSnapshot,
): ParticipantReturningOverlay[] {
  const confirmedOrgToApplicants = new Map<string, string[]>();
  for (const o of organizations) {
    if (o.resolutionStatus !== "CONFIRMED" || !o.confirmedOrganizationId) continue;
    const list = confirmedOrgToApplicants.get(o.confirmedOrganizationId) ?? [];
    list.push(o.applicantLegalName);
    confirmedOrgToApplicants.set(o.confirmedOrganizationId, list);
  }

  const returning: ParticipantReturningOverlay[] = [];
  for (const cmp of participation.organizationComparisons) {
    const applicants = confirmedOrgToApplicants.get(cmp.organization2026Id) ?? [];
    for (const applicantLegalName of applicants) {
      returning.push({
        applicantLegalName,
        organization2026Id: cmp.organization2026Id,
        applications2012: cmp.applications2012,
        applications2026: cmp.applications2026,
        applicationDelta: cmp.applicationDelta,
        portfolioChange: cmp.portfolioChange,
      });
    }
  }
  return returning;
}

async function loadOrganizationSnapshot(workspaceRoot: string): Promise<OrganizationResolutionSnapshot> {
  try {
    const raw = await readFile(join(workspaceRoot, ORG_SNAPSHOT_RELATIVE), "utf8");
    return JSON.parse(raw) as OrganizationResolutionSnapshot;
  } catch {
    const { snapshot } = await runFirstPassOrganizationResolution({
      workspaceRoot,
      writeArtifacts: false,
      applyResearch: true,
      applyStewardApprovals: true,
      applyWeb1Identity: true,
      applyBrand1Identity: true,
      applyTranche1bIdentity: true,
      applyTranche1dIdentity: true,
    });
    return snapshot;
  }
}

async function loadParticipationSnapshot(
  workspaceRoot: string,
): Promise<CrossRoundParticipationIntelligenceSnapshot> {
  try {
    const raw = await readFile(join(workspaceRoot, PARTICIPATION_SNAPSHOT_RELATIVE), "utf8");
    return JSON.parse(raw) as CrossRoundParticipationIntelligenceSnapshot;
  } catch {
    const { snapshot } = await runParticipationIntelligencePass({
      workspaceRoot,
      writeArtifacts: false,
    });
    return snapshot;
  }
}

/**
 * Load Organization + confirmed-returning overlays for Competitive Landscape.
 * Prefers written snapshots; falls back to live passes (writeArtifacts: false).
 */
export async function loadParticipantOverlays(
  workspaceRoot: string = process.cwd(),
): Promise<ParticipantOverlays> {
  const orgSnapshot = await loadOrganizationSnapshot(workspaceRoot);
  const organizations = organizationsFromSnapshot(orgSnapshot);
  const participation = await loadParticipationSnapshot(workspaceRoot);
  return {
    organizations,
    returning: returningFromSnapshots(organizations, participation),
  };
}
