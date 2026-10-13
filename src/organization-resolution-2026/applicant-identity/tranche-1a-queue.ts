/**
 * ORG-RES-TRANCHE-1A deterministic research queue selection.
 * Brand lane ∪ multi-Application lane; max 30; UNRESOLVED only.
 */
export type Tranche1aLane = "BRAND" | "MULTI";

/** Code-point ascending compare — stable across JS locale collation differences (e.g. `&`). */
function compareLegalNameAsc(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export type Tranche1aQueueRow = {
  applicantLegalName: string;
  applicationCount: number;
  brandApplicationCount: number;
  officialContentionMembershipCount: number;
  lanes: Tranche1aLane[];
};

export type Tranche1aUnresolvedInput = {
  applicantLegalName: string;
  resolutionState: string;
  applicationIds: string[];
};

export function selectOrgResTranche1aQueue(input: {
  unresolvedMappings: Tranche1aUnresolvedInput[];
  brandByApplicationId: Map<string, boolean>;
  contentionSetByApplicationId: Map<string, string>;
  brandLaneSize?: number;
  multiLaneSize?: number;
}): {
  brandLane: Tranche1aQueueRow[];
  multiLane: Tranche1aQueueRow[];
  overlap: string[];
  union: Tranche1aQueueRow[];
} {
  const brandLaneSize = input.brandLaneSize ?? 15;
  const multiLaneSize = input.multiLaneSize ?? 15;

  const rows = input.unresolvedMappings
    .filter((m) => m.resolutionState === "UNRESOLVED")
    .map((m) => {
      const applicationCount = m.applicationIds.length;
      const brandApplicationCount = m.applicationIds.filter(
        (id) => input.brandByApplicationId.get(id) === true,
      ).length;
      const setIds = new Set<string>();
      let officialContentionMembershipCount = 0;
      for (const id of m.applicationIds) {
        const setId = input.contentionSetByApplicationId.get(id);
        if (setId) {
          officialContentionMembershipCount += 1;
          setIds.add(setId);
        }
      }
      return {
        applicantLegalName: m.applicantLegalName,
        applicationCount,
        brandApplicationCount,
        officialContentionMembershipCount,
        distinctContentionSetCount: setIds.size,
      };
    });

  const brandLaneBase = rows
    .filter((r) => r.brandApplicationCount >= 1)
    .sort(
      (a, b) =>
        b.brandApplicationCount - a.brandApplicationCount ||
        b.applicationCount - a.applicationCount ||
        b.officialContentionMembershipCount - a.officialContentionMembershipCount ||
        compareLegalNameAsc(a.applicantLegalName, b.applicantLegalName),
    )
    .slice(0, brandLaneSize);

  const multiLaneBase = rows
    .filter((r) => r.applicationCount >= 2)
    .sort(
      (a, b) =>
        b.applicationCount - a.applicationCount ||
        b.brandApplicationCount - a.brandApplicationCount ||
        b.officialContentionMembershipCount - a.officialContentionMembershipCount ||
        compareLegalNameAsc(a.applicantLegalName, b.applicantLegalName),
    )
    .slice(0, multiLaneSize);

  const brandNames = new Set(brandLaneBase.map((r) => r.applicantLegalName));
  const multiNames = new Set(multiLaneBase.map((r) => r.applicantLegalName));
  const overlap = [...brandNames]
    .filter((n) => multiNames.has(n))
    .sort(compareLegalNameAsc);

  const byName = new Map(rows.map((r) => [r.applicantLegalName, r]));
  const unionNames = [...new Set([...brandNames, ...multiNames])];
  // Deterministic union order: Brand-lane order, then Multi-only in multi-lane order
  const ordered: string[] = [];
  for (const r of brandLaneBase) ordered.push(r.applicantLegalName);
  for (const r of multiLaneBase) {
    if (!brandNames.has(r.applicantLegalName)) ordered.push(r.applicantLegalName);
  }

  const toRow = (name: string): Tranche1aQueueRow => {
    const r = byName.get(name)!;
    const lanes: Tranche1aLane[] = [];
    if (brandNames.has(name)) lanes.push("BRAND");
    if (multiNames.has(name)) lanes.push("MULTI");
    return {
      applicantLegalName: r.applicantLegalName,
      applicationCount: r.applicationCount,
      brandApplicationCount: r.brandApplicationCount,
      officialContentionMembershipCount: r.officialContentionMembershipCount,
      lanes,
    };
  };

  return {
    brandLane: brandLaneBase.map((r) => toRow(r.applicantLegalName)),
    multiLane: multiLaneBase.map((r) => toRow(r.applicantLegalName)),
    overlap,
    union: ordered.map(toRow),
  };
}
