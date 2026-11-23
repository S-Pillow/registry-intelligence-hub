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
import { normalizeAsciiLabel } from "./match";
import {
  SuffixDemandCounterError,
  type CandidateMode,
  type CandidateProvenance,
} from "./types";

export type { CandidateMode, CandidateProvenance };

export type ResolvedCandidates = {
  /** Labels included in suffix-demand matching / aggregate counts. */
  eligibleLabels: string[];
  /** Full units for eligible labels (deterministic string order). */
  eligibleUnits: ForecastUnit[];
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
    eligibleUnits: labels.map((stringLabel) => ({
      stringLabel,
      unicodeLabel: null,
      applicantCount: 0,
      applicantLegalNames: [],
      applicationIds: [],
      brandApplicationCount: 0,
      contested: false,
      officialContentionSetIds: [],
      compoundWordCandidate: stringLabel.length >= 3,
    })),
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

  return {
    eligibleLabels,
    eligibleUnits,
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
      note:
        "Candidates derived from RegistryApplicationsDocumentV2 via buildForecastUnits. Brand-designation exclusion is a proxy only and does not prove a closed registration policy. Contested strings contribute one demand count per unique selected/current label.",
    },
  };
}

export async function loadCandidatesFromApplicationsDocumentPath(
  path: string,
): Promise<ResolvedCandidates> {
  let raw: Buffer;
  try {
    raw = await readFile(path);
  } catch (err) {
    throw new SuffixDemandCounterError(
      "Authoritative 2026 applications document is unavailable — refusing complete-inventory mode",
      [path, err instanceof Error ? err.message : String(err)],
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch (err) {
    throw new SuffixDemandCounterError(
      "Authoritative 2026 applications document is invalid JSON — fail closed",
      [path, err instanceof Error ? err.message : String(err)],
    );
  }

  if (!isBrowserApplicationPayloadDocumentV2(parsed)) {
    throw new SuffixDemandCounterError(
      "Authoritative 2026 applications document failed RegistryApplicationsDocumentV2 validation — fail closed",
      [
        path,
        "Expected payloadVersion 2.0 browser document with snapshotId, snapshotContentHash, and applications[]",
      ],
    );
  }

  const documentSha256 = createHash("sha256").update(raw).digest("hex");
  return resolveCandidatesFromApplicationsDocument(parsed, {
    applicationsDocumentPath: path,
    documentSha256,
  });
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
