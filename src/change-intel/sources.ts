import { readFile } from "node:fs/promises";
import { parseAndNormalizeApsApplicationCsv } from "@/reveal-day-2026/aps-application-csv";
import { parseAndNormalizeApsContentionCsv } from "@/reveal-day-2026/aps-contention-csv";
import {
  hashContentionMemberships,
  hashTrackedApplications,
  sha256Hex,
} from "@/change-intel/hash";
import { membershipsFromContentionSets } from "@/change-intel/observation";
import { trackedFieldsFromPublicationApp } from "@/change-intel/tracked-fields";
import type { SourceArtifactMeta } from "@/change-intel/types";
import type { ContentionSetV1 } from "@/reveal-day-2026/contention-membership-types";
import type { Registry2026ApplicationV2 } from "@/reveal-day-2026/publication-v2-types";

/** Public APS Applications surface (Download CSV lives here). */
export const APS_APPLICATIONS_PAGE_URL = "https://newgtldprogram-aps.icann.org/applications";

/** Official APS frontend config — publishes current `restBackendUrl`. */
export const APS_CONFIG_URL = "https://newgtldprogram-aps.icann.org/api/config";

/**
 * Path suffix appended to `restBackendUrl` for the official Application CSV export.
 * The UI issues POST (not GET) to this path; a bare GET historically 404s.
 */
export const APS_APPLICATION_EXPORT_PATH = "/applications/export/csv";

/**
 * Public ICANN Reveal Day contention CSV link (may 301 to the durable file URL).
 * Prefer this published link over hard-coding the final file path alone.
 */
export const APS_CONTENTION_CSV_URL =
  "https://newgtldprogram.icann.org/en/application-rounds/round2/reveal-day-contention-sets.csv";

/** @deprecated Legacy GET path — not the current Download CSV contract. Kept for tests/errors only. */
export const APS_APPLICATION_CSV_URL =
  "https://newgtldprogram-aps.icann.org/aps/applications/export/csv";

/** Empty-filter export body matching the APS frontend `bs()` / `RS()` contract. */
export const APS_APPLICATION_EXPORT_BODY = {
  searchAndFilter: {},
  sort: { field: "primaryString", direction: "ASC" },
  pagination: { pageSize: 10, pageNum: 0 },
} as const;

const DEFAULT_UA = "RIH-ChangeIntel/1.0 (+https://forgeforward.app; registry-intelligence-hub)";
const FETCH_TIMEOUT_MS = 120_000;

export type AcquiredNormalizedSources = {
  applications: Registry2026ApplicationV2[];
  contentionSets: ContentionSetV1[];
  applicationSource: SourceArtifactMeta;
  contentionSource: SourceArtifactMeta;
  observedDistinctApplicantNames: number;
  officialContentionSets: number;
  officialContentionMemberships: number;
  /** Requested Application export URL before redirects (POST target). */
  applicationRequestedUrl: string;
  /** Requested contention URL before redirects. */
  contentionRequestedUrl: string;
};

export type ApsAppConfig = {
  restBackendUrl: string;
};

export type FetchLike = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

function looksLikeHtml(bytes: Uint8Array, contentType: string | null): boolean {
  const type = (contentType ?? "").toLowerCase();
  if (type.includes("text/html") || type.includes("application/xhtml")) return true;
  const head = Buffer.from(bytes.subarray(0, 64)).toString("utf8").trimStart().toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html");
}

function looksLikeCsv(bytes: Uint8Array, contentType: string | null): boolean {
  const type = (contentType ?? "").toLowerCase();
  if (type.includes("text/csv") || type.includes("application/csv")) return true;
  // APS export may return text/csv;charset=UTF-8 or omit type; sniff BOM/header.
  const head = Buffer.from(bytes.subarray(0, 200)).toString("utf8");
  const stripped = head.replace(/^\uFEFF/, "");
  return (
    stripped.includes("Application ID")
    || stripped.includes("Applied-for string")
    || stripped.startsWith('"Please note:')
    || stripped.startsWith("Priority,")
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  fetchImpl: FetchLike,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

export async function locateApplicationExportUrl(
  fetchImpl: FetchLike = fetch,
  configUrl: string = APS_CONFIG_URL,
): Promise<{ restBackendUrl: string; exportUrl: string; configUrl: string }> {
  let response: Response;
  try {
    response = await fetchWithTimeout(
      configUrl,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": DEFAULT_UA,
        },
      },
      fetchImpl,
    );
  } catch (error) {
    throw new Error(
      `APPLICATION_SOURCE_LOCATOR_FAILED: config fetch error ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `APPLICATION_SOURCE_LOCATOR_FAILED: config HTTP ${response.status} from ${configUrl}`,
    );
  }
  let config: ApsAppConfig;
  try {
    config = (await response.json()) as ApsAppConfig;
  } catch (error) {
    throw new Error(
      `APPLICATION_SOURCE_LOCATOR_FAILED: config JSON parse failed (${error instanceof Error ? error.message : String(error)})`,
    );
  }
  const restBackendUrl = typeof config.restBackendUrl === "string" ? config.restBackendUrl.trim() : "";
  if (!restBackendUrl.startsWith("https://")) {
    throw new Error("APPLICATION_SOURCE_LOCATOR_FAILED: restBackendUrl missing or invalid");
  }
  const exportUrl = `${restBackendUrl.replace(/\/$/, "")}${APS_APPLICATION_EXPORT_PATH}`;
  return { restBackendUrl, exportUrl, configUrl };
}

export async function fetchApplicationCsvBytes(input: {
  exportUrl: string;
  fetchImpl?: FetchLike;
  body?: unknown;
}): Promise<{ bytes: Uint8Array; requestedUrl: string; finalUrl: string; contentType: string | null }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const requestedUrl = input.exportUrl;
  let response: Response;
  try {
    response = await fetchWithTimeout(
      requestedUrl,
      {
        method: "POST",
        headers: {
          Accept: "text/csv,application/octet-stream,*/*",
          "Content-Type": "application/json",
          "User-Agent": DEFAULT_UA,
          Origin: "https://newgtldprogram-aps.icann.org",
          Referer: APS_APPLICATIONS_PAGE_URL,
        },
        body: JSON.stringify(input.body ?? APS_APPLICATION_EXPORT_BODY),
      },
      fetchImpl,
    );
  } catch (error) {
    throw new Error(
      `APPLICATION_FETCH_FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get("content-type");
  const finalUrl = response.url || requestedUrl;
  if (!response.ok) {
    throw new Error(
      `APPLICATION_FETCH_FAILED: HTTP ${response.status} from ${finalUrl}`,
    );
  }
  if (bytes.byteLength === 0) {
    throw new Error("APPLICATION_NON_CSV_RESPONSE: empty body");
  }
  if (looksLikeHtml(bytes, contentType) || !looksLikeCsv(bytes, contentType)) {
    throw new Error(
      `APPLICATION_NON_CSV_RESPONSE: content-type=${contentType ?? "none"} finalUrl=${finalUrl}`,
    );
  }
  return { bytes, requestedUrl, finalUrl, contentType };
}

export async function fetchContentionCsvBytes(input: {
  url: string;
  fetchImpl?: FetchLike;
}): Promise<{ bytes: Uint8Array; requestedUrl: string; finalUrl: string; contentType: string | null }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const requestedUrl = input.url;
  let response: Response;
  try {
    response = await fetchWithTimeout(
      requestedUrl,
      {
        method: "GET",
        headers: {
          Accept: "text/csv,*/*",
          "User-Agent": DEFAULT_UA,
        },
      },
      fetchImpl,
    );
  } catch (error) {
    throw new Error(
      `CONTENTION_FETCH_FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = response.headers.get("content-type");
  const finalUrl = response.url || requestedUrl;
  if (!response.ok) {
    throw new Error(
      `CONTENTION_FETCH_FAILED: HTTP ${response.status} from ${finalUrl}`,
    );
  }
  if (bytes.byteLength === 0) {
    throw new Error(
      `CONTENTION_NON_CSV_RESPONSE: empty body after redirects (requested=${requestedUrl} final=${finalUrl})`,
    );
  }
  if (looksLikeHtml(bytes, contentType) || !looksLikeCsv(bytes, contentType)) {
    throw new Error(
      `CONTENTION_NON_CSV_RESPONSE: content-type=${contentType ?? "none"} finalUrl=${finalUrl}`,
    );
  }
  return { bytes, requestedUrl, finalUrl, contentType };
}

async function readFileBytes(pathOrUrl: string): Promise<{
  bytes: Uint8Array;
  sourceUrl: string;
  retrievedAt: string;
}> {
  const retrievedAt = new Date().toISOString();
  const bytes = new Uint8Array(await readFile(pathOrUrl));
  return { bytes, sourceUrl: pathOrUrl, retrievedAt };
}

export async function acquireNormalizedSources(input: {
  applicationPathOrUrl?: string;
  contentionPathOrUrl?: string;
  mode: "file" | "fetch";
  fetchImpl?: FetchLike;
}): Promise<AcquiredNormalizedSources> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const retrievedAt = new Date().toISOString();

  let appBytes: Uint8Array;
  let appRequestedUrl: string;
  let appFinalUrl: string;
  let contBytes: Uint8Array;
  let contRequestedUrl: string;
  let contFinalUrl: string;

  if (input.mode === "file") {
    if (!input.applicationPathOrUrl || !input.contentionPathOrUrl) {
      throw new Error("APPLICATION_FETCH_FAILED: file mode requires application and contention paths");
    }
    try {
      const app = await readFileBytes(input.applicationPathOrUrl);
      appBytes = app.bytes;
      appRequestedUrl = app.sourceUrl;
      appFinalUrl = app.sourceUrl;
    } catch (error) {
      throw new Error(
        `APPLICATION_FETCH_FAILED: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    try {
      const cont = await readFileBytes(input.contentionPathOrUrl);
      contBytes = cont.bytes;
      contRequestedUrl = cont.sourceUrl;
      contFinalUrl = cont.sourceUrl;
    } catch (error) {
      throw new Error(
        `CONTENTION_FETCH_FAILED: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } else {
    const exportUrl =
      input.applicationPathOrUrl
      ?? (await locateApplicationExportUrl(fetchImpl)).exportUrl;
    const app = await fetchApplicationCsvBytes({ exportUrl, fetchImpl });
    appBytes = app.bytes;
    appRequestedUrl = app.requestedUrl;
    appFinalUrl = app.finalUrl;

    const contentionUrl = input.contentionPathOrUrl ?? APS_CONTENTION_CSV_URL;
    const cont = await fetchContentionCsvBytes({ url: contentionUrl, fetchImpl });
    contBytes = cont.bytes;
    contRequestedUrl = cont.requestedUrl;
    contFinalUrl = cont.finalUrl;
  }

  let appParsed;
  let contParsed;
  try {
    appParsed = parseAndNormalizeApsApplicationCsv(appBytes);
  } catch (error) {
    throw new Error(
      `APPLICATION_VALIDATION_FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  try {
    contParsed = parseAndNormalizeApsContentionCsv(contBytes);
  } catch (error) {
    throw new Error(
      `CONTENTION_VALIDATION_FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const appRawHash = sha256Hex(appBytes);
  const contRawHash = sha256Hex(contBytes);
  const tracked = appParsed.applications.map(trackedFieldsFromPublicationApp);
  const memberships = membershipsFromContentionSets(contParsed.contentionSets);
  const appSemantic = hashTrackedApplications(tracked);
  const contSemantic = hashContentionMemberships(memberships);
  const membershipCount = memberships.length;

  return {
    applications: appParsed.applications,
    contentionSets: contParsed.contentionSets,
    observedDistinctApplicantNames: appParsed.observedDistinctApplicantNames,
    officialContentionSets: contParsed.contentionSets.length,
    officialContentionMemberships: membershipCount,
    applicationRequestedUrl: appRequestedUrl,
    contentionRequestedUrl: contRequestedUrl,
    applicationSource: {
      sourceUrl: appFinalUrl,
      contentSha256: appRawHash,
      retrievedAt,
      recordCount: appParsed.applications.length,
      semanticHash: appSemantic,
    },
    contentionSource: {
      sourceUrl: contFinalUrl,
      contentSha256: contRawHash,
      retrievedAt,
      recordCount: membershipCount,
      semanticHash: contSemantic,
    },
  };
}
