import type { Registry2026PublicationV2 } from "@/reveal-day-2026/publication-v2-types";
import type { ContentionMembershipSnapshotV1 } from "@/reveal-day-2026/contention-membership-types";
import type { ResearchQueueEntry, ResearchQueueReason } from "./review-types";

export const RESEARCH_QUEUE_METHOD =
  "union(existing-CANDIDATE mappings, top-20 unresolved by observed Application count, top-10 unresolved by official contention memberships); de-duplicate; cap 30; no inferred Organization priority";

export const RESEARCH_QUEUE_CAP = 30;
export const TOP_BY_APPLICATION_COUNT = 20;
export const TOP_BY_CONTENTION_MEMBERSHIPS = 10;

/**
 * Deterministic research queue from Applicant/application facts only.
 * Does not use Organization inference for priority.
 */
export function buildResearchQueue(input: {
  publication: Registry2026PublicationV2;
  contention: ContentionMembershipSnapshotV1;
  /** Exact legal names already in CANDIDATE state from prior resolution pass. */
  existingCandidateLegalNames: string[];
}): ResearchQueueEntry[] {
  const appById = new Map(input.publication.applications.map((a) => [a.applicationId, a]));
  const appsByName = new Map<string, string[]>();
  for (const app of input.publication.applications) {
    const list = appsByName.get(app.applicant) ?? [];
    list.push(app.applicationId);
    appsByName.set(app.applicant, list);
  }

  const contentionByName = new Map<string, number>();
  for (const set of input.contention.contentionSets) {
    for (const member of set.members) {
      const app = appById.get(member.applicationId);
      if (!app) continue;
      contentionByName.set(app.applicant, (contentionByName.get(app.applicant) ?? 0) + 1);
    }
  }

  const reasonsByName = new Map<string, Set<ResearchQueueReason>>();
  const ensure = (name: string, reason: ResearchQueueReason) => {
    const set = reasonsByName.get(name) ?? new Set<ResearchQueueReason>();
    set.add(reason);
    reasonsByName.set(name, set);
  };

  for (const name of [...input.existingCandidateLegalNames].sort((a, b) => a.localeCompare(b))) {
    if (!appsByName.has(name)) {
      throw new Error(`Research queue existing candidate unknown: ${name}`);
    }
    ensure(name, "existing-candidate");
  }

  // Top by application count among names not yet solely from another path — include all non-candidates first
  const byApp = [...appsByName.entries()]
    .filter(([name]) => !input.existingCandidateLegalNames.includes(name))
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, TOP_BY_APPLICATION_COUNT)
    .map(([name]) => name);
  for (const name of byApp) ensure(name, "top-app-count");

  const byContention = [...contentionByName.entries()]
    .filter(([name]) => !input.existingCandidateLegalNames.includes(name))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_BY_CONTENTION_MEMBERSHIPS)
    .map(([name]) => name);
  for (const name of byContention) ensure(name, "top-contention");

  // Deterministic order: existing candidates (alpha), then remaining by app count desc, name asc
  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const name of [...input.existingCandidateLegalNames].sort((a, b) => a.localeCompare(b))) {
    ordered.push(name);
    seen.add(name);
  }
  const rest = [...reasonsByName.keys()]
    .filter((n) => !seen.has(n))
    .sort(
      (a, b) =>
        (appsByName.get(b)?.length ?? 0) - (appsByName.get(a)?.length ?? 0) || a.localeCompare(b),
    );
  for (const name of rest) {
    ordered.push(name);
    seen.add(name);
  }

  return ordered.slice(0, RESEARCH_QUEUE_CAP).map((name) => ({
    applicantLegalName: name,
    queueReasons: [...(reasonsByName.get(name) ?? [])].sort() as ResearchQueueReason[],
    observedApplicationCount: appsByName.get(name)?.length ?? 0,
    officialContentionMemberships: contentionByName.get(name) ?? 0,
  }));
}

export function existingCandidateLegalNamesFromSnapshot(mappings: Array<{
  applicantLegalName: string;
  resolutionState: string;
}>): string[] {
  return mappings
    .filter((m) => m.resolutionState === "CANDIDATE")
    .map((m) => m.applicantLegalName)
    .sort((a, b) => a.localeCompare(b));
}
