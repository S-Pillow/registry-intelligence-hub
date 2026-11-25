import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  buildForecastUnits,
  FORECAST_V1_EXAMPLE_STRINGS,
  isConfirmedClosedBrandUnit,
  type ForecastUnit,
} from "@/lib/registration-forecast";
import {
  isBrowserApplicationPayloadDocumentV2,
  type RegistryApplicationsDocumentV2,
} from "@/lib/registry-applications-document-v2";
import { isValidLdhLabel, normalizeAsciiLabel } from "./match";
import {
  SuffixDemandCounterError,
  type CandidateMode,
  type CandidateProvenance,
  type ObservedCandidateRecord,
  type ObservedStringOrigin,
  type UnmeasuredCandidate,
} from "./types";

export type { CandidateMode, CandidateProvenance };

export type ResolvedCandidates = {
  /** Labels included in suffix-demand matching / aggregate counts. */
  eligibleLabels: string[];
  /** Forecast units for applications-document-v2; empty for observed/example modes. */
  eligibleUnits: ForecastUnit[];
  observedCandidates: ObservedCandidateRecord[];
  unmeasuredCandidates: UnmeasuredCandidate[];
  provenance: CandidateProvenance;
};

/**
 * Prototype / lightweight mode: FORECAST_V1_EXAMPLE_STRINGS only.
 * Must not be treated as a complete 2026 round inventory.
 */
export function resolveExampleListCandidates(
  overrides?: readonly string[],
): ResolvedCandidates {
  const labels = normalizeLabelList(overrides ?? FORECAST_V1_EXAMPLE_STRINGS);
  return {
    eligibleLabels: labels,
    eligibleUnits: [],
    observedCandidates: labels.map((stringLabel) => ({
      stringLabel,
      origins: ["applied-string"] as ObservedStringOrigin[],
      sourceApplicationIds: [],
      brandDesignationObserved: null,
      contestedObserved: null,
      fromNormalizedApplication: false,
      fromKnownExcluded: false,
    })),
    unmeasuredCandidates: [],
    provenance: {
      mode: "example-list",
      applicationsDocumentPath: null,
      snapshotId: null,
      snapshotContentHash: null,
      publishedAt: null,
      payloadMode: null,
      documentSha256: null,
      totalForecastUnits: labels.length,
      eligibleCandidateCount: labels.length,
      brandExcludedCount: 0,
      brandExcludedLabels: [],
      applicationCensusCoverage: {
        status: "not-applicable",
        completeness: null,
        observedApplicationRecords: null,
        officialApplications: null,
        knownExcludedRecordCount: null,
        assertsCompleteRoundInventory: false,
      },
      note:
        "Candidate list is FORECAST_V1_EXAMPLE_STRINGS (prototype examples only). Not an authoritative full-round 2026 inventory.",
    },
  };
}

/**
 * Derive one eligible demand candidate per unique selected/current string from
 * an authoritative RegistryApplicationsDocumentV2 artifact.
 *
 * Reuses buildForecastUnits (selected replacements, withdrawn/unresolved skip,
 * contested dedupe by string). Confirmed Brand-designated strings are excluded
 * from counting via the existing Brand proxy — not proof of a closed registration policy.
 */
export function resolveCandidatesFromApplicationsDocument(
  document: RegistryApplicationsDocumentV2,
  options: {
    applicationsDocumentPath: string;
    documentSha256: string;
  },
): ResolvedCandidates {
  const units = buildForecastUnits(document);
  const brandExcluded = units.filter((u) => isConfirmedClosedBrandUnit(u));
  const eligibleUnits = units.filter((u) => !isConfirmedClosedBrandUnit(u));
  const eligibleLabels = eligibleUnits.map((u) => u.stringLabel);

  if (!eligibleLabels.length) {
    throw new SuffixDemandCounterError(
      "Applications document produced zero eligible forecast strings after Brand exclusion",
      [`snapshotId=${document.snapshotId}`],
    );
  }

  const cov = document.applicationRecordCoverage;
  return {
    eligibleLabels,
    eligibleUnits,
    observedCandidates: [],
    unmeasuredCandidates: [],
    provenance: {
      mode: "applications-document-v2",
      applicationsDocumentPath: options.applicationsDocumentPath,
      snapshotId: document.snapshotId,
      snapshotContentHash: document.snapshotContentHash,
      publishedAt: document.publishedAt ?? null,
      payloadMode: document.payloadMode ?? null,
      documentSha256: options.documentSha256,
      totalForecastUnits: units.length,
      eligibleCandidateCount: eligibleLabels.length,
      brandExcludedCount: brandExcluded.length,
      brandExcludedLabels: brandExcluded.map((u) => u.stringLabel),
      applicationCensusCoverage: {
        status: cov?.completeness === "complete" ? "complete-asserted" : "partial-observed",
        completeness: cov?.completeness ?? null,
        observedApplicationRecords: document.observedApplicationRecords ?? null,
        officialApplications: document.officialApplications ?? null,
        knownExcludedRecordCount: (document.knownExcludedRecords ?? []).length,
        assertsCompleteRoundInventory: false,
      },
      note:
        "Candidates derived from RegistryApplicationsDocumentV2 via buildForecastUnits. Brand-designation exclusion is a proxy only and does not prove a closed registration policy. Contested strings contribute one demand count per unique selected/current label.",
    },
  };
}

/**
 * Observed proposed-string demand inventory (RIH-FCAST-04B).
 *
 * Collects distinct DNS-identity labels from appliedString.label,
 * replacementString.label, and knownExcludedRecords.primaryString (including WDO).
 * Does not filter by Brand, contention, withdrawal, or selection status.
 * Does not assert a complete 2026 round inventory.
 */
export function resolveObservedProposedStringCandidates(
  document: RegistryApplicationsDocumentV2,
  options: {
    applicationsDocumentPath: string;
    documentSha256: string;
  },
): ResolvedCandidates {
  type Acc = {
    origins: Set<ObservedStringOrigin>;
    sourceApplicationIds: Set<string>;
    brandSeen: Set<boolean>;
    contestedSeen: Set<boolean>;
    fromNormalizedApplication: boolean;
    fromKnownExcluded: boolean;
  };

  const byLabel = new Map<string, Acc>();
  const unmeasured: UnmeasuredCandidate[] = [];
  const unmeasuredKeys = new Set<string>();

  const addUnmeasured = (
    rawLabel: string,
    reason: string,
    origin: ObservedStringOrigin,
    applicationId: string | null,
  ) => {
    const key = `${rawLabel}::${reason}`;
    if (unmeasuredKeys.has(key)) return;
    unmeasuredKeys.add(key);
    unmeasured.push({
      rawLabel,
      reason,
      origins: [origin],
      sourceApplicationIds: applicationId ? [applicationId] : [],
    });
  };

  const ingest = (
    rawLabel: string | null | undefined,
    origin: ObservedStringOrigin,
    applicationId: string | null,
    brand: boolean | null,
    contested: boolean | null,
    fromNormalizedApplication: boolean,
    fromKnownExcluded: boolean,
  ) => {
    if (rawLabel == null) return;
    const trimmed = String(rawLabel).trim();
    if (!trimmed) return;

    const dns = toMeasurableDnsIdentity(trimmed);
    if (!dns.ok) {
      addUnmeasured(trimmed, dns.reason, origin, applicationId);
      return;
    }

    const entry = byLabel.get(dns.label) ?? {
      origins: new Set<ObservedStringOrigin>(),
      sourceApplicationIds: new Set<string>(),
      brandSeen: new Set<boolean>(),
      contestedSeen: new Set<boolean>(),
      fromNormalizedApplication: false,
      fromKnownExcluded: false,
    };
    entry.origins.add(origin);
    if (applicationId) entry.sourceApplicationIds.add(applicationId);
    if (brand === true || brand === false) entry.brandSeen.add(brand);
    if (contested === true || contested === false) entry.contestedSeen.add(contested);
    entry.fromNormalizedApplication =
      entry.fromNormalizedApplication || fromNormalizedApplication;
    entry.fromKnownExcluded = entry.fromKnownExcluded || fromKnownExcluded;
    byLabel.set(dns.label, entry);
  };

  for (const app of document.applications ?? []) {
    const appId = typeof app.applicationId === "string" ? app.applicationId : null;
    const brand = app.designations?.brand === true;
    const contested = app.officialContention?.membershipPresent === true;

    ingest(
      app.appliedString?.label,
      "applied-string",
      appId,
      brand,
      contested,
      true,
      false,
    );
    ingest(
      app.replacementString?.label,
      "replacement-string",
      appId,
      brand,
      contested,
      true,
      false,
    );
  }

  const excluded = document.knownExcludedRecords ?? [];
  for (const row of excluded) {
    const appId =
      row && typeof row === "object" && typeof (row as { applicationId?: unknown }).applicationId === "string"
        ? (row as { applicationId: string }).applicationId
        : null;
    const primary =
      row && typeof row === "object"
        ? (row as { primaryString?: unknown }).primaryString
        : null;
    // Brand / contention unknown for coverage-only descriptors — leave null.
    ingest(
      typeof primary === "string" ? primary : null,
      "known-excluded-primary-string",
      appId,
      null,
      null,
      false,
      true,
    );
  }

  const observedCandidates: ObservedCandidateRecord[] = [...byLabel.entries()]
    .map(([stringLabel, entry]) => {
      let brandDesignationObserved: boolean | null = null;
      if (entry.brandSeen.size === 1) brandDesignationObserved = [...entry.brandSeen][0]!;
      else if (entry.brandSeen.size > 1) brandDesignationObserved = true; // any true observation wins as "observed true somewhere"
      // If only known-excluded (no brandSeen), remains null.

      let contestedObserved: boolean | null = null;
      if (entry.contestedSeen.has(true)) contestedObserved = true;
      else if (entry.contestedSeen.size === 1 && entry.contestedSeen.has(false)) {
        contestedObserved = false;
      }

      return {
        stringLabel,
        origins: [...entry.origins].sort() as ObservedStringOrigin[],
        sourceApplicationIds: [...entry.sourceApplicationIds].sort(),
        brandDesignationObserved:
          entry.fromKnownExcluded && entry.brandSeen.size === 0
            ? null
            : brandDesignationObserved,
        contestedObserved:
          entry.fromKnownExcluded && entry.contestedSeen.size === 0
            ? null
            : contestedObserved,
        fromNormalizedApplication: entry.fromNormalizedApplication,
        fromKnownExcluded: entry.fromKnownExcluded,
      };
    })
    .sort((a, b) => a.stringLabel.localeCompare(b.stringLabel));

  const eligibleLabels = observedCandidates.map((c) => c.stringLabel);
  if (!eligibleLabels.length) {
    throw new SuffixDemandCounterError(
      "Observed proposed-string mode produced zero measurable DNS labels",
      [`snapshotId=${document.snapshotId}`],
    );
  }

  const cov = document.applicationRecordCoverage;
  const brandTrue = observedCandidates.filter((c) => c.brandDesignationObserved === true).length;
  const brandUnknown = observedCandidates.filter((c) => c.brandDesignationObserved === null).length;

  return {
    eligibleLabels,
    eligibleUnits: [],
    observedCandidates,
    unmeasuredCandidates: unmeasured.sort((a, b) => a.rawLabel.localeCompare(b.rawLabel)),
    provenance: {
      mode: "observed-proposed-strings",
      applicationsDocumentPath: options.applicationsDocumentPath,
      snapshotId: document.snapshotId,
      snapshotContentHash: document.snapshotContentHash,
      publishedAt: document.publishedAt ?? null,
      payloadMode: document.payloadMode ?? null,
      documentSha256: options.documentSha256,
      totalForecastUnits: eligibleLabels.length,
      eligibleCandidateCount: eligibleLabels.length,
      brandExcludedCount: 0,
      brandExcludedLabels: [],
      applicationCensusCoverage: {
        status: cov?.completeness === "complete" ? "complete-asserted" : "partial-observed",
        completeness: cov?.completeness ?? null,
        observedApplicationRecords: document.observedApplicationRecords ?? null,
        officialApplications: document.officialApplications ?? null,
        knownExcludedRecordCount: excluded.length,
        assertsCompleteRoundInventory: false,
      },
      observedInventory: {
        measurableCount: eligibleLabels.length,
        unmeasuredCount: unmeasured.length,
        fromNormalizedApplicationCount: observedCandidates.filter((c) => c.fromNormalizedApplication)
          .length,
        fromKnownExcludedCount: observedCandidates.filter((c) => c.fromKnownExcluded).length,
        brandDesignationObservedTrueCount: brandTrue,
        brandDesignationUnknownCount: brandUnknown,
        origins: {
          appliedString: observedCandidates.filter((c) => c.origins.includes("applied-string"))
            .length,
          replacementString: observedCandidates.filter((c) =>
            c.origins.includes("replacement-string"),
          ).length,
          knownExcludedPrimaryString: observedCandidates.filter((c) =>
            c.origins.includes("known-excluded-primary-string"),
          ).length,
        },
      },
      unmeasuredCandidates: unmeasured,
      note:
        "Observed proposed-string inventory from appliedString.label, replacementString.label, and knownExcludedRecords.primaryString (including WDO coverage descriptors). Brand/contention/withdrawal/selection status do not suppress demand measurement. Does not assert a complete 2026 round application census. Partial coverage (e.g. 1614/1615) is retained honestly.",
    },
  };
}

export async function loadCandidatesFromApplicationsDocumentPath(
  path: string,
  mode: Extract<CandidateMode, "applications-document-v2" | "observed-proposed-strings"> =
    "applications-document-v2",
): Promise<ResolvedCandidates> {
  let raw: Buffer;
  try {
    raw = await readFile(path);
  } catch (err) {
    throw new SuffixDemandCounterError(
      mode === "observed-proposed-strings"
        ? "Applications document is unavailable — refusing observed-proposed-strings mode"
        : "Authoritative 2026 applications document is unavailable — refusing complete-inventory mode",
      [path, err instanceof Error ? err.message : String(err)],
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch (err) {
    throw new SuffixDemandCounterError(
      "Applications document is invalid JSON — fail closed",
      [path, err instanceof Error ? err.message : String(err)],
    );
  }

  if (!isBrowserApplicationPayloadDocumentV2(parsed)) {
    throw new SuffixDemandCounterError(
      "Applications document failed RegistryApplicationsDocumentV2 validation — fail closed",
      [
        path,
        "Expected payloadVersion 2.0 browser document with snapshotId, snapshotContentHash, and applications[]",
      ],
    );
  }

  const documentSha256 = createHash("sha256").update(raw).digest("hex");
  if (mode === "observed-proposed-strings") {
    return resolveObservedProposedStringCandidates(parsed, {
      applicationsDocumentPath: path,
      documentSha256,
    });
  }
  return resolveCandidatesFromApplicationsDocument(parsed, {
    applicationsDocumentPath: path,
    documentSha256,
  });
}

/**
 * Convert a source label to a measurable ActiveDNS-matching DNS identity.
 * Accepts ASCII LDH and A-labels (xn--…). Unicode without an A-label is unmeasured.
 */
export function toMeasurableDnsIdentity(
  raw: string,
): { ok: true; label: string } | { ok: false; reason: string } {
  const normalized = normalizeAsciiLabel(raw);
  if (!normalized) {
    // Non-ASCII / empty after trim — try to detect unicode
    const trimmed = raw.trim();
    if (!trimmed) return { ok: false, reason: "empty-label" };
    if (!/^[\x00-\x7f]*$/.test(trimmed)) {
      return {
        ok: false,
        reason: "unicode-label-without-a-label-equivalent",
      };
    }
    return { ok: false, reason: "unnormalizable-label" };
  }
  if (!isValidLdhLabel(normalized) && !normalized.includes("--")) {
    // Single-label LDH check; xn-- A-labels may be longer / contain --
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized) || normalized.length > 63) {
      return { ok: false, reason: "invalid-ldh-or-a-label" };
    }
  }
  // A-labels and ordinary LDH labels for SLD matching
  if (normalized.length > 63) {
    return { ok: false, reason: "label-exceeds-63-octets" };
  }
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(normalized)) {
    return { ok: false, reason: "invalid-ldh-or-a-label" };
  }
  return { ok: true, label: normalized };
}

function normalizeLabelList(labels: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of labels) {
    const normalized = normalizeAsciiLabel(raw);
    if (!normalized) {
      throw new SuffixDemandCounterError(`Invalid candidate string: ${JSON.stringify(raw)}`);
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  if (!out.length) {
    throw new SuffixDemandCounterError("Candidate string list is empty");
  }
  return out;
}
