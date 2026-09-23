import { mkdir, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import { sha256Hex } from "@/normalization/hashes";
import { assertMappingLiveAuthGate } from "./auth-gates";
import {
  stagingIndexPageFetchMetadataPath,
  stagingIndexPageHtmlPath,
  stagingIndexRunDir,
  stagingMappingArtifactPath,
} from "./bundle-paths";
import {
  loadRevealDayApplicationIds,
  reconcileCanonicalMapping,
} from "./canonical-reconciliation";
import { RSP_ACQUISITION_LIMITS, GTLDRESULT_PATHS, RSP_BUNDLE_ID } from "./constants";
import { buildIndexPageFetchMetadata } from "./fetch-metadata-contract";
import {
  GtldresultSessionTransport,
  createNodeGtldresultFetcher,
  defaultSleep,
  type GtldresultFetcher,
  type SleepFn,
} from "./gtldresult-session-transport";
import { buildMappingLivePreflightReport } from "./mapping-live-preflight";
import {
  assertResumePageIntegrity,
  createEmptyMappingLiveCheckpoint,
  mappingLiveCheckpointPath,
  readMappingLiveCheckpoint,
  writeMappingLiveCheckpoint,
} from "./mapping-checkpoint";
import { resolveGtldresultTapestryUrl } from "./gtldresult-url-resolver";
import { absoluteGtldresultUrl } from "./urls";
import {
  classifyViewstatusPageHtml,
  isRejectableNonGridPage,
} from "./viewstatus-page-classification";
import { mergeGridRowsIntoMapping, parseViewstatusGridHtml } from "./viewstatus-parser";
import {
  assertPaginationAdvance,
  buildViewstatusPageDiagnostics,
  createPaginationSafetyState,
  PaginationSafetyError,
} from "./viewstatus-page-meta";
import type {
  MappingLiveCheckpoint,
  MappingLiveResult,
  Registry2012RspMappingArtifact,
} from "./types";
import { assertLiveStagingOutsideWorkspace, defaultLiveStagingRoot } from "./staging-containment";
import {
  isMappingLiveOperatorCancellation,
  MappingLiveOperatorCancellation,
} from "./mapping-live-operator-cancellation";
import {
  archiveCheckpointForForceNewRun,
  validateForceNewRunFlags,
} from "./mapping-live-force-new-run";
import { assertNormalFirstRunNoCollision } from "./mapping-live-first-run-guard";
import type { ForceNewRunDisposition } from "./types";

export { MappingLiveOperatorCancellation };
export type { ForceNewRunDisposition } from "./types";

export interface MappingLiveOptions {
  workspaceRoot: string;
  stagingRoot?: string;
  runId?: string;
  resume?: boolean;
  forceNewRun?: boolean;
  /** Injectable for tests — defaults to ISO timestamp. */
  forceNewRunArchivedAt?: string;
  /** Injectable for tests — production uses paced gtldresult delays. */
  sleep?: SleepFn;
}

function snapshotIdForPage(runId: string, pageOrdinal: number, contentSha256: string): string {
  return `snap-index-${runId}-p${String(pageOrdinal).padStart(4, "0")}-${contentSha256.slice(0, 12)}`;
}

function resolveNextPageUrl(contextUrl: string, nextHref: string | null): string | null {
  if (!nextHref) return null;
  return resolveGtldresultTapestryUrl(contextUrl, nextHref);
}

export function buildMappingArtifactFromCheckpoint(
  checkpoint: MappingLiveCheckpoint,
): Registry2012RspMappingArtifact {
  const pageByOrdinal = new Map(checkpoint.pages.map((p) => [p.pageOrdinal, p]));
  const entries = Object.entries(checkpoint.mappings)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([applicationId, gtldresultAcId]) => {
      const pageOrdinal = checkpoint.applicationPageOrdinal[applicationId] ?? 1;
      const page = pageByOrdinal.get(pageOrdinal) ?? checkpoint.pages[0];
      if (!page) {
        throw new Error(`Missing page evidence for ${applicationId}`);
      }
      return {
        applicationId,
        gtldresultAcId,
        mappingSourceClass: "STATUS_GRID" as const,
        evidenceSnapshotId: page.snapshotId,
        sourceUrl: page.resolvedUrl,
        evidenceContentSha256: page.contentSha256,
      };
    });

  return {
    mappingVersion: "registry-2012-rsp-mapping/1.0.0",
    artifactPurpose: "EVIDENCE",
    approvalState: "DRAFT",
    bundleId: RSP_BUNDLE_ID,
    scope: "ROUND_WIDE_EXACT",
    entries,
  };
}

async function finalizeMappingLiveRun(input: {
  stagingRoot: string;
  runId: string;
  ckPath: string;
  checkpoint: MappingLiveCheckpoint;
  reconciliation: ReturnType<typeof reconcileCanonicalMapping>;
  stoppedEarly: boolean;
  stopReason?: string;
  forceNewRunDisposition?: ForceNewRunDisposition;
}): Promise<MappingLiveResult> {
  const artifact = buildMappingArtifactFromCheckpoint(input.checkpoint);
  const artifactPath = stagingMappingArtifactPath(input.stagingRoot, input.runId);
  await mkdir(artifactPath.replace(/mapping\.json$/, ""), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

  input.checkpoint.state = input.reconciliation.exact ? "completed" : "failed";
  if (!input.reconciliation.exact) {
    input.checkpoint.stopReason =
      input.stopReason ?? "incomplete canonical reconciliation — DRAFT not production eligible";
  }
  await writeMappingLiveCheckpoint(input.ckPath, input.checkpoint);

  return {
    mode: "mapping-live",
    runId: input.runId,
    stagingRoot: input.stagingRoot,
    pagesFetched: input.checkpoint.pages.length,
    reconciliation: input.reconciliation,
    exact: input.reconciliation.exact,
    approvalState: "DRAFT",
    artifactPurpose: "EVIDENCE",
    mappingArtifactPath: artifactPath,
    checkpointPath: input.ckPath,
    stoppedEarly: input.stoppedEarly,
    stopReason: input.stopReason,
    forceNewRunDisposition: input.forceNewRunDisposition,
  };
}

export async function runMappingLive(
  options: MappingLiveOptions,
  fetcher: GtldresultFetcher = createNodeGtldresultFetcher(),
): Promise<MappingLiveResult> {
  assertMappingLiveAuthGate();

  const stagingRoot = options.stagingRoot ?? defaultLiveStagingRoot();
  await assertLiveStagingOutsideWorkspace(stagingRoot, options.workspaceRoot);

  const preflight = await buildMappingLivePreflightReport({
    workspaceRoot: options.workspaceRoot,
    stagingRoot,
  });
  if (preflight.blockingReasons.length > 0) {
    throw new Error(`Mapping-live preflight blocked: ${preflight.blockingReasons.join("; ")}`);
  }

  validateForceNewRunFlags({
    resume: options.resume === true,
    forceNewRun: options.forceNewRun === true,
  });

  const runId = options.runId ?? `mapping-${new Date().toISOString().slice(0, 10)}-${hostname()}`;

  await assertNormalFirstRunNoCollision({
    stagingRoot,
    runId,
    resume: options.resume === true,
    forceNewRun: options.forceNewRun === true,
  });
  const ckPath = mappingLiveCheckpointPath(stagingRoot);
  const corpusHash = APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH;
  const expectedIds = await loadRevealDayApplicationIds(options.workspaceRoot);

  let forceNewRunDisposition: ForceNewRunDisposition | undefined;
  const existingForForceNew = options.forceNewRun
    ? await readMappingLiveCheckpoint(ckPath)
    : null;
  if (options.forceNewRun && existingForForceNew) {
    forceNewRunDisposition = await archiveCheckpointForForceNewRun({
      stagingRoot,
      priorCheckpoint: existingForForceNew,
      archivedAtIso: options.forceNewRunArchivedAt ?? new Date().toISOString(),
    });
  }

  let checkpoint: MappingLiveCheckpoint | null = null;
  if (options.resume && !options.forceNewRun) {
    checkpoint = await readMappingLiveCheckpoint(ckPath);
    if (checkpoint) {
      if (checkpoint.corpusContentHash !== corpusHash) {
        throw new Error("Resume rejected: corpus content hash pin mismatch");
      }
      if (options.runId && checkpoint.runId !== options.runId) {
        throw new Error("Resume rejected: runId mismatch (no silent overwrite)");
      }
      for (const page of checkpoint.pages) {
        const htmlPath = stagingIndexPageHtmlPath(stagingRoot, checkpoint.runId, page.pageOrdinal);
        await assertResumePageIntegrity(htmlPath, page.contentSha256);
      }
    }
  }

  if (!checkpoint) {
    checkpoint = createEmptyMappingLiveCheckpoint(runId, corpusHash);
  }

  const transport = new GtldresultSessionTransport(fetcher, options.sleep ?? defaultSleep);
  transport.clearSession();
  await transport.get(absoluteGtldresultUrl(GTLDRESULT_PATHS.statusHub));

  const paginationState = createPaginationSafetyState();
  for (const page of checkpoint.pages) {
    paginationState.visitedUrls.add(page.resolvedUrl);
    paginationState.visitedContentHashes.add(page.contentSha256);
    if (page.diagnostics.displayEnd != null) {
      paginationState.lastDisplayEnd = page.diagnostics.displayEnd;
    }
  }

  const mappings = new Map<string, number>(Object.entries(checkpoint.mappings));
  const applicationPageOrdinal: Record<string, number> = {
    ...checkpoint.applicationPageOrdinal,
  };

  let currentUrl: string | null = null;
  if (checkpoint.lastCompletedPageOrdinal === 0) {
    currentUrl = absoluteGtldresultUrl(GTLDRESULT_PATHS.viewStatusGrid);
  } else {
    const lastPage = checkpoint.pages.find(
      (p) => p.pageOrdinal === checkpoint!.lastCompletedPageOrdinal,
    );
    currentUrl = resolveNextPageUrl(
      lastPage?.resolvedUrl ?? absoluteGtldresultUrl(GTLDRESULT_PATHS.viewStatusGrid),
      lastPage?.diagnostics.nextPageHref ?? null,
    );
  }

  if (checkpoint.lastCompletedPageOrdinal > 0 && currentUrl == null) {
    const reconciliation = reconcileCanonicalMapping(expectedIds, mappings);
    return finalizeMappingLiveRun({
      stagingRoot,
      runId: checkpoint.runId,
      ckPath,
      checkpoint,
      reconciliation,
      stoppedEarly: false,
      forceNewRunDisposition,
    });
  }

  let stoppedEarly = false;
  let stopReason: string | undefined;
  let pageOrdinal = checkpoint.lastCompletedPageOrdinal;

  await mkdir(stagingIndexRunDir(stagingRoot, checkpoint.runId), { recursive: true });

  try {
    while (currentUrl != null) {
      pageOrdinal += 1;
      const response = await transport.get(currentUrl);
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Unexpected HTTP ${response.status} for ${currentUrl}`);
      }

      const contentSha256 = sha256Hex(response.body);
      const html = Buffer.from(response.body).toString("utf8");
      const pageKind = classifyViewstatusPageHtml(html);
      if (isRejectableNonGridPage(pageKind)) {
        const rejectDiagnostics = {
          ...buildViewstatusPageDiagnostics(html, 0, 0),
          pageKind,
        };
        const rejectSnapshotId = snapshotIdForPage(checkpoint.runId, pageOrdinal, contentSha256);
        const rejectHtmlPath = stagingIndexPageHtmlPath(stagingRoot, checkpoint.runId, pageOrdinal);
        const rejectMetaPath = stagingIndexPageFetchMetadataPath(
          stagingRoot,
          checkpoint.runId,
          pageOrdinal,
        );
        await writeFile(rejectHtmlPath, response.body);
        const rejectMetadata = buildIndexPageFetchMetadata({
          pageOrdinal,
          resolvedUrl: currentUrl,
          finalUrl: response.finalUrl,
          httpStatus: response.status,
          contentType: response.headers["content-type"],
          contentLength: response.body.byteLength,
          contentSha256,
          retrievedAt: new Date().toISOString(),
          runId: checkpoint.runId,
          displayStart: rejectDiagnostics.displayStart,
          displayEnd: rejectDiagnostics.displayEnd,
          displayTotal: rejectDiagnostics.displayTotal,
          parsedRowCount: rejectDiagnostics.parsedRowCount,
          quarantinedBlockCount: rejectDiagnostics.quarantinedBlockCount,
          nextPageHref: rejectDiagnostics.nextPageHref,
        });
        await writeFile(rejectMetaPath, `${JSON.stringify(rejectMetadata, null, 2)}\n`);
        checkpoint.pages = [
          ...checkpoint.pages.filter((p) => p.pageOrdinal !== pageOrdinal),
          {
            pageOrdinal,
            snapshotId: rejectSnapshotId,
            contentSha256,
            resolvedUrl: currentUrl,
            diagnostics: rejectDiagnostics,
          },
        ];
        await writeMappingLiveCheckpoint(ckPath, checkpoint);
        throw new PaginationSafetyError(
          pageKind === "ICANN_ERROR_PAGE"
            ? "ICANN Error page — reject as grid"
            : "Non-grid page encountered during mapping-live crawl",
        );
      }
      const parsed = parseViewstatusGridHtml(html);
      const diagnostics = {
        ...buildViewstatusPageDiagnostics(
          html,
          parsed.rows.length,
          parsed.quarantinedBlocks.length,
        ),
        pageKind,
      };

      assertPaginationAdvance(
        paginationState,
        currentUrl,
        contentSha256,
        diagnostics,
        pageOrdinal,
        RSP_ACQUISITION_LIMITS.mappingLivePageSafetyCap,
      );

      const rowMap = mergeGridRowsIntoMapping(parsed.rows);
      for (const [applicationId, acId] of rowMap.entries()) {
        mappings.set(applicationId, acId);
        applicationPageOrdinal[applicationId] = pageOrdinal;
      }

      const snapshotId = snapshotIdForPage(checkpoint.runId, pageOrdinal, contentSha256);
      const htmlPath = stagingIndexPageHtmlPath(stagingRoot, checkpoint.runId, pageOrdinal);
      const metaPath = stagingIndexPageFetchMetadataPath(stagingRoot, checkpoint.runId, pageOrdinal);
      await writeFile(htmlPath, response.body);
      const metadata = buildIndexPageFetchMetadata({
        pageOrdinal,
        resolvedUrl: currentUrl,
        finalUrl: response.finalUrl,
        httpStatus: response.status,
        contentType: response.headers["content-type"],
        contentLength: response.body.byteLength,
        contentSha256,
        retrievedAt: new Date().toISOString(),
        runId: checkpoint.runId,
        displayStart: diagnostics.displayStart,
        displayEnd: diagnostics.displayEnd,
        displayTotal: diagnostics.displayTotal,
        parsedRowCount: diagnostics.parsedRowCount,
        quarantinedBlockCount: diagnostics.quarantinedBlockCount,
        nextPageHref: diagnostics.nextPageHref,
      });
      await writeFile(metaPath, `${JSON.stringify(metadata, null, 2)}\n`);

      const pageRecord = {
        pageOrdinal,
        snapshotId,
        contentSha256,
        resolvedUrl: currentUrl,
        diagnostics,
      };
      checkpoint.pages = [...checkpoint.pages.filter((p) => p.pageOrdinal !== pageOrdinal), pageRecord];
      checkpoint.lastCompletedPageOrdinal = pageOrdinal;
      checkpoint.mappings = Object.fromEntries(mappings.entries());
      checkpoint.applicationPageOrdinal = applicationPageOrdinal;
      checkpoint.state = "running";
      await writeMappingLiveCheckpoint(ckPath, checkpoint);

      const reconciliation = reconcileCanonicalMapping(expectedIds, mappings);
      if (reconciliation.exact) {
        currentUrl = null;
        break;
      }

      currentUrl = resolveNextPageUrl(currentUrl, diagnostics.nextPageHref);
      if (currentUrl == null) {
        stoppedEarly = true;
        stopReason = "pagination ended before exact reconciliation";
        break;
      }

      await transport.waitBetweenRequests();
    }
  } catch (err) {
    checkpoint.state = "failed";
    checkpoint.stopReason = err instanceof Error ? err.message : String(err);
    await writeMappingLiveCheckpoint(ckPath, checkpoint);
    if (isMappingLiveOperatorCancellation(err) || err instanceof PaginationSafetyError) {
      const reconciliation = reconcileCanonicalMapping(expectedIds, mappings);
      return finalizeMappingLiveRun({
        stagingRoot,
        runId: checkpoint.runId,
        ckPath,
        checkpoint,
        reconciliation,
        stoppedEarly: true,
        stopReason: checkpoint.stopReason,
        forceNewRunDisposition,
      });
    }
    throw err;
  }

  const reconciliation = reconcileCanonicalMapping(expectedIds, mappings);
  return finalizeMappingLiveRun({
    stagingRoot,
    runId: checkpoint.runId,
    ckPath,
    checkpoint,
    reconciliation,
    stoppedEarly,
    stopReason,
    forceNewRunDisposition,
  });
}

export { PaginationSafetyError };
