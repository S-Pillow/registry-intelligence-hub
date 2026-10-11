import type { BrowserApplicationV2 } from "@/lib/registry-applications-document-v2";
import type { Registry2026ApplicationV2 } from "@/reveal-day-2026/publication-v2-types";
import type { TrackedApplicationFields } from "@/change-intel/types";

export const TRACKED_APPLICATION_FIELD_KEYS = [
  "applicantLegalName",
  "appliedForString",
  "applicationStatus",
  "processingStage",
  "applicationType",
  "country",
  "region",
  "idn",
  "community",
  "brand",
  "geoSelfDesignated",
] as const satisfies ReadonlyArray<keyof Omit<TrackedApplicationFields, "applicationId">>;

export function trackedFieldsFromBrowserApp(app: BrowserApplicationV2): TrackedApplicationFields {
  return {
    applicationId: app.applicationId,
    applicantLegalName: app.applicant,
    appliedForString: app.appliedString.label,
    applicationStatus: app.applicationStatus,
    processingStage: app.processingStage,
    applicationType: app.applicationType,
    country: app.country,
    region: app.region,
    idn: Boolean(app.designations.idn),
    community: Boolean(app.designations.community),
    brand: Boolean(app.designations.brand),
    geoSelfDesignated: Boolean(app.designations.geoSelfDesignated),
  };
}

export function trackedFieldsFromPublicationApp(
  app: Registry2026ApplicationV2,
): TrackedApplicationFields {
  return {
    applicationId: app.applicationId,
    applicantLegalName: app.applicant,
    appliedForString: app.appliedString.label,
    applicationStatus: app.applicationStatus,
    processingStage: app.processingStage,
    applicationType: app.applicationType,
    country: app.country,
    region: app.region,
    idn: Boolean(app.designations.idn),
    community: Boolean(app.designations.community),
    brand: Boolean(app.designations.brand),
    geoSelfDesignated: Boolean(app.designations.geoSelfDesignated),
  };
}

export function sortTrackedApplications(
  apps: TrackedApplicationFields[],
): TrackedApplicationFields[] {
  return [...apps].sort((a, b) => a.applicationId.localeCompare(b.applicationId));
}
