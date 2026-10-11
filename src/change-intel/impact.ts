import { GODADDY_FOCAL_APPLICANT_LEGAL_NAME } from "@/lib/participant-intelligence";
import {
  prospectingPostureLabel,
  type ApplicantRspPosture,
  type RspProspectingPosture,
} from "@/lib/rsp-opportunity-intelligence";
import type {
  ChangeRecord,
  ContentionMembershipKey,
  PrimaryImpact,
  RspPublicPostureLabel,
  TrackedApplicationFields,
} from "@/change-intel/types";

function postureToLabel(posture: RspProspectingPosture | null | undefined): RspPublicPostureLabel {
  if (!posture) return null;
  return prospectingPostureLabel(posture) as RspPublicPostureLabel;
}

function isGodaddyApplicant(name: string | null | undefined): boolean {
  return Boolean(name && name === GODADDY_FOCAL_APPLICANT_LEGAL_NAME);
}

function godaddySetIds(memberships: ContentionMembershipKey[], apps: Map<string, TrackedApplicationFields>): Set<string> {
  const sets = new Set<string>();
  for (const m of memberships) {
    const app = apps.get(m.applicationId);
    if (app && isGodaddyApplicant(app.applicantLegalName)) {
      sets.add(m.contentionSetId);
    }
  }
  return sets;
}

function applicantCounts(apps: TrackedApplicationFields[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const app of apps) {
    map.set(app.applicantLegalName, (map.get(app.applicantLegalName) ?? 0) + 1);
  }
  return map;
}

function applicantContentionCounts(memberships: ContentionMembershipKey[], apps: Map<string, TrackedApplicationFields>): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of memberships) {
    const app = apps.get(m.applicationId);
    if (!app) continue;
    map.set(app.applicantLegalName, (map.get(app.applicantLegalName) ?? 0) + 1);
  }
  return map;
}

const IMPACT_RANK: Record<PrimaryImpact, number> = {
  GODADDY_DIRECT: 0,
  GODADDY_CONTENTION: 1,
  RSP_RESEARCH_RELEVANT: 2,
  MARKET_CHANGE: 3,
};

export function assignImpact(input: {
  changes: ChangeRecord[];
  currentApplications: TrackedApplicationFields[];
  currentMemberships: ContentionMembershipKey[];
  previousMemberships: ContentionMembershipKey[];
  rspByApplicant?: Map<string, ApplicantRspPosture>;
}): ChangeRecord[] {
  const apps = new Map(input.currentApplications.map((a) => [a.applicationId, a]));
  // Include previous apps for removals
  for (const change of input.changes) {
    if (change.before && "applicationId" in change.before && "applicantLegalName" in change.before) {
      const before = change.before as TrackedApplicationFields;
      if (!apps.has(before.applicationId)) apps.set(before.applicationId, before);
    }
  }
  const unionMemberships = [...input.currentMemberships, ...input.previousMemberships];
  const godaddySets = godaddySetIds(unionMemberships, apps);
  const appCounts = applicantCounts(input.currentApplications);
  const contentionCounts = applicantContentionCounts(input.currentMemberships, apps);

  return input.changes.map((change) => {
    const applicant = change.applicantLegalName;
    const reasons: string[] = [];
    let primary: PrimaryImpact = "MARKET_CHANGE";
    const rsp = applicant ? input.rspByApplicant?.get(applicant) : undefined;
    const rspLabel = postureToLabel(rsp?.rspProspectingPosture);

    if (isGodaddyApplicant(applicant)) {
      primary = "GODADDY_DIRECT";
      reasons.push("Changed Application belongs to Registry Services, LLC (GoDaddy Applicant portfolio).");
    } else if (change.contentionSetId && godaddySets.has(change.contentionSetId)) {
      primary = "GODADDY_CONTENTION";
      reasons.push(
        `Official contention set ${change.contentionSetId} includes one or more Registry Services, LLC Applications.`,
      );
    } else if (
      change.sourceType === "application"
      && change.applicationId
      && (() => {
        const app = apps.get(change.applicationId);
        if (!app) return false;
        const setsForApp = unionMemberships
          .filter((m) => m.applicationId === app.applicationId)
          .map((m) => m.contentionSetId);
        return setsForApp.some((id) => godaddySets.has(id));
      })()
    ) {
      primary = "GODADDY_CONTENTION";
      reasons.push("Changed Application participates in an official contention set with Registry Services, LLC.");
    } else if (rsp?.rspProspectingPosture === "NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND") {
      primary = "RSP_RESEARCH_RELEVANT";
      reasons.push(
        "Applicant currently has no public Main-RSP capability match — may be worth GoDaddy Registry investigation. Selected RSP is not disclosed in public Application data.",
      );
    } else {
      reasons.push("Public-source change without direct GoDaddy portfolio or GoDaddy contention set impact.");
      if (rspLabel) {
        reasons.push(`Public RSP posture context: ${rspLabel}.`);
      }
    }

    return {
      ...change,
      primaryImpact: primary,
      impactReasons: reasons,
      applicantApplicationCount: applicant ? appCounts.get(applicant) ?? null : null,
      applicantContentionCount: applicant ? contentionCounts.get(applicant) ?? null : null,
      rspPublicPosture: rspLabel,
    };
  });
}

export function sortChangeRecords(changes: ChangeRecord[]): ChangeRecord[] {
  return [...changes].sort((a, b) => {
    const impact = IMPACT_RANK[a.primaryImpact] - IMPACT_RANK[b.primaryImpact];
    if (impact !== 0) return impact;
    if (a.primaryImpact === "RSP_RESEARCH_RELEVANT") {
      const apps = (b.applicantApplicationCount ?? 0) - (a.applicantApplicationCount ?? 0);
      if (apps !== 0) return apps;
      const cont = (b.applicantContentionCount ?? 0) - (a.applicantContentionCount ?? 0);
      if (cont !== 0) return cont;
    }
    const time = b.observedAt.localeCompare(a.observedAt);
    if (time !== 0) return time;
    const applicant = (a.applicantLegalName ?? "").localeCompare(b.applicantLegalName ?? "");
    if (applicant !== 0) return applicant;
    return (a.applicationId ?? "").localeCompare(b.applicationId ?? "")
      || a.changeId.localeCompare(b.changeId);
  });
}
