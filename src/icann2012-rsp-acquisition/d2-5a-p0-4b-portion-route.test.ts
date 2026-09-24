import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "@/normalization/hashes";
import {
  ApplicationDetailsDownloadError,
  parseApplicationDetailsDownload,
} from "./application-details-download";
import { loadApprovedMappingRunEvidenceIndex } from "./approved-mapping-evidence-index";
import { assertPortionDiagnosticAuthGate } from "./auth-gates";
import {
  evaluateMappingArtifactEligibility,
  isProductionEligibleArtifact,
} from "./artifact-eligibility";
import { stagingIndexPageFetchMetadataPath, stagingIndexPageHtmlPath } from "./bundle-paths";
import { networkPolicyForCommand } from "./command-mode";
import {
  GTLDRESULT_PATHS,
  PORTION_DIAGNOSTIC_APPLICATION_ID,
  PORTION_DIAGNOSTIC_GTLDRESULT_AC_ID,
  PORTION_DIAGNOSTIC_HTTP_CEILING,
  RSP_MAPPING_LIVE_AUTH_ENV,
  RSP_PAGER_DIAGNOSTIC_AUTH_ENV,
  RSP_PILOT_LIVE_AUTH_ENV,
  RSP_PORTION_DIAGNOSTIC_AUTH_ENV,
} from "./constants";
import {
  createEmptyMappingLiveCheckpoint,
  mappingLiveCheckpointPath,
  writeMappingLiveCheckpoint,
} from "./mapping-checkpoint";
import { createPortionDiagnosticBudget, runPortionLiveDiagnostic } from "./portion-live-diagnostic";
import { buildPreflightReport } from "./preflight-report";
import {
  PUBLIC_PORTION_VERSION_BASIS,
  resolveApplicationVersionBasis,
  validatePublicPortionDocument,
} from "./public-portion-validation";
import { validatePortionHtml } from "./quarantine";
import { assertNoSensitiveArtifactMaterial } from "./sensitive-artifact-guard";
import type { GtldresultFetcher, GtldresultHttpResponse } from "./gtldresult-session-transport";
import type { Registry2012RspMappingArtifact } from "./types";
import { absoluteGtldresultUrl, buildDetailsUrl, buildPortionUrl } from "./urls";

const workspaceRoot = join(process.cwd());
const noSleep = async () => {};

const DETAILS_URL = buildDetailsUrl(170);
const PORTION_URL = buildPortionUrl(170);

const BOSCH_DETAILS_FIXTURE = `<html><body>
<div>String: BOSCH</div>
<div>Application ID: 1-1945-29108</div>
<a href="/applicationstatus/applicationdetails:downloadapplication/170?t:ac=170">Download public portion of application</a>
</body></html>`;

const PORTION_SHAPED_Q23 = `<html><body>
<p>Application ID: 1-1945-29108</p>
<h2>23. Registry Services</h2>
<p>Registry services are defined as the following: operations of the registry critical to the following tasks.</p>
</body></html>`;

const STATUS_HUB_HTML = `<html><body>
Displaying 1 - 35 of 1930
<a href="/applicationstatus/viewstatus.statusgrid.pager/2">2</a>
<div id="q23">not a portion</div>
</body></html>`;

const DETAILS_PAGE_HTML = `<html><body>
Application ID: 1-1945-29108
<a href="/applicationstatus/applicationdetails:downloadapplication/170?t:ac=170">Download public portion of application</a>
</body></html>`;

function textResponse(
  status: number,
  body: string,
  url: string,
  extra?: { setCookieHeaders?: string[]; headers?: Record<string, string> },
): GtldresultHttpResponse {
  return {
    status,
    body: Buffer.from(body),
    headers: extra?.headers ?? {},
    finalUrl: url,
    setCookieHeaders: extra?.setCookieHeaders,
  };
}

async function withEnv<T>(name: string, value: string | undefined, fn: () => Promise<T>): Promise<T> {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

describe("D2.5A-P0.4B public-portion routes", () => {
  it("keeps details and public-portion URLs off the status-grid prefix", () => {
    expect(buildDetailsUrl(170)).toBe(
      "https://gtldresult.icann.org/applicationstatus/applicationdetails/170",
    );
    expect(buildPortionUrl(170)).toBe(
      "https://gtldresult.icann.org/applicationstatus/applicationdetails:downloadapplication/170?t:ac=170",
    );
    expect(buildDetailsUrl(170)).not.toContain("/application-result/");
    expect(buildPortionUrl(170)).not.toContain("/application-result/");
    expect(buildDetailsUrl(170)).not.toContain("/application-result/applicationstatus/applicationdetails");
    expect(buildPortionUrl(170)).not.toContain("/application-result/applicationstatus/applicationdetails");
  });

  it("leaves status-grid mapping routes on /application-result/applicationstatus", () => {
    expect(absoluteGtldresultUrl(GTLDRESULT_PATHS.statusHub)).toBe(
      "https://gtldresult.icann.org/application-result/applicationstatus",
    );
    expect(absoluteGtldresultUrl(GTLDRESULT_PATHS.viewStatusGrid)).toBe(
      "https://gtldresult.icann.org/application-result/applicationstatus/viewstatus/",
    );
    expect(GTLDRESULT_PATHS.gridPager(2)).toContain(
      "/application-result/applicationstatus/viewstatus.statusgrid.pager/2",
    );
    expect(GTLDRESULT_PATHS.applicationDetails(170)).not.toContain("/application-result/");
    expect(GTLDRESULT_PATHS.downloadPublicPortion(170)).not.toContain("/application-result/");
  });
});

describe("D2.5A-P0.4B details download parser", () => {
  it("maps the BOSCH details fixture to Application ID 1-1945-29108 and uses the server href", () => {
    const parsed = parseApplicationDetailsDownload(BOSCH_DETAILS_FIXTURE, {
      expectedApplicationId: "1-1945-29108",
      detailsPageUrl: DETAILS_URL,
    });
    expect(parsed.applicationId).toBe("1-1945-29108");
    expect(parsed.serverProvidedHref).toBe(
      "/applicationstatus/applicationdetails:downloadapplication/170?t:ac=170",
    );
    expect(parsed.resolvedPortionUrl).toBe(PORTION_URL);
    expect(parsed.resolvedPortionUrl).not.toContain("/application-result/");
  });

  it("preserves a server href that is not the manufactured canonical URL", () => {
    const html = `<html><body>Application ID: 1-1945-29108
      <a href="/applicationstatus/applicationdetails:downloadapplication/170?t:ac=170&amp;x=1">Download public portion of application</a>
    </body></html>`;
    const parsed = parseApplicationDetailsDownload(html, {
      expectedApplicationId: "1-1945-29108",
      detailsPageUrl: DETAILS_URL,
    });
    expect(parsed.serverProvidedHref).toBe(
      "/applicationstatus/applicationdetails:downloadapplication/170?t:ac=170&x=1",
    );
    expect(parsed.resolvedPortionUrl).toBe(`${PORTION_URL}&x=1`);
    expect(parsed.resolvedPortionUrl).not.toBe(buildPortionUrl(170));
  });

  it("treats a repeated official href as one link", () => {
    const html = `${BOSCH_DETAILS_FIXTURE}<a href="/applicationstatus/applicationdetails:downloadapplication/170?t:ac=170">Download public portion of application</a>`;
    const parsed = parseApplicationDetailsDownload(html, {
      expectedApplicationId: "1-1945-29108",
      detailsPageUrl: DETAILS_URL,
    });
    expect(parsed.resolvedPortionUrl).toBe(PORTION_URL);
  });

  it("fails closed when the download link is missing or ambiguous", () => {
    expect(() =>
      parseApplicationDetailsDownload("<html>Application ID: 1-1945-29108</html>", {
        expectedApplicationId: "1-1945-29108",
        detailsPageUrl: DETAILS_URL,
      }),
    ).toThrow(ApplicationDetailsDownloadError);
    try {
      parseApplicationDetailsDownload("<html>Application ID: 1-1945-29108</html>", {
        expectedApplicationId: "1-1945-29108",
        detailsPageUrl: DETAILS_URL,
      });
    } catch (err) {
      expect((err as ApplicationDetailsDownloadError).code).toBe("MISSING_DOWNLOAD_LINK");
    }

    const ambiguous = `<html>Application ID: 1-1945-29108
      <a href="/applicationstatus/applicationdetails:downloadapplication/170?t:ac=170">Download public portion of application</a>
      <a href="/applicationstatus/applicationdetails:downloadapplication/171?t:ac=171">Download public portion of application</a>
    </html>`;
    expect(() =>
      parseApplicationDetailsDownload(ambiguous, {
        expectedApplicationId: "1-1945-29108",
        detailsPageUrl: DETAILS_URL,
      }),
    ).toThrow(/distinct public-portion/);
  });

  it("fails closed on a cross-host or non-HTTPS download link", () => {
    const cross = `<html>Application ID: 1-1945-29108
      <a href="https://evil.example/applicationstatus/applicationdetails:downloadapplication/170?t:ac=170">Download public portion of application</a>
    </html>`;
    expect(() =>
      parseApplicationDetailsDownload(cross, {
        expectedApplicationId: "1-1945-29108",
        detailsPageUrl: DETAILS_URL,
      }),
    ).toThrow(/cross-host|CROSS_HOST/i);

    const insecure = `<html>Application ID: 1-1945-29108
      <a href="http://gtldresult.icann.org/applicationstatus/applicationdetails:downloadapplication/170?t:ac=170">Download public portion of application</a>
    </html>`;
    try {
      parseApplicationDetailsDownload(insecure, {
        expectedApplicationId: "1-1945-29108",
        detailsPageUrl: DETAILS_URL,
      });
      throw new Error("expected non-https rejection");
    } catch (err) {
      expect((err as ApplicationDetailsDownloadError).code).toBe("NON_HTTPS_LINK");
    }
  });

  it("fails closed when the details page Application ID is wrong", () => {
    const html = BOSCH_DETAILS_FIXTURE.replace("1-1945-29108", "1-000-11111");
    try {
      parseApplicationDetailsDownload(html, {
        expectedApplicationId: "1-1945-29108",
        detailsPageUrl: DETAILS_URL,
      });
      throw new Error("expected wrong application id");
    } catch (err) {
      expect((err as ApplicationDetailsDownloadError).code).toBe("WRONG_APPLICATION_ID");
    }
  });
});

describe("D2.5A-P0.4B Q23 validation", () => {
  it("accepts a public-portion-shaped Question 23 section without id=q23", () => {
    const result = validatePublicPortionDocument(PORTION_SHAPED_Q23, {
      expectedApplicationId: "1-1945-29108",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.applicationVersionBasis).toBe("current_public_portion");
      expect(result.applicationId).toBe("1-1945-29108");
    }
    expect(validatePortionHtml(PORTION_SHAPED_Q23).ok).toBe(true);
    expect(validatePortionHtml('<div id="q23">x</div>').ok).toBe(true);
    expect(validatePortionHtml('<div id="q23_agb">question</div>').ok).toBe(true);
  });

  it("rejects a status hub, an application details page, a missing Q23, and the wrong Application ID", () => {
    expect(validatePortionHtml(STATUS_HUB_HTML).ok).toBe(false);
    expect(validatePublicPortionDocument(DETAILS_PAGE_HTML).ok).toBe(false);
    expect(validatePortionHtml("<html><body>Application ID: 1-1945-29108</body></html>").ok).toBe(false);
    const wrong = validatePublicPortionDocument(
      PORTION_SHAPED_Q23.replace("1-1945-29108", "1-999-00000"),
      { expectedApplicationId: "1-1945-29108" },
    );
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.reason).toBe("application-id-mismatch");
    expect(
      validatePortionHtml('<html><title>ICANN Error</title><div id="q23">x</div></html>').ok,
    ).toBe(false);
  });

  it("does not treat an official download as original_submission", () => {
    expect(resolveApplicationVersionBasis()).toBe(PUBLIC_PORTION_VERSION_BASIS);
    expect(() => resolveApplicationVersionBasis("original_submission")).toThrow(/original_submission/);
  });
});

describe("D2.5A-P0.4B portion-live diagnostic", () => {
  it("GETs details then the server href in one session and stops", async () => {
    const calls: Array<{ url: string; cookie?: string }> = [];
    const fetcher: GtldresultFetcher = async (url, init) => {
      calls.push({ url, cookie: init?.headers?.Cookie });
      if (url === DETAILS_URL) {
        return textResponse(200, BOSCH_DETAILS_FIXTURE, url, {
          setCookieHeaders: ["SESSION=SECRETVALUE; Path=/"],
        });
      }
      if (url === PORTION_URL) {
        return textResponse(200, PORTION_SHAPED_Q23, url, {
          setCookieHeaders: ["SESSION=OTHERSECRET; Path=/"],
        });
      }
      throw new Error(`unexpected ${url}`);
    };

    const report = await withEnv(RSP_PORTION_DIAGNOSTIC_AUTH_ENV, "1", () =>
      runPortionLiveDiagnostic({ sleep: noSleep, now: () => "2026-09-24T00:00:00.000Z" }, fetcher),
    );

    expect(report.classification).toBe("PORTION_OK");
    expect(report.detailsApplicationId).toBe("1-1945-29108");
    expect(report.serverProvidedHref).toBe(
      "/applicationstatus/applicationdetails:downloadapplication/170?t:ac=170",
    );
    expect(report.portionUrl).toBe(PORTION_URL);
    expect(report.q23Present).toBe(true);
    expect(report.statusGridHub).toBe(false);
    expect(report.icannErrorPage).toBe(false);
    expect(report.applicationVersionBasis).toBe("current_public_portion");
    expect(report.retrievedAt).toBe("2026-09-24T00:00:00.000Z");
    expect(report.applicationVersionBasis).not.toBe(report.retrievedAt);
    expect(report.httpRequestCount).toBe(2);
    expect(report.requestCeiling).toBe(12);
    expect(report.stoppedAfterOneApplication).toBe(true);
    expect(calls.map((call) => call.url)).toEqual([DETAILS_URL, PORTION_URL]);
    expect(calls[1]?.cookie).toContain("SESSION=SECRETVALUE");
    expect(report.sessionCookieSent).toBe(true);
    expect(report.setCookieHeaderCount).toBe(1);

    const persisted = JSON.stringify(report);
    expect(persisted).not.toContain("SECRETVALUE");
    expect(persisted).not.toContain("OTHERSECRET");
    expect(persisted).not.toContain("Verisign");
    expect(persisted).not.toContain("original_submission");
    expect(persisted).not.toContain(RSP_PORTION_DIAGNOSTIC_AUTH_ENV);
    assertNoSensitiveArtifactMaterial(persisted, "portion-diagnostic-report.json");
  });

  it("does not fetch a portion when the details Application ID, link, or host is wrong", async () => {
    const cases: Array<{ html: string; classification: string }> = [
      {
        html: BOSCH_DETAILS_FIXTURE.replace("1-1945-29108", "1-000-11111"),
        classification: "STOPPED_WRONG_APPLICATION_ID",
      },
      {
        html: "<html>Application ID: 1-1945-29108</html>",
        classification: "STOPPED_MISSING_DOWNLOAD_LINK",
      },
      {
        html: `<html>Application ID: 1-1945-29108
          <a href="/applicationstatus/applicationdetails:downloadapplication/170?t:ac=170">Download public portion of application</a>
          <a href="/applicationstatus/applicationdetails:downloadapplication/171?t:ac=171">Download public portion of application</a>
        </html>`,
        classification: "STOPPED_AMBIGUOUS_DOWNLOAD_LINK",
      },
      {
        html: `<html>Application ID: 1-1945-29108
          <a href="https://evil.example/x">Download public portion of application</a>
        </html>`,
        classification: "STOPPED_CROSS_HOST_LINK",
      },
    ];

    for (const item of cases) {
      const calls: string[] = [];
      const fetcher: GtldresultFetcher = async (url) => {
        calls.push(url);
        return textResponse(200, item.html, url);
      };
      const report = await withEnv(RSP_PORTION_DIAGNOSTIC_AUTH_ENV, "1", () =>
        runPortionLiveDiagnostic({ sleep: noSleep }, fetcher),
      );
      expect(report.classification).toBe(item.classification);
      expect(calls).toEqual([DETAILS_URL]);
    }
  });

  it("rejects hub HTML returned as a public portion", async () => {
    const fetcher: GtldresultFetcher = async (url) => {
      if (url === DETAILS_URL) return textResponse(200, BOSCH_DETAILS_FIXTURE, url);
      return textResponse(200, STATUS_HUB_HTML, url);
    };
    const report = await withEnv(RSP_PORTION_DIAGNOSTIC_AUTH_ENV, "1", () =>
      runPortionLiveDiagnostic({ sleep: noSleep }, fetcher),
    );
    expect(report.classification).toBe("STOPPED_STATUS_HUB");
    expect(report.statusGridHub).toBe(true);
    expect(report.q23Present).toBe(false);
  });

  it("performs zero HTTP unless the portion diagnostic gate is set", async () => {
    const calls: string[] = [];
    const fetcher: GtldresultFetcher = async (url) => {
      calls.push(url);
      throw new Error("HTTP must not run");
    };
    const original = globalThis.fetch;
    globalThis.fetch = async (input) => {
      calls.push(String(input));
      throw new Error("live HTTP forbidden");
    };
    try {
      await withEnv(RSP_PORTION_DIAGNOSTIC_AUTH_ENV, undefined, async () => {
        await withEnv(RSP_PILOT_LIVE_AUTH_ENV, "1", async () => {
          await withEnv(RSP_MAPPING_LIVE_AUTH_ENV, "1", async () => {
            await withEnv(RSP_PAGER_DIAGNOSTIC_AUTH_ENV, "1", async () => {
              await expect(runPortionLiveDiagnostic({ sleep: noSleep }, fetcher)).rejects.toThrow(
                /PORTION_DIAGNOSTIC_AUTHORIZED/,
              );
              expect(assertPortionDiagnosticAuthGate).toThrow(/do not authorize/);
            });
          });
        });
      });
      expect(calls).toEqual([]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("does not let pilot, mapping, or pager authorization grant the portion diagnostic", () => {
    const portion = networkPolicyForCommand("portion-live-diagnostic");
    expect(portion.requiresPortionDiagnosticAuth).toBe(true);
    expect(portion.requiresPilotLiveAuth).toBe(false);
    expect(portion.requiresMappingLiveAuth).toBe(false);
    expect(portion.requiresPagerDiagnosticAuth).toBe(false);
    expect(networkPolicyForCommand("pilot-live").requiresPortionDiagnosticAuth).toBe(false);
    expect(networkPolicyForCommand("mapping-live").requiresPortionDiagnosticAuth).toBe(false);
    expect(networkPolicyForCommand("pager-live-diagnostic").requiresPortionDiagnosticAuth).toBe(false);
    expect(networkPolicyForCommand("pilot").allowsOutboundHttp).toBe(false);
    expect(PORTION_DIAGNOSTIC_APPLICATION_ID).toBe("1-1945-29108");
    expect(PORTION_DIAGNOSTIC_GTLDRESULT_AC_ID).toBe(170);
    expect(PORTION_DIAGNOSTIC_HTTP_CEILING).toBe(12);
  });

  it("enforces the one-application HTTP ceiling and refuses other targets", async () => {
    const calls: string[] = [];
    const budget = createPortionDiagnosticBudget(async (url) => {
      calls.push(url);
      return textResponse(200, "ok", url);
    });
    await expect(
      budget.fetcher(absoluteGtldresultUrl(GTLDRESULT_PATHS.viewStatusGrid)),
    ).rejects.toThrow(/status grid/);
    await expect(
      budget.fetcher(buildDetailsUrl(171)),
    ).rejects.toThrow(/gtldresultAcId 170/);
    await expect(budget.fetcher(PORTION_URL)).rejects.toThrow(/before the details page/);
    expect(calls).toEqual([]);

    for (let i = 0; i < PORTION_DIAGNOSTIC_HTTP_CEILING; i += 1) {
      await budget.fetcher(DETAILS_URL);
    }
    await expect(budget.fetcher(DETAILS_URL)).rejects.toThrow(/ceiling/);
    expect(calls).toHaveLength(PORTION_DIAGNOSTIC_HTTP_CEILING);
    budget.seal();
    await expect(budget.fetcher(DETAILS_URL)).rejects.toThrow(/hard stop/);
    expect(calls).toHaveLength(PORTION_DIAGNOSTIC_HTTP_CEILING);
  });
});

describe("D2.5A-P0.4B approved mapping evidence index", () => {
  it("rejects a fixture raw-snapshots.json catalog for pilot-live", async () => {
    const tempWorkspace = await mkdtemp(join(tmpdir(), "rsp-ws-"));
    const bundleRoot = join(tempWorkspace, "src/normalization/fixtures/icann2012-rsp-public-portions-v1");
    await mkdir(bundleRoot, { recursive: true });
    await writeFile(
      join(bundleRoot, "pilot-manifest-25.json"),
      await readFile(
        join(workspaceRoot, "src/normalization/fixtures/icann2012-rsp-public-portions-v1/pilot-manifest-25.json"),
      ),
    );
    const snapId = "snap-hand-filled";
    await writeFile(
      join(bundleRoot, "raw-snapshots.json"),
      `${JSON.stringify({
        snapshots: [
          {
            snapshotId: snapId,
            sourceId: "workaround",
            requestedUrl: buildPortionUrl(170),
            provenance: { contentSha256: "ab".repeat(32) },
          },
        ],
      })}\n`,
    );
    const mappingPath = join(tempWorkspace, "approved.json");
    const artifact: Registry2012RspMappingArtifact = {
      mappingVersion: "registry-2012-rsp-mapping/1.0.0",
      artifactPurpose: "EVIDENCE",
      approvalState: "APPROVED",
      bundleId: "icann2012-rsp-public-portions-v1",
      scope: "pilot-25-test",
      entries: [
        {
          applicationId: "1-1945-29108",
          gtldresultAcId: 170,
          mappingSourceClass: "STATUS_GRID",
          evidenceSnapshotId: snapId,
          sourceUrl: absoluteGtldresultUrl(GTLDRESULT_PATHS.viewStatusGrid),
          evidenceContentSha256: "ab".repeat(32),
        },
      ],
    };
    await writeFile(mappingPath, `${JSON.stringify(artifact)}\n`);
    expect(isProductionEligibleArtifact(artifact)).toBe(true);

    const report = await buildPreflightReport({
      workspaceRoot: tempWorkspace,
      operation: "pilot-live",
      mappingArtifactPath: mappingPath,
    });
    expect(report.evidenceSnapshotCount).toBe(0);
    expect(report.blockingReasons.some((reason) => reason.includes("--evidence-index"))).toBe(true);
    expect(report.blockingReasons.some((reason) => reason.includes("UNKNOWN_EVIDENCE_SNAPSHOT"))).toBe(true);

    const fileReport = await buildPreflightReport({
      workspaceRoot: tempWorkspace,
      operation: "pilot-live",
      mappingArtifactPath: mappingPath,
      evidenceIndexPath: join(bundleRoot, "raw-snapshots.json"),
    });
    expect(fileReport.blockingReasons.some((reason) => reason.includes("raw-snapshots.json"))).toBe(true);
    expect(fileReport.evidenceSnapshotCount).toBe(0);
  });

  it("verifies the approved mapping against mapping-run bytes and fails closed on a hash mismatch", async () => {
    const staging = await mkdtemp(join(tmpdir(), "rsp-run-"));
    const runId = "verified-run";
    const pageHtml = Buffer.from("<html>verified mapping page</html>");
    const pageHash = sha256Hex(pageHtml);
    const snapId = `snap-index-${runId}-p0001-${pageHash.slice(0, 12)}`;
    const resolvedUrl = absoluteGtldresultUrl(GTLDRESULT_PATHS.viewStatusGrid);
    const checkpoint = createEmptyMappingLiveCheckpoint(runId, "test-corpus");
    checkpoint.state = "completed";
    checkpoint.lastCompletedPageOrdinal = 1;
    checkpoint.pages = [
      {
        pageOrdinal: 1,
        snapshotId: snapId,
        contentSha256: pageHash,
        resolvedUrl,
        diagnostics: {
          displayStart: 1,
          displayEnd: 1,
          displayTotal: 1,
          parsedRowCount: 1,
          quarantinedBlockCount: 0,
          nextPageHref: null,
        },
      },
    ];
    await writeMappingLiveCheckpoint(mappingLiveCheckpointPath(staging), checkpoint);
    const htmlPath = stagingIndexPageHtmlPath(staging, runId, 1);
    await mkdir(dirname(htmlPath), { recursive: true });
    await writeFile(htmlPath, pageHtml);
    await writeFile(
      stagingIndexPageFetchMetadataPath(staging, runId, 1),
      `${JSON.stringify({ contentSha256: pageHash, parsedRowCount: 1 })}\n`,
    );

    const index = await loadApprovedMappingRunEvidenceIndex(staging);
    expect(index.byId.size).toBe(1);
    expect(index.byId.get(snapId)?.provenance?.contentSha256).toBe(pageHash);

    const artifact: Registry2012RspMappingArtifact = {
      mappingVersion: "registry-2012-rsp-mapping/1.0.0",
      artifactPurpose: "EVIDENCE",
      approvalState: "APPROVED",
      bundleId: "icann2012-rsp-public-portions-v1",
      scope: "ROUND_WIDE_EXACT",
      entries: [
        {
          applicationId: "1-1945-29108",
          gtldresultAcId: 170,
          mappingSourceClass: "STATUS_GRID",
          evidenceSnapshotId: snapId,
          sourceUrl: resolvedUrl,
          evidenceContentSha256: pageHash,
        },
      ],
    };
    expect(evaluateMappingArtifactEligibility(artifact, index).rowIssues).toEqual([]);

    const mismatched = {
      ...artifact,
      entries: [{ ...artifact.entries[0], evidenceContentSha256: "d".repeat(64) }],
    };
    const mismatch = evaluateMappingArtifactEligibility(mismatched, index);
    expect(mismatch.rowIssues.some((issue) => issue.code === "EVIDENCE_HASH_MISMATCH")).toBe(true);

    await writeFile(htmlPath, Buffer.from("<html>tampered</html>"));
    await expect(loadApprovedMappingRunEvidenceIndex(staging)).rejects.toThrow(/SHA-256 mismatch/);
  });
});
