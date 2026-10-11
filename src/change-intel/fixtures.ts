import { GODADDY_FOCAL_APPLICANT_LEGAL_NAME } from "@/lib/participant-intelligence";
import { deriveDiff } from "@/change-intel/derive-diff";
import { buildObservationFromTracked } from "@/change-intel/observation";
import type {
  ChangeIntelDiff,
  ChangeIntelFeed,
  ChangeIntelObservation,
  ContentionMembershipKey,
  TrackedApplicationFields,
} from "@/change-intel/types";
import { CHANGE_INTEL_FEED_VERSION } from "@/change-intel/types";
import type { ApplicantRspPosture } from "@/lib/rsp-opportunity-intelligence";

function app(
  partial: Partial<TrackedApplicationFields> & Pick<TrackedApplicationFields, "applicationId" | "applicantLegalName" | "appliedForString">,
): TrackedApplicationFields {
  return {
    applicationStatus: "Active",
    processingStage: "Initial Evaluation",
    applicationType: "Standard",
    country: "US",
    region: "NA",
    idn: false,
    community: false,
    brand: false,
    geoSelfDesignated: false,
    ...partial,
  };
}

export function makeBaselineObservation(overrides?: {
  observedAt?: string;
  applications?: TrackedApplicationFields[];
  memberships?: ContentionMembershipKey[];
}): ChangeIntelObservation {
  const applications = overrides?.applications ?? [
    app({
      applicationId: "GODADDY-1",
      applicantLegalName: GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
      appliedForString: "godaddy",
    }),
    app({
      applicationId: "GODADDY-2",
      applicantLegalName: GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
      appliedForString: "secure",
    }),
    app({
      applicationId: "ALPHA-1",
      applicantLegalName: "Alpha Registry LLC",
      appliedForString: "alpha",
      region: "EU",
    }),
    app({
      applicationId: "BETA-1",
      applicantLegalName: "Beta Names Inc",
      appliedForString: "beta",
    }),
    app({
      applicationId: "LARGE-1",
      applicantLegalName: "Large NoRsp Applicant Corp",
      appliedForString: "largeone",
    }),
    app({
      applicationId: "LARGE-2",
      applicantLegalName: "Large NoRsp Applicant Corp",
      appliedForString: "largetwo",
    }),
    app({
      applicationId: "LARGE-3",
      applicantLegalName: "Large NoRsp Applicant Corp",
      appliedForString: "largethree",
    }),
    app({
      applicationId: "SELF-1",
      applicantLegalName: "Charleston Road Registry, Inc.",
      appliedForString: "selfrsp",
    }),
    app({
      applicationId: "MARKET-1",
      applicantLegalName: "Market Only Applicant Ltd",
      appliedForString: "market",
      region: "AP",
    }),
  ];
  const memberships = overrides?.memberships ?? [
    { contentionSetId: "10", applicationId: "GODADDY-1" },
    { contentionSetId: "10", applicationId: "ALPHA-1" },
    { contentionSetId: "20", applicationId: "BETA-1" },
  ];
  return buildObservationFromTracked({
    observedAt: overrides?.observedAt ?? "2026-10-10T18:00:00.000Z",
    previousObservationId: null,
    bootstrap: true,
    applicationSource: {
      sourceUrl: "fixture://applications.csv",
      contentSha256: "a".repeat(64),
      retrievedAt: overrides?.observedAt ?? "2026-10-10T18:00:00.000Z",
      recordCount: applications.length,
      semanticHash: "a".repeat(64),
    },
    contentionSource: {
      sourceUrl: "fixture://contention.csv",
      contentSha256: "b".repeat(64),
      retrievedAt: overrides?.observedAt ?? "2026-10-10T18:00:00.000Z",
      recordCount: memberships.length,
      semanticHash: "b".repeat(64),
    },
    applications,
    contentionMemberships: memberships,
    officialApplications: 1615,
    officialApplicants: 481,
  });
}

function rspPosture(
  name: string,
  posture: ApplicantRspPosture["rspProspectingPosture"],
  applicationCount: number,
): ApplicantRspPosture {
  return {
    applicantLegalName: name,
    applicationCount,
    contestedApplications: 0,
    contentionRate: 0,
    contentionSetsTouched: 0,
    region: ["NA"],
    organizationMappingStatus: "UNRESOLVED",
    confirmedOrganizationName: null,
    evaluatedMainRspStatus: posture === "PUBLIC_MAIN_RSP_CAPABILITY_FOUND" ? "CLEARED" : "NOT_MATCHED",
    evaluatedMainRspMatchBasis: posture === "PUBLIC_MAIN_RSP_CAPABILITY_FOUND" ? "EXACT_LEGAL_NAME" : "NONE",
    evaluatedRspLegalName: null,
    evaluatedRspDba: null,
    evaluatedRspCapabilities: null,
    evaluatedRspRecordLastUpdated: null,
    godaddyOwnApplicant: name === GODADDY_FOCAL_APPLICANT_LEGAL_NAME,
    rspProspectingPosture: posture,
    rspProspectingReason: "fixture",
  };
}

/** Representative fixture covering GoDaddy direct/contention, RSP research, self-RSP, market. */
export function makeRepresentativeFeed(): {
  baseline: ChangeIntelObservation;
  current: ChangeIntelObservation;
  diff: ChangeIntelDiff;
  feed: ChangeIntelFeed;
  zeroChangeFeed: ChangeIntelFeed;
} {
  const baseline = makeBaselineObservation();
  const currentApps = baseline.applications.map((a) => {
    if (a.applicationId === "GODADDY-1") {
      return { ...a, processingStage: "String Confirmation" };
    }
    if (a.applicationId === "MARKET-1") {
      return { ...a, region: "EU" };
    }
    if (a.applicationId === "SELF-1") {
      return { ...a, applicationStatus: "Active" };
    }
    if (a.applicationId === "LARGE-1") {
      return { ...a, processingStage: "Initial Evaluation Updated" };
    }
    return a;
  });
  // Counterpart joins GoDaddy set
  const memberships: ContentionMembershipKey[] = [
    ...baseline.contentionMemberships,
    { contentionSetId: "10", applicationId: "BETA-1" },
  ];
  const current = buildObservationFromTracked({
    observedAt: "2026-10-11T14:00:00.000Z",
    previousObservationId: baseline.observationId,
    bootstrap: false,
    applicationSource: {
      ...baseline.applicationSource,
      contentSha256: "c".repeat(64),
      retrievedAt: "2026-10-11T14:00:00.000Z",
      semanticHash: "c".repeat(64),
    },
    contentionSource: {
      ...baseline.contentionSource,
      contentSha256: "d".repeat(64),
      retrievedAt: "2026-10-11T14:00:00.000Z",
      recordCount: memberships.length,
      semanticHash: "d".repeat(64),
    },
    applications: currentApps,
    contentionMemberships: memberships,
    officialApplications: 1615,
    officialApplicants: 481,
  });

  const rspByApplicant = new Map<string, ApplicantRspPosture>([
    [GODADDY_FOCAL_APPLICANT_LEGAL_NAME, rspPosture(GODADDY_FOCAL_APPLICANT_LEGAL_NAME, "GODADDY_OWN_APPLICANT_PORTFOLIO", 2)],
    ["Alpha Registry LLC", rspPosture("Alpha Registry LLC", "NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND", 1)],
    ["Beta Names Inc", rspPosture("Beta Names Inc", "NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND", 1)],
    ["Large NoRsp Applicant Corp", rspPosture("Large NoRsp Applicant Corp", "NO_PUBLIC_MAIN_RSP_CAPABILITY_FOUND", 3)],
    ["Charleston Road Registry, Inc.", rspPosture("Charleston Road Registry, Inc.", "PUBLIC_MAIN_RSP_CAPABILITY_FOUND", 1)],
    ["Market Only Applicant Ltd", rspPosture("Market Only Applicant Ltd", "PUBLIC_MAIN_RSP_CAPABILITY_FOUND", 1)],
  ]);

  const diff = deriveDiff({ previous: baseline, current, rspByApplicant });

  const feed: ChangeIntelFeed = {
    version: CHANGE_INTEL_FEED_VERSION,
    initialized: true,
    lastCheckedAt: current.observedAt,
    lastMeaningfulChangeAt: current.observedAt,
    currentObservationId: current.observationId,
    previousObservationId: baseline.observationId,
    comparedWithObservedAt: baseline.observedAt,
    latestDiff: diff,
    recentMeaningfulDiffs: [diff],
    applicationSource: current.applicationSource,
    contentionSource: current.contentionSource,
  };

  const zeroDiff = deriveDiff({
    previous: current,
    current: {
      ...current,
      observationId: `${current.observationId}-nocheck`,
      observedAt: "2026-10-11T16:00:00.000Z",
      previousObservationId: current.observationId,
      applicationSource: {
        ...current.applicationSource,
        retrievedAt: "2026-10-11T16:00:00.000Z",
      },
      contentionSource: {
        ...current.contentionSource,
        retrievedAt: "2026-10-11T16:00:00.000Z",
      },
    },
    rspByApplicant,
  });

  const zeroChangeFeed: ChangeIntelFeed = {
    ...feed,
    lastCheckedAt: "2026-10-11T16:00:00.000Z",
    latestDiff: zeroDiff,
    recentMeaningfulDiffs: [diff],
    comparedWithObservedAt: current.observedAt,
  };

  return { baseline, current, diff, feed, zeroChangeFeed };
}
