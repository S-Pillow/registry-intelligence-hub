/**
 * Deterministic representative Application per Applicant legal name.
 * Lexicographically first applicationId among that Applicant's Applications.
 */

export function chooseRepresentativeApplicationId(applicationIds: readonly string[]): string {
  if (applicationIds.length === 0) {
    throw new Error("chooseRepresentativeApplicationId requires at least one applicationId");
  }
  return [...applicationIds].sort((a, b) => a.localeCompare(b))[0]!;
}

export function buildRepresentativeApplicationsByLegalName(
  applications: ReadonlyArray<{ applicationId: string; applicant: string }>,
): Map<string, { representativeApplicationId: string; applicationIds: string[] }> {
  const byName = new Map<string, string[]>();
  for (const app of applications) {
    const list = byName.get(app.applicant) ?? [];
    list.push(app.applicationId);
    byName.set(app.applicant, list);
  }
  const out = new Map<string, { representativeApplicationId: string; applicationIds: string[] }>();
  for (const [name, ids] of [...byName.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const applicationIds = [...ids].sort((a, b) => a.localeCompare(b));
    out.set(name, {
      representativeApplicationId: chooseRepresentativeApplicationId(applicationIds),
      applicationIds,
    });
  }
  return out;
}
