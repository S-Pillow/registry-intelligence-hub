/**
 * Pilot acquisition (offline dry-run + authorized pilot-live).
 *
 * Upstream evidence (AIPF 21.2F) informing the live path — no live ICANN contact
 * in this module's tests:
 * - Host Node: engines.node >=22; runtime may report v20.x. Fetch uses undici.
 * - Node/undici default redirect:"follow" does not expose intermediate Set-Cookie
 *   for session continuity; createNodeGtldresultFetcher uses redirect:"manual"
 *   and GtldresultSessionTransport validates each same-origin hop (max 5).
 * - ICANN route grammar matches portion-live-diagnostic: details GET →
 *   parseApplicationDetailsDownload → GET server-provided href only.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hostname } from "node:os";
import { RSP_ACQUISITION_LIMITS } from "./constants";
import {
  appendCheckpointEntry,
  createEmptyCheckpoint,
  isIdempotentSkip,
  readCheckpoint,
  writeCheckpoint,
} from "./checkpoint";
import {
  buildMappingByApplicationId,
  loadPilotManifest,
  loadPilotMapping,
  loadRspMappingArtifact,
  resolveGtldresultAcId,
} from "./load-manifest";
import { writeQuarantineRecord } from "./quarantine";
import { sha256Hex } from "@/normalization/hashes";
import { buildDetailsUrl, buildPortionUrl, buildPortionUrlPlaceholder } from "./urls";
import type { DryRunFetchPlan, DryRunReport, QuarantineReason } from "./types";
import { assertPilotLiveAuthGate } from "./auth-gates";
import { buildPortionFetchMetadata } from "./fetch-metadata-contract";
import { buildPreflightReport } from "./preflight-report";
import { assertLiveStagingOutsideWorkspace, defaultLiveStagingRoot } from "./staging-containment";
import { pilotMappingPath } from "./bundle-paths";
import {
  ApplicationDetailsDownloadError,
  parseApplicationDetailsDownload,
} from "./application-details-download";
import {
  createNodeGtldresultFetcher,
  defaultSleep,
  GtldresultSessionTransport,
  type GtldresultFetcher,
  type SleepFn,
} from "./gtldresult-session-transport";
import { NetworkTargetPolicyError } from "./network-target-policy";
import {
  PUBLIC_PORTION_VERSION_BASIS,
  validatePublicPortionDocument,
} from "./public-portion-validation";
import { classifyViewstatusPageHtml } from "./viewstatus-page-classification";

export interface AcquirePilotOptions {
  workspaceRoot: string;
  /** Staging root for downloads (live default is outside the repo). */
  stagingRoot?: string;
  batchId?: string;
  forceRefetch?: boolean;
  mappingArtifactPath?: string;
  /** Mapping-live run directory. Required before pilot-live HTTP on an APPROVED artifact. */
  evidenceIndexPath?: string;
  /** Injected sleep for pacing / backoff (tests use a no-op). */
  sleep?: SleepFn;
}

function stagingPortionPath(stagingRoot: string, applicationId: string): string {
  return join(stagingRoot, "sources/portions", applicationId, "public-portion.html");
}

function stagingMetadataPath(stagingRoot: string, applicationId: string): string {
  return join(stagingRoot, "sources/portions", applicationId, "fetch-metadata.json");
}

export async function buildDryRunReport(options: AcquirePilotOptions): Promise<DryRunReport> {
  const stagingRoot = options.stagingRoot ?? defaultLiveStagingRoot();
  const manifest = await loadPilotManifest(options.workspaceRoot);
  const mapping = await loadPilotMapping(options.workspaceRoot);
  const mappingByApp = buildMappingByApplicationId(mapping);

  const plans: DryRunFetchPlan[] = manifest.entries.map((entry) => {
    const acId = resolveGtldresultAcId(entry.applicationId, entry, mappingByApp);
    const mappingRequired = acId == null;
    const notes: string[] = [];
    if (mappingRequired) {
      notes.push("mapping required — gtldresultAcId not in pilot manifest or static mapping file");
    } else {
      notes.push(
        "live pilot-live discovers the public-portion URL from the application-details page; portionUrl below is planning-only and must not be fetched as a manufactured URL",
      );
    }
    return {
      applicationId: entry.applicationId,
      gtldresultAcId: acId,
      portionUrl: acId != null ? buildPortionUrl(acId) : buildPortionUrlPlaceholder(),
      detailsUrl: acId != null ? buildDetailsUrl(acId) : null,
      stagingPortionPath: stagingPortionPath(stagingRoot, entry.applicationId),
      stagingMetadataPath: stagingMetadataPath(stagingRoot, entry.applicationId),
      mappingRequired,
      notes,
    };
  });

  return {
    mode: "dry-run",
    authorized: false,
    limits: RSP_ACQUISITION_LIMITS,
    stagingRoot,
    plans,
  };
}

export function formatDryRunReport(report: DryRunReport): string {
  const lines: string[] = [
    "icann2012-rsp-acquisition dry-run (no HTTP)",
    `stagingRoot: ${report.stagingRoot}`,
    `pilotBatchSize: ${report.limits.pilotBatchSize}`,
    `maxApplicationsPerCalendarDay: ${report.limits.maxApplicationsPerCalendarDay}`,
    `minDelayMsBetweenGtldresultRequests: ${report.limits.minDelayMsBetweenGtldresultRequests}`,
    "",
  ];
  for (const plan of report.plans) {
    lines.push(`Application ID: ${plan.applicationId}`);
    lines.push(`  gtldresultAcId: ${plan.gtldresultAcId ?? "null"}`);
    lines.push(`  portionUrl: ${plan.portionUrl}`);
    if (plan.detailsUrl) lines.push(`  detailsUrl: ${plan.detailsUrl}`);
    lines.push(`  stagingPortionPath: ${plan.stagingPortionPath}`);
    lines.push(`  stagingMetadataPath: ${plan.stagingMetadataPath}`);
    if (plan.mappingRequired) lines.push("  flag: mapping required");
    for (const note of plan.notes) lines.push(`  note: ${note}`);
    lines.push("");
  }
  return lines.join("\n");
}

/** @deprecated Prefer GtldresultFetcher — kept for type compatibility during migration. */
export type HttpFetcher = (url: string) => Promise<{ status: number; body: Uint8Array }>;

export interface LiveAcquireResult {
  mode: "live";
  completed: string[];
  skipped: string[];
  quarantined: string[];
  /** Outbound ICANN request count (redirects counted separately inside transport). */
  httpRequestCount: number;
}

async function loadMappingForOperation(options: AcquirePilotOptions) {
  if (options.mappingArtifactPath) {
    return loadRspMappingArtifact(options.mappingArtifactPath);
  }
  return loadPilotMapping(options.workspaceRoot);
}

async function assertPilotLivePreflight(options: AcquirePilotOptions): Promise<void> {
  const artifactPath = options.mappingArtifactPath ?? pilotMappingPath(options.workspaceRoot);
  const report = await buildPreflightReport({
    workspaceRoot: options.workspaceRoot,
    operation: "pilot-live",
    stagingRoot: options.stagingRoot,
    mappingArtifactPath: artifactPath,
    evidenceIndexPath: options.evidenceIndexPath,
  });
  if (report.blockingReasons.length > 0) {
    throw new Error(`Pilot-live preflight blocked: ${report.blockingReasons.join("; ")}`);
  }
}

function mapDetailsDownloadError(err: ApplicationDetailsDownloadError): QuarantineReason {
  switch (err.code) {
    case "WRONG_APPLICATION_ID":
    case "MISSING_APPLICATION_ID":
      return "application-id-mismatch";
    case "MISSING_DOWNLOAD_LINK":
      return "missing-download-link";
    case "AMBIGUOUS_DOWNLOAD_LINK":
      return "ambiguous-download-link";
    case "CROSS_HOST_LINK":
      return "cross-host-link";
    case "NON_HTTPS_LINK":
      return "non-https-link";
    default: {
      const _exhaustive: never = err.code;
      return _exhaustive;
    }
  }
}

export async function acquirePilotPortions(
  options: AcquirePilotOptions,
): Promise<DryRunReport> {
  return buildDryRunReport(options);
}

/**
 * Authorized pilot-live: details-first discovery → server-provided public-portion
 * href → exact Application-ID + Q23 validation. Uses GtldresultSessionTransport
 * (same-origin redirects, in-memory cookies, paced requests). Never manufactures
 * a download URL via buildPortionUrl for live HTTP.
 */
export async function acquirePilotLivePortions(
  options: AcquirePilotOptions,
  fetcher: GtldresultFetcher = createNodeGtldresultFetcher(),
): Promise<LiveAcquireResult> {
  assertPilotLiveAuthGate();

  const stagingRoot = options.stagingRoot ?? defaultLiveStagingRoot();
  await assertLiveStagingOutsideWorkspace(stagingRoot, options.workspaceRoot);
  await assertPilotLivePreflight({ ...options, stagingRoot });

  const sleep = options.sleep ?? defaultSleep;
  const transport = new GtldresultSessionTransport(fetcher, sleep);
  let httpRequestCount = 0;
  const countGet = async (url: string) => {
    const response = await transport.get(url);
    httpRequestCount += 1 + (transport.getLastExchange()?.redirectCount ?? 0);
    return response;
  };

  const batchId = options.batchId ?? `pilot-${new Date().toISOString().slice(0, 10)}`;
  const manifest = await loadPilotManifest(options.workspaceRoot);
  const mapping = await loadMappingForOperation(options);
  const mappingByApp = buildMappingByApplicationId(mapping);

  const ckPath = join(stagingRoot, "acquisition-checkpoint.json");
  let checkpoint = (await readCheckpoint(ckPath)) ?? createEmptyCheckpoint(batchId);
  checkpoint = { ...checkpoint, batchId, runHost: hostname() };

  const completed: string[] = [];
  const skipped: string[] = [];
  const quarantined: string[] = [];

  const batch = manifest.entries.slice(0, RSP_ACQUISITION_LIMITS.pilotBatchSize);

  const quarantineApp = async (applicationId: string, reason: QuarantineReason, detail: string) => {
    await writeQuarantineRecord(join(stagingRoot, "quarantine"), applicationId, reason, detail);
    quarantined.push(applicationId);
  };

  for (let i = 0; i < batch.length; i++) {
    const entry = batch[i]!;
    const acId = resolveGtldresultAcId(entry.applicationId, entry, mappingByApp);
    if (acId == null) {
      await quarantineApp(
        entry.applicationId,
        "mapping-required",
        "gtldresultAcId missing from pilot manifest and static mapping",
      );
      continue;
    }

    const destPath = stagingPortionPath(stagingRoot, entry.applicationId);
    const metaPath = stagingMetadataPath(stagingRoot, entry.applicationId);

    if (!options.forceRefetch) {
      try {
        const existing = await readFile(destPath);
        const hash = sha256Hex(existing);
        if (isIdempotentSkip(checkpoint, entry.applicationId, hash)) {
          skipped.push(entry.applicationId);
          continue;
        }
      } catch {
        // no existing file
      }
    }

    const detailsUrl = buildDetailsUrl(acId);
    let details;
    try {
      details = await countGet(detailsUrl);
    } catch (err) {
      // 403/429 halt the entire run (transport throws Run halted).
      throw err;
    }

    // Pace after every outbound exchange, including failures classified below.
    await transport.waitBetweenRequests();

    if (details.status === 404) {
      await quarantineApp(
        entry.applicationId,
        "missing-public-portion",
        `HTTP 404 for details ${detailsUrl}`,
      );
      continue;
    }
    if (details.status < 200 || details.status >= 300) {
      await quarantineApp(
        entry.applicationId,
        "details-http-failed",
        `details HTTP ${details.status}`,
      );
      continue;
    }

    const detailsHtml = Buffer.from(details.body).toString("utf8");
    const detailsKind = classifyViewstatusPageHtml(detailsHtml);
    if (detailsKind === "ICANN_ERROR_PAGE") {
      await quarantineApp(
        entry.applicationId,
        "incomplete-portion-q23",
        "details page is ICANN_ERROR_PAGE",
      );
      continue;
    }
    if (detailsKind === "STATUS_GRID") {
      await quarantineApp(
        entry.applicationId,
        "incomplete-portion-q23",
        "details response is a status-grid hub",
      );
      continue;
    }

    let parsed;
    try {
      parsed = parseApplicationDetailsDownload(detailsHtml, {
        expectedApplicationId: entry.applicationId,
        detailsPageUrl: details.finalUrl || detailsUrl,
      });
    } catch (err) {
      if (err instanceof ApplicationDetailsDownloadError) {
        await quarantineApp(entry.applicationId, mapDetailsDownloadError(err), err.message);
        continue;
      }
      if (err instanceof NetworkTargetPolicyError) {
        await quarantineApp(entry.applicationId, "cross-host-link", err.message);
        continue;
      }
      throw err;
    }

    let portion;
    try {
      portion = await countGet(parsed.resolvedPortionUrl);
    } catch (err) {
      throw err;
    }
    await transport.waitBetweenRequests();

    if (portion.status === 404) {
      await quarantineApp(
        entry.applicationId,
        "missing-public-portion",
        `HTTP 404 for server-provided portion URL`,
      );
      continue;
    }
    if (portion.status < 200 || portion.status >= 300) {
      await quarantineApp(
        entry.applicationId,
        "transport-exhausted",
        `public portion HTTP ${portion.status}`,
      );
      continue;
    }

    const body = portion.body;
    if (body.byteLength > RSP_ACQUISITION_LIMITS.maxPortionBytes) {
      await quarantineApp(
        entry.applicationId,
        "oversize-response",
        `${body.byteLength} bytes exceeds cap ${RSP_ACQUISITION_LIMITS.maxPortionBytes}`,
      );
      continue;
    }

    const html = Buffer.from(body).toString("utf8");
    const portionKind = classifyViewstatusPageHtml(html);
    if (portionKind === "ICANN_ERROR_PAGE") {
      await quarantineApp(
        entry.applicationId,
        "incomplete-portion-q23",
        "public portion is ICANN_ERROR_PAGE",
      );
      continue;
    }
    if (portionKind === "STATUS_GRID") {
      await quarantineApp(
        entry.applicationId,
        "incomplete-portion-q23",
        "public portion response is a status-grid hub",
      );
      continue;
    }

    const validation = validatePublicPortionDocument(html, {
      expectedApplicationId: entry.applicationId,
    });
    if (!validation.ok) {
      // Retain bytes for steward forensics but do not checkpoint as completed.
      const hash = sha256Hex(body);
      await mkdir(join(stagingRoot, "sources/portions", entry.applicationId), { recursive: true });
      await writeFile(destPath, body);
      await writeFile(
        join(stagingRoot, "sources/portions", entry.applicationId, "public-portion.sha256"),
        `${hash}\n`,
      );
      const metadata = buildPortionFetchMetadata({
        applicationId: entry.applicationId,
        gtldresultAcId: acId,
        detailsUrl,
        serverProvidedHref: parsed.serverProvidedHref,
        resolvedUrl: parsed.resolvedPortionUrl,
        finalUrl: portion.finalUrl,
        httpStatus: portion.status,
        contentLength: body.byteLength,
        contentSha256: hash,
        retrievedAt: new Date().toISOString(),
        runId: batchId,
        applicationVersionBasis: PUBLIC_PORTION_VERSION_BASIS,
      });
      await writeFile(metaPath, `${JSON.stringify(metadata, null, 2)}\n`);
      await quarantineApp(
        entry.applicationId,
        validation.reason,
        `public-portion validation failed: ${validation.reason}`,
      );
      continue;
    }

    const hash = sha256Hex(body);
    const retrievedAt = new Date().toISOString();
    await mkdir(join(stagingRoot, "sources/portions", entry.applicationId), { recursive: true });
    await writeFile(destPath, body);
    await writeFile(
      join(stagingRoot, "sources/portions", entry.applicationId, "public-portion.sha256"),
      `${hash}\n`,
    );

    const metadata = buildPortionFetchMetadata({
      applicationId: entry.applicationId,
      gtldresultAcId: acId,
      detailsUrl,
      serverProvidedHref: parsed.serverProvidedHref,
      resolvedUrl: parsed.resolvedPortionUrl,
      finalUrl: portion.finalUrl,
      httpStatus: portion.status,
      contentLength: body.byteLength,
      contentSha256: hash,
      retrievedAt,
      runId: batchId,
      applicationVersionBasis: validation.applicationVersionBasis,
    });
    await writeFile(metaPath, `${JSON.stringify(metadata, null, 2)}\n`);

    // Checkpoint only after validated server-provided portion + exact Application ID + Q23.
    checkpoint = appendCheckpointEntry(checkpoint, {
      applicationId: entry.applicationId,
      contentSha256: hash,
      completedAt: retrievedAt,
      gtldresultAcId: acId,
    });
    await writeCheckpoint(ckPath, checkpoint);
    completed.push(entry.applicationId);
  }

  return { mode: "live", completed, skipped, quarantined, httpRequestCount };
}
