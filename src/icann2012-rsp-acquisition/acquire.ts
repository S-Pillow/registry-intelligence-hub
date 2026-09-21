import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hostname } from "node:os";
import {
  checkpointPath,
  rspFixtureRoot,
} from "./bundle-paths";
import {
  RSP_ACQUISITION_AUTH_ENV,
  RSP_ACQUISITION_LIMITS,
  RETRY_BACKOFF_MS,
} from "./constants";
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
  resolveGtldresultAcId,
} from "./load-manifest";
import { validatePortionHtml, writeQuarantineRecord } from "./quarantine";
import { sha256Hex } from "@/normalization/hashes";
import { buildDetailsUrl, buildPortionUrl, buildPortionUrlPlaceholder } from "./urls";
import type { DryRunFetchPlan, DryRunReport } from "./types";

export function isAcquisitionAuthorized(): boolean {
  return process.env[RSP_ACQUISITION_AUTH_ENV] === "1";
}

export interface AcquirePilotOptions {
  workspaceRoot: string;
  /** Staging root for downloads (defaults to bundle fixture root). */
  stagingRoot?: string;
  batchId?: string;
  forceRefetch?: boolean;
}

function stagingPortionPath(stagingRoot: string, applicationId: string): string {
  return join(stagingRoot, "sources/portions", applicationId, "public-portion.html");
}

function stagingMetadataPath(stagingRoot: string, applicationId: string): string {
  return join(stagingRoot, "sources/portions", applicationId, "fetch-metadata.json");
}

export async function buildDryRunReport(options: AcquirePilotOptions): Promise<DryRunReport> {
  const stagingRoot = options.stagingRoot ?? rspFixtureRoot(options.workspaceRoot);
  const manifest = await loadPilotManifest(options.workspaceRoot);
  const mapping = await loadPilotMapping(options.workspaceRoot);
  const mappingByApp = buildMappingByApplicationId(mapping);

  const plans: DryRunFetchPlan[] = manifest.entries.map((entry) => {
    const acId = resolveGtldresultAcId(entry.applicationId, entry, mappingByApp);
    const mappingRequired = acId == null;
    const notes: string[] = [];
    if (mappingRequired) {
      notes.push("mapping required — gtldresultAcId not in pilot manifest or static mapping file");
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

export type HttpFetcher = (url: string) => Promise<{ status: number; body: Uint8Array }>;

async function defaultFetcher(url: string): Promise<{ status: number; body: Uint8Array }> {
  const response = await fetch(url, {
    headers: { Accept: "text/html,*/*" },
  });
  const body = new Uint8Array(await response.arrayBuffer());
  return { status: response.status, body };
}

export interface LiveAcquireResult {
  mode: "live";
  completed: string[];
  skipped: string[];
  quarantined: string[];
}

export async function acquirePilotPortions(
  options: AcquirePilotOptions,
  fetcher: HttpFetcher = defaultFetcher,
): Promise<DryRunReport | LiveAcquireResult> {
  if (!isAcquisitionAuthorized()) {
    return buildDryRunReport(options);
  }

  const stagingRoot = options.stagingRoot ?? rspFixtureRoot(options.workspaceRoot);
  const batchId = options.batchId ?? `pilot-${new Date().toISOString().slice(0, 10)}`;
  const manifest = await loadPilotManifest(options.workspaceRoot);
  const mapping = await loadPilotMapping(options.workspaceRoot);
  const mappingByApp = buildMappingByApplicationId(mapping);

  const ckPath = checkpointPath(stagingRoot);
  let checkpoint = (await readCheckpoint(ckPath)) ?? createEmptyCheckpoint(batchId);
  checkpoint = { ...checkpoint, batchId, runHost: hostname() };

  const completed: string[] = [];
  const skipped: string[] = [];
  const quarantined: string[] = [];

  const batch = manifest.entries.slice(0, RSP_ACQUISITION_LIMITS.pilotBatchSize);

  for (const entry of batch) {
    const acId = resolveGtldresultAcId(entry.applicationId, entry, mappingByApp);
    if (acId == null) {
      await writeQuarantineRecord(
        join(stagingRoot, "quarantine"),
        entry.applicationId,
        "mapping-required",
        "gtldresultAcId missing from pilot manifest and static mapping",
      );
      quarantined.push(entry.applicationId);
      continue;
    }

    const portionUrl = buildPortionUrl(acId);
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

    let lastStatus = 0;
    let body: Uint8Array | null = null;
    for (let attempt = 0; attempt < RSP_ACQUISITION_LIMITS.maxRetriesPerUrl; attempt++) {
      const result = await fetcher(portionUrl);
      lastStatus = result.status;
      if (result.status === 429 || result.status === 403) {
        throw new Error(`Run halted: HTTP ${result.status} on ${entry.applicationId}`);
      }
      if (result.status === 404) {
        await writeQuarantineRecord(
          join(stagingRoot, "quarantine"),
          entry.applicationId,
          "missing-public-portion",
          `HTTP 404 for ${portionUrl}`,
        );
        quarantined.push(entry.applicationId);
        body = null;
        break;
      }
      if (result.status >= 500) {
        const delay = RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)];
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (result.status >= 200 && result.status < 300) {
        body = result.body;
        break;
      }
    }

    if (body == null) {
      if (!quarantined.includes(entry.applicationId)) {
        await writeQuarantineRecord(
          join(stagingRoot, "quarantine"),
          entry.applicationId,
          "transport-exhausted",
          `Failed after retries (last HTTP ${lastStatus})`,
        );
        quarantined.push(entry.applicationId);
      }
      continue;
    }

    if (body.byteLength > RSP_ACQUISITION_LIMITS.maxPortionBytes) {
      await writeQuarantineRecord(
        join(stagingRoot, "quarantine"),
        entry.applicationId,
        "oversize-response",
        `${body.byteLength} bytes exceeds cap ${RSP_ACQUISITION_LIMITS.maxPortionBytes}`,
      );
      quarantined.push(entry.applicationId);
      continue;
    }

    const html = Buffer.from(body).toString("utf8");
    const qCheck = validatePortionHtml(html);
    const hash = sha256Hex(body);

    await mkdir(join(stagingRoot, "sources/portions", entry.applicationId), { recursive: true });
    await writeFile(destPath, body);
    await writeFile(join(stagingRoot, "sources/portions", entry.applicationId, "public-portion.sha256"), `${hash}\n`);

    const metadata = {
      applicationId: entry.applicationId,
      gtldresultAcId: acId,
      resolvedUrl: portionUrl,
      contentLength: body.byteLength,
      contentSha256: hash,
      retrievedAt: new Date().toISOString(),
    };
    await writeFile(metaPath, `${JSON.stringify(metadata, null, 2)}\n`);

    if (!qCheck.ok) {
      await writeQuarantineRecord(
        join(stagingRoot, "quarantine"),
        entry.applicationId,
        qCheck.reason,
        "Retained raw bytes; Q23 anchor missing",
      );
      quarantined.push(entry.applicationId);
    }

    checkpoint = appendCheckpointEntry(checkpoint, {
      applicationId: entry.applicationId,
      contentSha256: hash,
      completedAt: metadata.retrievedAt,
      gtldresultAcId: acId,
    });
    await writeCheckpoint(ckPath, checkpoint);
    completed.push(entry.applicationId);

    await new Promise((r) => setTimeout(r, RSP_ACQUISITION_LIMITS.minDelayMsBetweenGtldresultRequests));
  }

  return { mode: "live", completed, skipped, quarantined };
}
