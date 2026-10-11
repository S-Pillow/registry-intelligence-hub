import type { ApplicantRspPosture } from "@/lib/rsp-opportunity-intelligence";
import { diffApplications } from "@/change-intel/application-diff";
import { diffContentionMemberships } from "@/change-intel/contention-diff";
import { assignImpact, sortChangeRecords } from "@/change-intel/impact";
import { makeDiffId } from "@/change-intel/hash";
import {
  CHANGE_INTEL_DIFF_VERSION,
  type ChangeIntelDiff,
  type ChangeIntelObservation,
} from "@/change-intel/types";

export function deriveDiff(input: {
  previous: ChangeIntelObservation | null;
  current: ChangeIntelObservation;
  rspByApplicant?: Map<string, ApplicantRspPosture>;
}): ChangeIntelDiff {
  const previous = input.previous;
  const current = input.current;
  const appsChanges = previous
    ? diffApplications({
        observationId: current.observationId,
        observedAt: current.observedAt,
        previous: previous.applications,
        current: current.applications,
      })
    : [];
  const appsById = new Map(current.applications.map((a) => [a.applicationId, a]));
  if (previous) {
    for (const app of previous.applications) {
      if (!appsById.has(app.applicationId)) appsById.set(app.applicationId, app);
    }
  }
  const contentionChanges = previous
    ? diffContentionMemberships({
        observationId: current.observationId,
        observedAt: current.observedAt,
        previous: previous.contentionMemberships,
        current: current.contentionMemberships,
        applicationsById: appsById,
      })
    : [];

  const withImpact = assignImpact({
    changes: [...appsChanges, ...contentionChanges],
    currentApplications: current.applications,
    currentMemberships: current.contentionMemberships,
    previousMemberships: previous?.contentionMemberships ?? [],
    rspByApplicant: input.rspByApplicant,
  });
  const changes = sortChangeRecords(withImpact);
  const summary = {
    applicationChanges: changes.filter((c) => c.sourceType === "application").length,
    contentionChanges: changes.filter((c) => c.sourceType === "contention").length,
    godaddyDirect: changes.filter((c) => c.primaryImpact === "GODADDY_DIRECT").length,
    godaddyContention: changes.filter((c) => c.primaryImpact === "GODADDY_CONTENTION").length,
    rspResearchRelevant: changes.filter((c) => c.primaryImpact === "RSP_RESEARCH_RELEVANT").length,
    marketChange: changes.filter((c) => c.primaryImpact === "MARKET_CHANGE").length,
  };
  const semanticUnchanged =
    Boolean(previous)
    && previous!.applicationsSemanticHash === current.applicationsSemanticHash
    && previous!.contentionSemanticHash === current.contentionSemanticHash
    && changes.length === 0;

  return {
    version: CHANGE_INTEL_DIFF_VERSION,
    diffId: makeDiffId(current.observationId),
    observationId: current.observationId,
    previousObservationId: previous?.observationId ?? null,
    observedAt: current.observedAt,
    previousObservedAt: previous?.observedAt ?? null,
    semanticUnchanged,
    summary,
    changes,
  };
}
