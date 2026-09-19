import type { Registry2026PublicationSnapshot } from "./types";
import { isRehearsalPublication } from "./validate";

export type ContaminationVerdict = {
  ok: boolean;
  rehearsalMarkers: string[];
  message: string;
};

const REHEARSAL_ORG_PREFIXES = ["rehearsal-org:", "Atlas Digital", "Kizuna Registry"];

/**
 * Ensures rehearsal-labeled entities cannot be promoted or bundled into an immutable publication build.
 */
export function assertNoFixtureContaminationInRealBuild(
  snapshot: Registry2026PublicationSnapshot,
  context: "promote" | "verify",
): ContaminationVerdict {
  const rehearsalMarkers: string[] = [];

  if (isRehearsalPublication(snapshot)) {
    rehearsalMarkers.push(`publicationKind=${snapshot.publicationKind}`);
    if (snapshot.fixtureId) rehearsalMarkers.push(`fixtureId=${snapshot.fixtureId}`);
    rehearsalMarkers.push(`snapshotId=${snapshot.snapshotId}`);
  }

  if (snapshot.publicationKind === "immutable-publication") {
    for (const row of snapshot.applications) {
      if (row.id.startsWith("APP-26") && row.id.length <= 9) {
        // Rehearsal fixture uses APP-26001… — block if org labels match curated rehearsal set
        for (const prefix of REHEARSAL_ORG_PREFIXES) {
          if (row.organization.startsWith(prefix) || row.organization === prefix) {
            rehearsalMarkers.push(`${row.id}:organization=${row.organization}`);
          }
        }
      }
    }
  }

  const ok = rehearsalMarkers.length === 0;
  return {
    ok,
    rehearsalMarkers,
    message: ok
      ? `No rehearsal contamination detected (${context})`
      : `Rehearsal contamination blocked for real 2026 build (${context}): ${rehearsalMarkers.join("; ")}`,
  };
}
