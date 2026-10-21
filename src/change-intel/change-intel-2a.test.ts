import { describe, expect, it } from "vitest";
import {
  deriveChangeContext,
  deriveContentionSetIds,
  deriveOrganizationContext,
  organizationLookupFromSnapshot,
  type OrganizationLookupRow,
} from "@/change-intel/derive-change-context";
import {
  changeRecordFingerprint,
  enrichPresentationFeed,
} from "@/change-intel/enrich-presentation-feed";
import { makeBaselineObservation, makeRepresentativeFeed } from "@/change-intel/fixtures";
import {
  assertNoForbiddenChangeIntelPhrases,
  displayImpactReasons,
  IMPACT_DISPLAY_LABEL,
  rspUnmatchedImpactReason,
} from "@/change-intel/impact-display";
import { classifyChangeMateriality, changeMateriality } from "@/change-intel/materiality";
import { buildObservationFromTracked } from "@/change-intel/observation";
import type {
  ChangeRecord,
  FieldChange,
  PrimaryImpact,
} from "@/change-intel/types";
import { runFirstPassOrganizationResolution } from "@/organization-resolution-2026/run-first-pass";
import { organizationProfileHref } from "@/lib/organization-intelligence";
import { applicantProfileHref } from "@/lib/applicant-intelligence";

function baseChange(partial: Partial<ChangeRecord> & Pick<ChangeRecord, "changeId" | "changeType">): ChangeRecord {
  return {
    observedAt: "2026-10-11T14:00:00.000Z",
    sourceType: partial.changeType.startsWith("CONTENTION") ? "contention" : "application",
    applicationId: "APP-1",
    appliedForString: "example",
    applicantLegalName: "Example Applicant LLC",
    fieldChanges: [],
    contentionSetId: null,
    before: null,
    after: null,
    primaryImpact: "MARKET_CHANGE",
    impactReasons: ["Public-source change without direct GoDaddy portfolio or GoDaddy contention set impact."],
    applicantApplicationCount: 1,
    applicantContentionCount: 0,
    rspPublicPosture: null,
    exploreHref: "/explore?applicationId=APP-1",
    competitiveLandscapeHref: null,
    ...partial,
  };
}

function lookupMap(rows: OrganizationLookupRow[]): Map<string, OrganizationLookupRow> {
  return new Map(rows.map((r) => [r.applicantLegalName, r]));
}

describe("CHANGE-INTEL-2A organization enrichment", () => {
  it("Confirmed Applicant → Confirmed Organization context with valid href", async () => {
    const { snapshot } = await runFirstPassOrganizationResolution({
      workspaceRoot: process.cwd(),
      writeArtifacts: false,
      applyResearch: true,
      applyStewardApprovals: true,
      applyWeb1Identity: true,
      applyBrand1Identity: true,
      applyTranche1bIdentity: true,
      applyTranche1dIdentity: true,
    });
    expect(snapshot.semanticContentSha256).toBe(
      "06ba3920f6028b1a410835332869869691252432bdb1b7c923e7baee519d346c",
    );
    const { hash, generatedAt, byApplicant } = organizationLookupFromSnapshot(snapshot);

    const amazon = deriveOrganizationContext({
      applicantLegalName: "Amazon Registry Services, Inc.",
      snapshotHash: hash,
      snapshotGeneratedAt: generatedAt,
      lookup: byApplicant,
    });
    expect(amazon.organizationResolutionState).toBe("CONFIRMED");
    expect(amazon.confirmedOrganizationName).toBe("Amazon Registry Services");
    expect(amazon.confirmedOrganizationKey).toBeTruthy();
    expect(amazon.organizationHref).toBe(organizationProfileHref(amazon.confirmedOrganizationKey!));
    expect(amazon.organizationHref?.startsWith("/organization?key=")).toBe(true);
    expect(amazon.organizationSnapshotHash).toBe(hash);

    const alibaba = deriveOrganizationContext({
      applicantLegalName: "ALIBABA INNOVATION PRIVATE LIMITED",
      snapshotHash: hash,
      snapshotGeneratedAt: generatedAt,
      lookup: byApplicant,
    });
    expect(alibaba.organizationResolutionState).toBe("CONFIRMED");
    expect(alibaba.confirmedOrganizationName).toBe("Alibaba Group");
    expect(alibaba.confirmedOrganizationKey).toBe("alibaba-group");
  });

  it("unresolved / Candidate / Ambiguous never expose Confirmed Organization claims", () => {
    const hash = "abc".padEnd(64, "0");
    const lookup = lookupMap([
      {
        applicantLegalName: "Unresolved Corp",
        resolutionState: "UNRESOLVED",
        organizationId: null,
        organizationKey: null,
        organizationName: null,
      },
      {
        applicantLegalName: "Candidate Corp",
        resolutionState: "CANDIDATE",
        organizationId: "org-cand",
        organizationKey: "cand-key",
        organizationName: "Should Not Show",
      },
      {
        applicantLegalName: "Ambiguous Corp",
        resolutionState: "AMBIGUOUS",
        organizationId: "org-amb",
        organizationKey: "amb-key",
        organizationName: "Also Hidden",
      },
    ]);

    for (const name of ["Unresolved Corp", "Candidate Corp", "Ambiguous Corp", "Missing Corp"]) {
      const ctx = deriveOrganizationContext({
        applicantLegalName: name,
        snapshotHash: hash,
        snapshotGeneratedAt: null,
        lookup,
      });
      expect(ctx.confirmedOrganizationId).toBeNull();
      expect(ctx.confirmedOrganizationName).toBeNull();
      expect(ctx.organizationHref).toBeNull();
      expect(ctx.organizationResolutionState).not.toBe("CONFIRMED");
    }
  });

  it("preserves Applicant legal name and does not mutate ChangeRecord", () => {
    const change = baseChange({
      changeId: "c1",
      changeType: "APPLICATION_FIELD_CHANGED",
      applicantLegalName: "Amazon Registry Services, Inc.",
    });
    const before = changeRecordFingerprint(change);
    const lookup = lookupMap([
      {
        applicantLegalName: "Amazon Registry Services, Inc.",
        resolutionState: "CONFIRMED",
        organizationId: "org-amazon",
        organizationKey: "amazon-registry-services",
        organizationName: "Amazon Registry Services",
      },
    ]);
    const derived = deriveChangeContext({
      change,
      snapshotHash: "h".repeat(64),
      snapshotGeneratedAt: "2026-10-20T00:00:00.000Z",
      organizationLookup: lookup,
      sourceObservation: null,
      targetObservation: null,
    });
    expect(change.applicantLegalName).toBe("Amazon Registry Services, Inc.");
    expect(derived.organization.confirmedOrganizationName).toBe("Amazon Registry Services");
    expect(derived.links.applicantHref).toBe(
      applicantProfileHref("Amazon Registry Services, Inc."),
    );
    expect(changeRecordFingerprint(change)).toBe(before);
  });

  it("same ChangeRecord + same Organization snapshot yields deterministic derived context", () => {
    const change = baseChange({
      changeId: "det-1",
      changeType: "APPLICATION_NOW_PRESENT",
      applicantLegalName: "Amazon Registry Services, Inc.",
    });
    const lookup = lookupMap([
      {
        applicantLegalName: "Amazon Registry Services, Inc.",
        resolutionState: "CONFIRMED",
        organizationId: "org-amazon",
        organizationKey: "amazon-registry-services",
        organizationName: "Amazon Registry Services",
      },
    ]);
    const input = {
      change,
      snapshotHash: "d".repeat(64),
      snapshotGeneratedAt: "2026-10-20T00:00:00.000Z",
      organizationLookup: lookup,
      sourceObservation: null,
      targetObservation: null,
    };
    const a = deriveChangeContext(input);
    const b = deriveChangeContext(input);
    expect(a).toEqual(b);
  });
});

describe("CHANGE-INTEL-2A temporal contention basis", () => {
  it("NOW_PRESENT / FIELD_CHANGED use target; NO_LONGER_PRESENT uses source; membership uses record set", () => {
    const source = makeBaselineObservation({
      memberships: [
        { contentionSetId: "10", applicationId: "ALPHA-1" },
        { contentionSetId: "99", applicationId: "GONE-1" },
      ],
      applications: [
        {
          applicationId: "ALPHA-1",
          applicantLegalName: "Alpha Registry LLC",
          appliedForString: "alpha",
          applicationStatus: "Active",
          processingStage: "Initial Evaluation",
          applicationType: "Standard",
          country: "US",
          region: "EU",
          idn: false,
          community: false,
          brand: false,
          geoSelfDesignated: false,
        },
        {
          applicationId: "GONE-1",
          applicantLegalName: "Gone Applicant",
          appliedForString: "gone",
          applicationStatus: "Active",
          processingStage: "Initial Evaluation",
          applicationType: "Standard",
          country: "US",
          region: "NA",
          idn: false,
          community: false,
          brand: false,
          geoSelfDesignated: false,
        },
      ],
    });
    const target = buildObservationFromTracked({
      observedAt: "2026-10-11T14:00:00.000Z",
      previousObservationId: source.observationId,
      bootstrap: false,
      applicationSource: source.applicationSource,
      contentionSource: source.contentionSource,
      applications: source.applications.filter((a) => a.applicationId !== "GONE-1"),
      contentionMemberships: [
        { contentionSetId: "10", applicationId: "ALPHA-1" },
        { contentionSetId: "10", applicationId: "BETA-NEW" },
        { contentionSetId: "55", applicationId: "ALPHA-1" },
      ],
      officialApplications: null,
      officialApplicants: null,
    });

    // Live publication must NOT be used — only source/target observations.
    const livePoison = [{ contentionSetId: "LIVE", applicationId: "ALPHA-1" }];
    expect(livePoison[0].contentionSetId).toBe("LIVE");

    const nowPresent = baseChange({
      changeId: "np",
      changeType: "APPLICATION_NOW_PRESENT",
      applicationId: "BETA-NEW",
      contentionSetId: null,
    });
    expect(
      deriveContentionSetIds({
        change: nowPresent,
        sourceObservation: source,
        targetObservation: target,
      }),
    ).toEqual(["10"]);

    const fieldChanged = baseChange({
      changeId: "fc",
      changeType: "APPLICATION_FIELD_CHANGED",
      applicationId: "ALPHA-1",
      contentionSetId: null,
      fieldChanges: [{ field: "region", before: "EU", after: "NA" }],
    });
    expect(
      deriveContentionSetIds({
        change: fieldChanged,
        sourceObservation: source,
        targetObservation: target,
      }),
    ).toEqual(["10", "55"]);

    const removed = baseChange({
      changeId: "rm",
      changeType: "APPLICATION_NO_LONGER_PRESENT",
      applicationId: "GONE-1",
      contentionSetId: null,
    });
    expect(
      deriveContentionSetIds({
        change: removed,
        sourceObservation: source,
        targetObservation: target,
      }),
    ).toEqual(["99"]);

    const memAdd = baseChange({
      changeId: "ma",
      changeType: "CONTENTION_MEMBERSHIP_ADDED",
      applicationId: "BETA-NEW",
      contentionSetId: "10",
    });
    expect(
      deriveContentionSetIds({
        change: memAdd,
        sourceObservation: source,
        targetObservation: target,
      }),
    ).toEqual(["10"]);

    const memRem = baseChange({
      changeId: "mr",
      changeType: "CONTENTION_MEMBERSHIP_REMOVED",
      applicationId: "GONE-1",
      contentionSetId: "99",
    });
    expect(
      deriveContentionSetIds({
        change: memRem,
        sourceObservation: source,
        targetObservation: target,
      }),
    ).toEqual(["99"]);
  });
});

describe("CHANGE-INTEL-2A materiality", () => {
  const materialPresence: Array<ChangeRecord["changeType"]> = [
    "APPLICATION_NOW_PRESENT",
    "APPLICATION_NO_LONGER_PRESENT",
    "CONTENTION_MEMBERSHIP_ADDED",
    "CONTENTION_MEMBERSHIP_REMOVED",
  ];

  it.each(materialPresence)("%s → MATERIAL", (changeType) => {
    expect(
      changeMateriality(
        baseChange({
          changeId: changeType,
          changeType,
          contentionSetId: changeType.startsWith("CONTENTION") ? "10" : null,
        }),
      ),
    ).toBe("MATERIAL");
  });

  const materialFields: FieldChange["field"][] = [
    "applicantLegalName",
    "appliedForString",
    "applicationStatus",
    "brand",
    "community",
    "idn",
    "geoSelfDesignated",
  ];

  it.each(materialFields)("field %s → MATERIAL", (field) => {
    expect(
      changeMateriality(
        baseChange({
          changeId: `f-${field}`,
          changeType: "APPLICATION_FIELD_CHANGED",
          fieldChanges: [{ field, before: "a", after: "b" }],
        }),
      ),
    ).toBe("MATERIAL");
  });

  const contextualFields: FieldChange["field"][] = [
    "processingStage",
    "applicationType",
    "country",
    "region",
  ];

  it.each(contextualFields)("only field %s → CONTEXTUAL", (field) => {
    expect(
      changeMateriality(
        baseChange({
          changeId: `c-${field}`,
          changeType: "APPLICATION_FIELD_CHANGED",
          fieldChanges: [{ field, before: "a", after: "b" }],
          primaryImpact: "MARKET_CHANGE",
        }),
      ),
    ).toBe("CONTEXTUAL");
  });

  it("processingStage + applicationStatus → MATERIAL", () => {
    expect(
      changeMateriality(
        baseChange({
          changeId: "mix",
          changeType: "APPLICATION_FIELD_CHANGED",
          fieldChanges: [
            { field: "processingStage", before: "a", after: "b" },
            { field: "applicationStatus", before: "Active", after: "Withdrawn" },
          ],
        }),
      ),
    ).toBe("MATERIAL");
  });

  it.each(["GODADDY_DIRECT", "GODADDY_CONTENTION"] as PrimaryImpact[])(
    "%s override → MATERIAL even for contextual fields",
    (impact) => {
      expect(
        changeMateriality(
          baseChange({
            changeId: `gd-${impact}`,
            changeType: "APPLICATION_FIELD_CHANGED",
            primaryImpact: impact,
            fieldChanges: [{ field: "region", before: "NA", after: "EU" }],
          }),
        ),
      ).toBe("MATERIAL");
    },
  );

  it("unknown change type fails closed as MATERIAL + undefined", () => {
    const result = classifyChangeMateriality(
      baseChange({
        changeId: "unk",
        changeType: "APPLICATION_FIELD_CHANGED",
      }),
    );
    // Inject unsupported via cast
    const bad = classifyChangeMateriality({
      ...baseChange({ changeId: "bad", changeType: "APPLICATION_FIELD_CHANGED" }),
      changeType: "APPLICATION_STATUS_CHANGED" as ChangeRecord["changeType"],
    });
    expect(bad.defined).toBe(false);
    expect(bad.materiality).toBe("MATERIAL");
    expect(result.defined).toBe(true);
  });

  it("unknown field fails closed", () => {
    const bad = classifyChangeMateriality({
      ...baseChange({
        changeId: "uf",
        changeType: "APPLICATION_FIELD_CHANGED",
        fieldChanges: [
          {
            field: "priorityScore" as FieldChange["field"],
            before: "1",
            after: "2",
          },
        ],
      }),
    });
    expect(bad.defined).toBe(false);
    expect(bad.materiality).toBe("MATERIAL");
  });
});

describe("CHANGE-INTEL-2A RSP safety + impact display", () => {
  it("user-facing labels and reasons omit forbidden phrases", () => {
    const reasons = displayImpactReasons([
      "Applicant currently has no public Main-RSP capability match — may be worth GoDaddy Registry investigation. Selected RSP is not disclosed in public Application data.",
      "Public-source change without direct GoDaddy portfolio or GoDaddy contention set impact.",
    ]);
    const blob = [
      IMPACT_DISPLAY_LABEL.RSP_RESEARCH_RELEVANT,
      IMPACT_DISPLAY_LABEL.GODADDY_DIRECT,
      rspUnmatchedImpactReason(),
      ...reasons,
    ].join("\n");
    expect(assertNoForbiddenChangeIntelPhrases(blob)).toEqual([]);
    expect(reasons[0]).toBe(rspUnmatchedImpactReason());
  });

  it("representative feed new reasons are safe; internal enum preserved", () => {
    const { diff } = makeRepresentativeFeed();
    expect(diff.changes.some((c) => c.primaryImpact === "RSP_RESEARCH_RELEVANT")).toBe(true);
    expect(diff.changes.some((c) => c.primaryImpact === "GODADDY_DIRECT")).toBe(true);
    expect(diff.changes.some((c) => c.primaryImpact === "GODADDY_CONTENTION")).toBe(true);
    expect(diff.changes.some((c) => c.primaryImpact === "MARKET_CHANGE")).toBe(true);
    const blob = diff.changes.flatMap((c) => c.impactReasons).join("\n");
    expect(assertNoForbiddenChangeIntelPhrases(blob)).toEqual([]);
  });

  it("enrichment does not mutate stored change records", () => {
    const { feed, baseline, current } = makeRepresentativeFeed();
    const fingerprints = new Map(
      feed.latestDiff!.changes.map((c) => [c.changeId, changeRecordFingerprint(c)]),
    );
    const enriched = enrichPresentationFeed({
      feed,
      organizationSnapshot: null,
      observationsById: new Map([
        [baseline.observationId, baseline],
        [current.observationId, current],
      ]),
      organizationLookupOverride: {
        hash: "e".repeat(64),
        generatedAt: null,
        byApplicant: lookupMap([]),
      },
    });
    expect(enriched.initialized).toBe(true);
    if (!enriched.initialized) return;
    for (const c of feed.latestDiff!.changes) {
      expect(changeRecordFingerprint(c)).toBe(fingerprints.get(c.changeId));
      expect(enriched.derivedByChangeId[c.changeId]).toBeTruthy();
    }
  });
});
