import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  evaluateApplicationPublicationV2ActualityPromotion,
  evaluateContentionActualityPromotion,
  rollbackApplicationActualityState,
  rollbackContentionActualityState,
} from "@/reveal-day-2026/activation-2x";
import {
  DEFAULT_CLAIM_ACTUALITY_STATE,
  DEFAULT_CONTENTION_ACTUALITY_STATE,
} from "@/reveal-day-2026/claim-actuality";
import { writeClaimActualityState, readClaimActualityState } from "@/reveal-day-2026/claim-actuality-persistence";
import {
  writeContentionActualityState,
  readContentionActualityState,
} from "@/reveal-day-2026/contention-actuality-persistence";
import {
  loadPublicationV2FromPath,
  loadContentionMembershipFromPath,
} from "@/reveal-day-2026/promotion-contract-2x-io";
import { runRevealDayPromotion2xDryRun } from "@/reveal-day-2026/promotion-contract-2x";
import { evaluateHumanApprovals } from "@/reveal-day-2026/human-approval";
import { buildBrowserApplicationPayloadFromPublicationV2 } from "@/lib/registry-application-payload-v2";
import {
  resolveActiveRegistryApplicationsDocument,
  claimActualityAssertedForBrowser,
  rehearsalRegistryApplicationsDocument,
} from "@/lib/registry-application-payload-shared";
import { bindContentionOverlayForActiveBrowserV2 } from "@/lib/registry-application-payload-v2";
import {
  filterBrowserApplicationsV2,
  localResultCountV2,
  coverageDisclosureForDocumentV2,
  UNSUPPORTED_EXPLORE_FACETS_V2,
  metricEligibilityProbeForBrowserV2,
  dataHealthMetadataFromBrowserV2,
  DEFAULT_EXPLORE_FILTERS_V2,
} from "@/lib/registry-application-payload-v2";
import { resolveHubMetricEligibility } from "@/lib/hub-metric-eligibility";
import { BROWSER_V2_ARTIFACT_RELATIVE_PATH, BROWSER_V2_DELIVERY_CONTRACT } from "@/lib/registry-browser-v2-delivery";
import { buildDataHealthSnapshot, humanizePayloadSelectionReason } from "@/lib/data-health-report";
import { readFileSync } from "node:fs";

const REVEAL_APP = join(process.cwd(), ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
const REVEAL_CONTENTION = join(
  process.cwd(),
  ".data/reveal-2026/publications/aps-contention-1.0.0.snapshot.json",
);

const temps: string[] = [];

afterEach(async () => {
  for (const dir of temps.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
  // Guarantee repository claim actuality remains absent / NOT_PUBLISHED.
  expect(await readClaimActualityState(join(process.cwd(), ".data/reveal-2026/claim-actuality-state.json"))).toMatchObject({
    round2026ApplicationActuality: "NOT_PUBLISHED",
  });
});

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "rih-activation-2x-"));
  temps.push(dir);
  return dir;
}

describe("RIH-ACTIVATION-2X-1 actuality write", () => {
  it("1 — valid 2.0 explicit write persists REAL_SOURCE_READY in temp state", async () => {
    const dir = await tempDir();
    const statePath = join(dir, "claim-actuality-state.json");
    const publication = await loadPublicationV2FromPath(REVEAL_APP);
    const approval = evaluateHumanApprovals({
      stewardApprovalId: "stew-activation-test",
      productApprovalId: "prod-activation-test",
    });
    const result = evaluateApplicationPublicationV2ActualityPromotion(
      publication,
      DEFAULT_CLAIM_ACTUALITY_STATE,
      approval,
    );
    expect(result.ok).toBe(true);
    await writeClaimActualityState(statePath, result.nextState);
    const loaded = await readClaimActualityState(statePath, { allowMissing: false });
    expect(loaded.round2026ApplicationActuality).toBe("REAL_SOURCE_READY");
    expect(loaded.snapshotId).toBe(publication.snapshotId);
    expect(loaded.snapshotContentHash).toBe(publication.bundleManifest.applicationGraphContentSha256);
    expect(loaded.rawSha256).toBe(publication.lineage.rawSha256);
  });

  it("2 — invalid 2.0 candidate writes nothing", async () => {
    const dir = await tempDir();
    const statePath = join(dir, "claim-actuality-state.json");
    const publication = await loadPublicationV2FromPath(REVEAL_APP);
    const mutated = {
      ...publication,
      snapshotId: "wrong-snapshot",
    };
    const approval = evaluateHumanApprovals({
      stewardApprovalId: "stew",
      productApprovalId: "prod",
    });
    const result = evaluateApplicationPublicationV2ActualityPromotion(
      mutated,
      DEFAULT_CLAIM_ACTUALITY_STATE,
      approval,
      { snapshotId: publication.snapshotId },
    );
    expect(result.ok).toBe(false);
    await writeClaimActualityState(statePath, DEFAULT_CLAIM_ACTUALITY_STATE);
    const before = await readFile(statePath, "utf8");
    // no write of nextState
    expect(result.nextState.round2026ApplicationActuality).toBe("NOT_PUBLISHED");
    const after = await readFile(statePath, "utf8");
    expect(after).toBe(before);
  });

  it("3 — dry-run writes nothing", async () => {
    const dir = await tempDir();
    const statePath = join(dir, "claim-actuality-state.json");
    await writeClaimActualityState(statePath, DEFAULT_CLAIM_ACTUALITY_STATE);
    const before = await readFile(statePath, "utf8");
    const publication = await loadPublicationV2FromPath(REVEAL_APP);
    const report = runRevealDayPromotion2xDryRun({ publication, applicationOnly: true });
    expect(report.actualPromotionPerformed).toBe(false);
    expect(report.application.status).toBe("PROMOTABLE");
    const after = await readFile(statePath, "utf8");
    expect(after).toBe(before);
  });

  it("4 — 1.1 path evaluator still refuses typed 2.0 snapshot", async () => {
    const { evaluateApplicationActualityPromotion } = await import("@/reveal-day-2026/claim-actuality");
    const result = evaluateApplicationActualityPromotion(
      {
        schemaVersion: "registry-2026-publication/2.0.0",
        publicationKind: "immutable-publication",
        snapshotId: "snap-not-1-1",
        parserVersion: "p",
        applications: [],
      } as never,
      {
        snapshotId: "x",
        snapshotContentHash: "y",
        validation: { ok: true },
        normalization: { unresolvedFieldCount: 0 },
        provenance: { sourceName: "a", sourceUrl: "b" },
        methodVersions: { parser: "p" },
        contaminationCheck: { blockedForRealPromotion: false },
      } as never,
      DEFAULT_CLAIM_ACTUALITY_STATE,
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/2\.0 promote-actuality path/);
  });
});

describe("RIH-ACTIVATION-2X-1 active resolution", () => {
  it("5-11 — REAL+match / fail-closed / NOT_PUBLISHED rehearsal", async () => {
    const publication = await loadPublicationV2FromPath(REVEAL_APP);
    const payload = buildBrowserApplicationPayloadFromPublicationV2(publication);
    const approval = evaluateHumanApprovals({
      stewardApprovalId: "s",
      productApprovalId: "p",
    });
    const claim = evaluateApplicationPublicationV2ActualityPromotion(
      publication,
      DEFAULT_CLAIM_ACTUALITY_STATE,
      approval,
    ).nextState;

    const active = resolveActiveRegistryApplicationsDocument(claim, payload);
    expect(active.status).toBe("ok");
    expect(active.mode).toBe("promoted-2026-v2");
    expect(active.selectionReason).toBe("promoted-active-v2");
    expect(active.documentV2?.applications).toHaveLength(1614);
    expect(active.documentV2?.officialApplications).toBe(1615);
    expect(active.document).toBeNull();

    const missing = resolveActiveRegistryApplicationsDocument(claim, null);
    expect(missing.status).toBe("fail-closed");
    expect(missing.mode).toBe("unavailable");
    expect(missing.document).toBeNull();
    expect(missing.selectionReason).toBe("payload-not-configured");
    expect(humanizePayloadSelectionReason(missing.selectionReason)).not.toMatch(/rehearsal fallback$/i);

    const malformed = resolveActiveRegistryApplicationsDocument(claim, { payloadVersion: "nope" });
    expect(malformed.status).toBe("fail-closed");
    expect(malformed.selectionReason).toBe("payload-malformed");

    const wrongSnap = resolveActiveRegistryApplicationsDocument(
      { ...claim, snapshotId: "other" },
      payload,
    );
    expect(wrongSnap.status).toBe("fail-closed");
    expect(wrongSnap.selectionReason).toBe("snapshot-id-mismatch");

    const wrongHash = resolveActiveRegistryApplicationsDocument(
      { ...claim, snapshotContentHash: "0".repeat(64) },
      payload,
    );
    expect(wrongHash.status).toBe("fail-closed");
    expect(wrongHash.selectionReason).toBe("content-hash-mismatch");

    // REAL never silently rehearsal
    for (const r of [missing, malformed, wrongSnap, wrongHash]) {
      expect(r.mode).not.toBe("rehearsal");
      expect(r.document?.applications?.[0]?.id).not.toBe("APP-26001");
    }

    const notPublished = resolveActiveRegistryApplicationsDocument(
      DEFAULT_CLAIM_ACTUALITY_STATE,
      payload,
    );
    expect(notPublished.mode).toBe("rehearsal");
    expect(notPublished.document?.applications[0]?.id).toBe("APP-26001");
  });
});

describe("RIH-ACTIVATION-2X-1 delivery / Search / metrics / contention", () => {
  it("12-30 — external path, search/explore, metrics, contention domains", async () => {
    const dir = await tempDir();
    const browserDir = join(dir, "browser");
    await mkdir(browserDir, { recursive: true });
    const payloadPath = join(browserDir, "applications-browser-v2.json");

    const publication = await loadPublicationV2FromPath(REVEAL_APP);
    const contention = await loadContentionMembershipFromPath(REVEAL_CONTENTION);
    const payload = buildBrowserApplicationPayloadFromPublicationV2(publication);
    await writeFile(payloadPath, `${JSON.stringify(payload)}\n`);
    const compactBytes = Buffer.byteLength(await readFile(payloadPath), "utf8");
    expect(compactBytes).toBeGreaterThan(1_000_000);
    expect(compactBytes).toBeLessThan(2_500_000);
    expect(BROWSER_V2_DELIVERY_CONTRACT.embedInMainJsBundle).toBe(false);
    expect(BROWSER_V2_ARTIFACT_RELATIVE_PATH).toContain("applications-browser-v2.json");

    // ensure main entry does not import reveal JSON corpus
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).not.toMatch(/aps-applications-2\.0\.0/);
    expect(layout).not.toMatch(/applications-browser-v2/);

    const loaded = JSON.parse(await readFile(payloadPath, "utf8"));
    const approval = evaluateHumanApprovals({
      stewardApprovalId: "s",
      productApprovalId: "p",
    });
    const claim = evaluateApplicationPublicationV2ActualityPromotion(
      publication,
      DEFAULT_CLAIM_ACTUALITY_STATE,
      approval,
    ).nextState;
    const resolution = resolveActiveRegistryApplicationsDocument(claim, loaded);
    expect(resolution.status).toBe("ok");
    const doc = resolution.documentV2!;

    const matches = filterBrowserApplicationsV2(doc.applications, {
      ...DEFAULT_EXPLORE_FILTERS_V2,
      q: "a",
    });
    const count = localResultCountV2(matches);
    expect(count.countSemantics).toBe("rih-observed-records");
    expect(count.notOfficialRoundTotal).toBe(true);
    expect(UNSUPPORTED_EXPLORE_FACETS_V2).toEqual(
      expect.arrayContaining(["organization", "category", "returning", "confidence"]),
    );
    const disclosure = coverageDisclosureForDocumentV2(doc);
    expect(disclosure.officialApplications).toBe(1615);
    expect(disclosure.observedApplicationRecords).toBe(1614);
    expect(disclosure.completeness).toBe("partial");
    expect(disclosure.knownExcludedApplicationIds).toContain("WDO2627T-T45217");
    expect(doc.applications.some((a) => a.applicationId === "WDO2627T-T45217")).toBe(false);

    const asserted = claimActualityAssertedForBrowser(claim, resolution);
    const probes = metricEligibilityProbeForBrowserV2(doc, asserted);
    expect(probes["application-count"].documentOfficialApplications).toBe(1615);
    expect(probes["observed-application-records"].documentObservedRecords).toBe(1614);
    expect(resolveHubMetricEligibility("unique-applied-strings", asserted)?.claimReadiness.round2026).not.toBe(
      "REAL_SOURCE_READY",
    );
    expect(resolveHubMetricEligibility("organization-round-count", asserted)?.methodReadiness).toBe(
      "BLOCKED_SOURCE",
    );
    expect(resolveHubMetricEligibility("returning-participant-identity", asserted)?.methodReadiness).toBe(
      "BLOCKED_SOURCE",
    );
    expect(resolveHubMetricEligibility("category-mix", asserted)?.methodReadiness).toBe("BLOCKED_SOURCE");
    expect(resolveHubMetricEligibility("idn-applications", asserted)?.sourceChannel).toBe(
      "OFFICIAL_AGGREGATE",
    );

    const dh = dataHealthMetadataFromBrowserV2(doc);
    expect(dh.payloadVersion).toBe("registry-browser-applications/2.0.0");
    expect(dh.officialApplications).toBe(1615);

    // Contention persistence + overlay domains
    const cStatePath = join(dir, "contention-actuality-state.json");
    const cApproval = evaluateHumanApprovals({
      stewardApprovalId: "cs",
      productApprovalId: "cp",
    });
    const cResult = evaluateContentionActualityPromotion(
      contention,
      publication.bundleManifest.applicationGraphContentSha256,
      DEFAULT_CONTENTION_ACTUALITY_STATE,
      cApproval,
    );
    expect(cResult.ok).toBe(true);
    await writeContentionActualityState(cStatePath, cResult.nextState);
    const cLoaded = await readContentionActualityState(cStatePath, { allowMissing: false });
    expect(cLoaded.round2026ContentionActuality).toBe("REAL_SOURCE_READY");

    const withOverlay = bindContentionOverlayForActiveBrowserV2(doc, {
      contentionActuality: cLoaded,
      sidecar: contention,
      applicationGraphContentSha256: doc.snapshotContentHash,
    });
    expect(withOverlay.contentionOverlay.status).toBe("available");
    expect(withOverlay.contentionOverlay.officialContentionSetCount).toBe(263);
    expect(withOverlay.contentionOverlay.joinedMemberCount).toBe(891);
    expect(withOverlay.applications).toHaveLength(1614);

    const missingContention = bindContentionOverlayForActiveBrowserV2(doc, {
      contentionActuality: DEFAULT_CONTENTION_ACTUALITY_STATE,
      sidecar: null,
      applicationGraphContentSha256: doc.snapshotContentHash,
    });
    expect(missingContention.applications).toHaveLength(1614);
    expect(missingContention.contentionOverlay.status).toBe("unavailable");

    const hashMismatch = bindContentionOverlayForActiveBrowserV2(doc, {
      contentionActuality: {
        ...cLoaded,
        sidecarContentHash: "0".repeat(64),
      },
      sidecar: contention,
      applicationGraphContentSha256: doc.snapshotContentHash,
    });
    expect(hashMismatch.applications).toHaveLength(1614);
    expect(hashMismatch.contentionOverlay.status).toBe("unavailable");

    const pinMismatch = bindContentionOverlayForActiveBrowserV2(doc, {
      contentionActuality: {
        ...cLoaded,
        applicationPublicationPinHash: "1".repeat(64),
      },
      sidecar: contention,
      applicationGraphContentSha256: doc.snapshotContentHash,
    });
    expect(pinMismatch.applications).toHaveLength(1614);
    expect(pinMismatch.contentionOverlay.status).toBe("unavailable");

    // rollback
    expect(rollbackApplicationActualityState().round2026ApplicationActuality).toBe("NOT_PUBLISHED");
    expect(rollbackContentionActualityState().round2026ContentionActuality).toBe("NOT_PUBLISHED");
    const afterAppRollback = resolveActiveRegistryApplicationsDocument(
      rollbackApplicationActualityState(),
      payload,
    );
    expect(afterAppRollback.mode).toBe("rehearsal");
    expect(afterAppRollback.document?.applications[0]?.id).toBe(
      rehearsalRegistryApplicationsDocument().applications[0]?.id,
    );

    const snapshot = buildDataHealthSnapshot(asserted, resolution);
    expect(snapshot.publicationReadiness.browserPayloadSelectionReason).toBe("promoted-active-v2");
  });
});
