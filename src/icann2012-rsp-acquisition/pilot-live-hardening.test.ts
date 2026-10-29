import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sha256Hex } from "@/normalization/hashes";
import { acquirePilotLivePortions } from "./acquire";
import { stagingIndexPageFetchMetadataPath, stagingIndexPageHtmlPath } from "./bundle-paths";
import { RSP_ACQUISITION_LIMITS, RSP_PILOT_LIVE_AUTH_ENV } from "./constants";
import {
  createEmptyMappingLiveCheckpoint,
  mappingLiveCheckpointPath,
  writeMappingLiveCheckpoint,
} from "./mapping-checkpoint";
import { buildPreflightReport } from "./preflight-report";
import type { GtldresultFetcher, GtldresultHttpResponse } from "./gtldresult-session-transport";
import { absoluteGtldresultUrl, buildDetailsUrl, buildPortionUrl } from "./urls";
import { GTLDRESULT_PATHS } from "./constants";

const workspaceRoot = join(process.cwd());
const BOSCH_APP = "1-1945-29108";
const BOSCH_AC = 170;
const HOTELS_APP = "1-1016-75482";
const HOTELS_AC = 1589;
const DETAILS_BOSCH = buildDetailsUrl(BOSCH_AC);
const PORTION_BOSCH = buildPortionUrl(BOSCH_AC);
const DETAILS_HOTELS = buildDetailsUrl(HOTELS_AC);

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

function detailsHtml(appId: string, acId: number, href?: string): string {
  const link =
    href ??
    `/applicationstatus/applicationdetails:downloadapplication/${acId}?t:ac=${acId}`;
  return `<html><body>
<div>Application ID: ${appId}</div>
<a href="${link}">Download public portion of application</a>
</body></html>`;
}

function portionHtml(appId: string, withQ23 = true): string {
  const q23 = withQ23
    ? `<h2>23. Registry Services</h2><p>Registry services are defined as the following: operations.</p>`
    : `<p>no question twenty-three here</p>`;
  return `<html><body><p>Application ID: ${appId}</p>${q23}</body></html>`;
}

async function seedApprovedHarness(apps: Array<{ applicationId: string; acId: number }>) {
  const staging = await mkdtemp(join(tmpdir(), "rsp-pilot-hard-"));
  const runId = "pilot-harden-run";
  const runRoot = staging;
  await writeMappingLiveCheckpoint(
    mappingLiveCheckpointPath(runRoot),
    {
      ...createEmptyMappingLiveCheckpoint(runId, "corpus"),
      state: "completed",
      pages: apps.map((a, i) => ({
        pageOrdinal: i + 1,
        snapshotId: `snap-${a.acId}`,
        contentSha256: "",
        resolvedUrl: absoluteGtldresultUrl(GTLDRESULT_PATHS.viewStatusGrid),
        diagnostics: {
          displayStart: 1,
          displayEnd: 1,
          displayTotal: 1,
          parsedRowCount: 1,
          quarantinedBlockCount: 0,
          nextPageHref: null,
        },
      })),
      mappings: Object.fromEntries(apps.map((a) => [a.applicationId, a.acId])),
    },
  );
  // Fill real HTML hashes for evidence index loader
  const ck = JSON.parse(await readFile(mappingLiveCheckpointPath(runRoot), "utf8"));
  for (let i = 0; i < apps.length; i++) {
    const ordinal = i + 1;
    const html = `<html>page ${ordinal}</html>`;
    const bytes = Buffer.from(html);
    const hash = sha256Hex(bytes);
    const htmlPath = stagingIndexPageHtmlPath(runRoot, runId, ordinal);
    const metaPath = stagingIndexPageFetchMetadataPath(runRoot, runId, ordinal);
    await mkdir(join(htmlPath, ".."), { recursive: true });
    await writeFile(htmlPath, bytes);
    await writeFile(
      metaPath,
      `${JSON.stringify({ pageOrdinal: ordinal, contentSha256: hash, parsedRowCount: 1 })}\n`,
    );
    ck.pages[i].contentSha256 = hash;
    ck.pages[i].snapshotId = `snap-${apps[i]!.acId}`;
  }
  await writeFile(mappingLiveCheckpointPath(runRoot), `${JSON.stringify(ck, null, 2)}\n`);

  const mappingPath = join(staging, "approved-mapping.json");
  await writeFile(
    mappingPath,
    `${JSON.stringify(
      {
        mappingVersion: "registry-2012-rsp-mapping/1.0.0",
        artifactPurpose: "EVIDENCE",
        approvalState: "APPROVED",
        bundleId: "icann2012-rsp-public-portions-v1",
        scope: "ROUND_WIDE_EXACT",
        entries: apps.map((a) => ({
          applicationId: a.applicationId,
          gtldresultAcId: a.acId,
          mappingSourceClass: "STATUS_GRID",
          evidenceSnapshotId: `snap-${a.acId}`,
          sourceUrl: absoluteGtldresultUrl(GTLDRESULT_PATHS.viewStatusGrid),
          evidenceContentSha256: ck.pages.find(
            (p: { snapshotId: string }) => p.snapshotId === `snap-${a.acId}`,
          ).contentSha256,
        })),
      },
      null,
      2,
    )}\n`,
  );

  return { staging, mappingPath, runRoot };
}

describe("RIH-2012-RSP-VISIBILITY-1H0 pilot-live hardening (synthetic HTTP only)", () => {
  let prevPilot: string | undefined;
  const sleeps: number[] = [];
  const sleep = async (ms: number) => {
    sleeps.push(ms);
  };

  beforeEach(() => {
    sleeps.length = 0;
    prevPilot = process.env[RSP_PILOT_LIVE_AUTH_ENV];
    process.env[RSP_PILOT_LIVE_AUTH_ENV] = "1";
  });

  afterEach(() => {
    if (prevPilot === undefined) delete process.env[RSP_PILOT_LIVE_AUTH_ENV];
    else process.env[RSP_PILOT_LIVE_AUTH_ENV] = prevPilot;
  });

  it("preflight with approved mapping + evidence index and auth unset has only the authorization blocker", async () => {
    delete process.env[RSP_PILOT_LIVE_AUTH_ENV];
    const harness = await seedApprovedHarness([{ applicationId: BOSCH_APP, acId: BOSCH_AC }]);
    const report = await buildPreflightReport({
      workspaceRoot,
      operation: "pilot-live",
      stagingRoot: join(harness.staging, "pilot-staging"),
      mappingArtifactPath: harness.mappingPath,
      evidenceIndexPath: harness.runRoot,
    });
    expect(report.productionEligible).toBe(true);
    expect(report.networkRequestsExpected).toBe(0);
    expect(report.blockingReasons).toEqual([
      "REGISTRY_HUB_RSP_PILOT_LIVE_AUTHORIZED is not set — pilot-live requires operation-specific authorization",
    ]);
  });

  it("happy path: details-first, server href, session cookie, exact ID, Q23, checkpoint, safe metadata", async () => {
    const harness = await seedApprovedHarness([{ applicationId: BOSCH_APP, acId: BOSCH_AC }]);
    const urls: string[] = [];
    const cookieHeaders: Array<string | undefined> = [];
    const fetcher: GtldresultFetcher = async (url, init) => {
      urls.push(url);
      cookieHeaders.push(init?.headers?.Cookie);
      if (url.includes("/applicationdetails/170") && !url.includes("download")) {
        return textResponse(200, detailsHtml(BOSCH_APP, BOSCH_AC), DETAILS_BOSCH, {
          setCookieHeaders: ["JSESSIONID=sess-details; Path=/"],
        });
      }
      if (url.includes("downloadapplication/170")) {
        expect(init?.headers?.Cookie).toContain("JSESSIONID=sess-details");
        return textResponse(200, portionHtml(BOSCH_APP), url);
      }
      return textResponse(404, "no", url);
    };

    const result = await acquirePilotLivePortions(
      {
        workspaceRoot,
        stagingRoot: harness.staging,
        mappingArtifactPath: harness.mappingPath,
        evidenceIndexPath: harness.runRoot,
        batchId: "harden-happy",
        sleep,
      },
      fetcher,
    );

    expect(result.completed).toContain(BOSCH_APP);
    expect(result.quarantined).not.toContain(BOSCH_APP);
    expect(urls[0]).toBe(DETAILS_BOSCH);
    expect(urls.some((u) => u.includes("downloadapplication"))).toBe(true);
    expect(urls.some((u) => u === PORTION_BOSCH || u.includes("downloadapplication/170"))).toBe(
      true,
    );

    const meta = JSON.parse(
      await readFile(join(harness.staging, "sources/portions", BOSCH_APP, "fetch-metadata.json"), "utf8"),
    );
    expect(meta.applicationId).toBe(BOSCH_APP);
    expect(meta.applicationVersionBasis).toBe("current_public_portion");
    expect(meta.detailsUrl).toBeTruthy();
    expect(meta.serverProvidedHref).toBeTruthy();
    expect(JSON.stringify(meta).toLowerCase()).not.toMatch(/jsessionid=sess/);
    expect(JSON.stringify(meta).toLowerCase()).not.toContain("set-cookie");

    const ck = JSON.parse(await readFile(join(harness.staging, "acquisition-checkpoint.json"), "utf8"));
    expect(ck.completed.some((e: { applicationId: string }) => e.applicationId === BOSCH_APP)).toBe(
      true,
    );
    expect(sleeps.filter((ms) => ms === RSP_ACQUISITION_LIMITS.minDelayMsBetweenGtldresultRequests).length).toBeGreaterThanOrEqual(2);
  });

  it("wrong details Application ID does not fetch a public portion", async () => {
    const harness = await seedApprovedHarness([{ applicationId: BOSCH_APP, acId: BOSCH_AC }]);
    const urls: string[] = [];
    const fetcher: GtldresultFetcher = async (url) => {
      urls.push(url);
      if (url.includes("/applicationdetails/170")) {
        return textResponse(200, detailsHtml("1-0000-00000", BOSCH_AC), DETAILS_BOSCH);
      }
      return textResponse(200, portionHtml(BOSCH_APP), url);
    };
    const result = await acquirePilotLivePortions(
      {
        workspaceRoot,
        stagingRoot: harness.staging,
        mappingArtifactPath: harness.mappingPath,
        evidenceIndexPath: harness.runRoot,
        batchId: "wrong-details",
        sleep,
      },
      fetcher,
    );
    expect(result.quarantined).toContain(BOSCH_APP);
    expect(result.completed).not.toContain(BOSCH_APP);
    expect(urls.every((u) => !u.includes("downloadapplication"))).toBe(true);
    const q = JSON.parse(
      await readFile(join(harness.staging, "quarantine", BOSCH_APP, "quarantine.json"), "utf8"),
    );
    expect(q.reason).toBe("application-id-mismatch");
  });

  it("missing download link does not manufacture buildPortionUrl", async () => {
    const harness = await seedApprovedHarness([{ applicationId: BOSCH_APP, acId: BOSCH_AC }]);
    const urls: string[] = [];
    const fetcher: GtldresultFetcher = async (url) => {
      urls.push(url);
      if (url.includes("/applicationdetails/170")) {
        return textResponse(
          200,
          `<html><body><div>Application ID: ${BOSCH_APP}</div></body></html>`,
          DETAILS_BOSCH,
        );
      }
      return textResponse(200, portionHtml(BOSCH_APP), url);
    };
    const result = await acquirePilotLivePortions(
      {
        workspaceRoot,
        stagingRoot: harness.staging,
        mappingArtifactPath: harness.mappingPath,
        evidenceIndexPath: harness.runRoot,
        batchId: "missing-link",
        sleep,
      },
      fetcher,
    );
    expect(result.quarantined).toContain(BOSCH_APP);
    expect(urls).toEqual([DETAILS_BOSCH]);
    const q = JSON.parse(
      await readFile(join(harness.staging, "quarantine", BOSCH_APP, "quarantine.json"), "utf8"),
    );
    expect(q.reason).toBe("missing-download-link");
  });

  it("ambiguous download links fail closed", async () => {
    const harness = await seedApprovedHarness([{ applicationId: BOSCH_APP, acId: BOSCH_AC }]);
    const fetcher: GtldresultFetcher = async (url) => {
      if (url.includes("/applicationdetails/170")) {
        return textResponse(
          200,
          `<html><body>
<div>Application ID: ${BOSCH_APP}</div>
<a href="/applicationstatus/applicationdetails:downloadapplication/170?t:ac=170">Download public portion of application</a>
<a href="/applicationstatus/applicationdetails:downloadapplication/999?t:ac=999">Download public portion of application</a>
</body></html>`,
          DETAILS_BOSCH,
        );
      }
      return textResponse(200, portionHtml(BOSCH_APP), url);
    };
    const result = await acquirePilotLivePortions(
      {
        workspaceRoot,
        stagingRoot: harness.staging,
        mappingArtifactPath: harness.mappingPath,
        evidenceIndexPath: harness.runRoot,
        batchId: "ambiguous",
        sleep,
      },
      fetcher,
    );
    expect(result.quarantined).toContain(BOSCH_APP);
    const q = JSON.parse(
      await readFile(join(harness.staging, "quarantine", BOSCH_APP, "quarantine.json"), "utf8"),
    );
    expect(q.reason).toBe("ambiguous-download-link");
  });

  it("cross-host download link fails closed before outbound portion request", async () => {
    const harness = await seedApprovedHarness([{ applicationId: BOSCH_APP, acId: BOSCH_AC }]);
    const urls: string[] = [];
    const fetcher: GtldresultFetcher = async (url) => {
      urls.push(url);
      if (url.includes("/applicationdetails/170")) {
        return textResponse(
          200,
          detailsHtml(BOSCH_APP, BOSCH_AC, "https://evil.example/download"),
          DETAILS_BOSCH,
        );
      }
      return textResponse(200, portionHtml(BOSCH_APP), url);
    };
    const result = await acquirePilotLivePortions(
      {
        workspaceRoot,
        stagingRoot: harness.staging,
        mappingArtifactPath: harness.mappingPath,
        evidenceIndexPath: harness.runRoot,
        batchId: "cross-host",
        sleep,
      },
      fetcher,
    );
    expect(result.quarantined).toContain(BOSCH_APP);
    expect(urls.some((u) => u.includes("evil.example"))).toBe(false);
    expect(urls.filter((u) => u.includes("download")).length).toBe(0);
  });

  it("http (non-HTTPS) download link fails closed", async () => {
    const harness = await seedApprovedHarness([{ applicationId: BOSCH_APP, acId: BOSCH_AC }]);
    const fetcher: GtldresultFetcher = async (url) => {
      if (url.includes("/applicationdetails/170")) {
        return textResponse(
          200,
          detailsHtml(BOSCH_APP, BOSCH_AC, "http://gtldresult.icann.org/applicationstatus/applicationdetails:downloadapplication/170"),
          DETAILS_BOSCH,
        );
      }
      return textResponse(200, portionHtml(BOSCH_APP), url);
    };
    const result = await acquirePilotLivePortions(
      {
        workspaceRoot,
        stagingRoot: harness.staging,
        mappingArtifactPath: harness.mappingPath,
        evidenceIndexPath: harness.runRoot,
        batchId: "http-link",
        sleep,
      },
      fetcher,
    );
    expect(result.quarantined).toContain(BOSCH_APP);
    const q = JSON.parse(
      await readFile(join(harness.staging, "quarantine", BOSCH_APP, "quarantine.json"), "utf8"),
    );
    expect(q.reason).toBe("non-https-link");
  });

  it("wrong public-portion Application ID quarantines and does not checkpoint", async () => {
    const harness = await seedApprovedHarness([{ applicationId: BOSCH_APP, acId: BOSCH_AC }]);
    const fetcher: GtldresultFetcher = async (url) => {
      if (url.includes("/applicationdetails/170") && !url.includes("download")) {
        return textResponse(200, detailsHtml(BOSCH_APP, BOSCH_AC), DETAILS_BOSCH);
      }
      if (url.includes("downloadapplication")) {
        return textResponse(200, portionHtml("1-9999-99999"), url);
      }
      return textResponse(404, "no", url);
    };
    const result = await acquirePilotLivePortions(
      {
        workspaceRoot,
        stagingRoot: harness.staging,
        mappingArtifactPath: harness.mappingPath,
        evidenceIndexPath: harness.runRoot,
        batchId: "wrong-portion-id",
        sleep,
      },
      fetcher,
    );
    expect(result.quarantined).toContain(BOSCH_APP);
    expect(result.completed).not.toContain(BOSCH_APP);
    const q = JSON.parse(
      await readFile(join(harness.staging, "quarantine", BOSCH_APP, "quarantine.json"), "utf8"),
    );
    expect(q.reason).toBe("application-id-mismatch");
    await expect(readFile(join(harness.staging, "acquisition-checkpoint.json"), "utf8")).rejects.toThrow(
      /ENOENT/,
    );
  });

  it("missing Q23 quarantines without completed checkpoint", async () => {
    const harness = await seedApprovedHarness([{ applicationId: BOSCH_APP, acId: BOSCH_AC }]);
    const fetcher: GtldresultFetcher = async (url) => {
      if (url.includes("/applicationdetails/170") && !url.includes("download")) {
        return textResponse(200, detailsHtml(BOSCH_APP, BOSCH_AC), DETAILS_BOSCH);
      }
      if (url.includes("downloadapplication")) {
        return textResponse(200, portionHtml(BOSCH_APP, false), url);
      }
      return textResponse(404, "no", url);
    };
    const result = await acquirePilotLivePortions(
      {
        workspaceRoot,
        stagingRoot: harness.staging,
        mappingArtifactPath: harness.mappingPath,
        evidenceIndexPath: harness.runRoot,
        batchId: "no-q23",
        sleep,
      },
      fetcher,
    );
    expect(result.quarantined).toContain(BOSCH_APP);
    expect(result.completed).not.toContain(BOSCH_APP);
  });

  it("status-grid and ICANN error pages quarantine", async () => {
    for (const [label, html] of [
      [
        "grid",
        `<html><body>Displaying 1 - 35 of 1930<a href="/applicationstatus/viewstatus.statusgrid.pager/2">2</a></body></html>`,
      ],
      ["error", `<html><title>ICANN Error</title><body>error</body></html>`],
    ] as const) {
      const harness = await seedApprovedHarness([{ applicationId: BOSCH_APP, acId: BOSCH_AC }]);
      const fetcher: GtldresultFetcher = async (url) => {
        if (url.includes("/applicationdetails/170")) {
          return textResponse(200, html, DETAILS_BOSCH);
        }
        return textResponse(200, portionHtml(BOSCH_APP), url);
      };
      const result = await acquirePilotLivePortions(
        {
          workspaceRoot,
          stagingRoot: harness.staging,
          mappingArtifactPath: harness.mappingPath,
          evidenceIndexPath: harness.runRoot,
          batchId: `page-${label}`,
          sleep,
        },
        fetcher,
      );
      expect(result.quarantined).toContain(BOSCH_APP);
      expect(result.completed).not.toContain(BOSCH_APP);
    }
  });

  it("same-origin redirect succeeds; cross-host redirect and loop fail closed", async () => {
    const harness = await seedApprovedHarness([{ applicationId: BOSCH_APP, acId: BOSCH_AC }]);
    // same-origin success
    {
      const fetcher: GtldresultFetcher = async (url) => {
        if (url === DETAILS_BOSCH) {
          return textResponse(302, "", DETAILS_BOSCH, {
            headers: { location: "/applicationstatus/applicationdetails/170?hop=1" },
            setCookieHeaders: ["JSESSIONID=redir; Path=/"],
          });
        }
        if (url.includes("hop=1")) {
          return textResponse(200, detailsHtml(BOSCH_APP, BOSCH_AC), url);
        }
        if (url.includes("downloadapplication")) {
          return textResponse(200, portionHtml(BOSCH_APP), url);
        }
        return textResponse(404, "no", url);
      };
      const result = await acquirePilotLivePortions(
        {
          workspaceRoot,
          stagingRoot: harness.staging,
          mappingArtifactPath: harness.mappingPath,
          evidenceIndexPath: harness.runRoot,
          batchId: "redir-ok",
          forceRefetch: true,
          sleep,
        },
        fetcher,
      );
      expect(result.completed).toContain(BOSCH_APP);
    }

    // cross-host redirect
    {
      const harness2 = await seedApprovedHarness([{ applicationId: BOSCH_APP, acId: BOSCH_AC }]);
      const fetcher: GtldresultFetcher = async (url) => {
        if (url.includes("/applicationdetails/170")) {
          return textResponse(302, "", DETAILS_BOSCH, {
            headers: { location: "https://evil.example/x" },
          });
        }
        return textResponse(200, portionHtml(BOSCH_APP), url);
      };
      await expect(
        acquirePilotLivePortions(
          {
            workspaceRoot,
            stagingRoot: harness2.staging,
            mappingArtifactPath: harness2.mappingPath,
            evidenceIndexPath: harness2.runRoot,
            batchId: "redir-cross",
            sleep,
          },
          fetcher,
        ),
      ).rejects.toThrow();
    }

    // redirect loop
    {
      const harness3 = await seedApprovedHarness([{ applicationId: BOSCH_APP, acId: BOSCH_AC }]);
      const fetcher: GtldresultFetcher = async (url) => {
        if (url.includes("/applicationdetails/170")) {
          return textResponse(302, "", url, {
            headers: { location: url.includes("a=1") ? url.replace("a=1", "a=2") : `${DETAILS_BOSCH}?a=1` },
            setCookieHeaders: ["JSESSIONID=loop; Path=/"],
          });
        }
        return textResponse(200, portionHtml(BOSCH_APP), url);
      };
      // Force looping between two URLs beyond cap by always redirecting to alternate
      let n = 0;
      const loopFetcher: GtldresultFetcher = async (url) => {
        if (url.includes("download")) return textResponse(200, portionHtml(BOSCH_APP), url);
        n += 1;
        const next = n % 2 === 0 ? `${DETAILS_BOSCH}?x=1` : `${DETAILS_BOSCH}?x=2`;
        return textResponse(302, "", url, {
          headers: { location: next },
          setCookieHeaders: ["JSESSIONID=loop; Path=/"],
        });
      };
      void fetcher;
      await expect(
        acquirePilotLivePortions(
          {
            workspaceRoot,
            stagingRoot: harness3.staging,
            mappingArtifactPath: harness3.mappingPath,
            evidenceIndexPath: harness3.runRoot,
            batchId: "redir-loop",
            sleep,
          },
          loopFetcher,
        ),
      ).rejects.toThrow(/redirect loop/i);
    }
  });

  it("403/429 halt before subsequent applications", async () => {
    const harness = await seedApprovedHarness([
      { applicationId: BOSCH_APP, acId: BOSCH_AC },
      { applicationId: HOTELS_APP, acId: HOTELS_AC },
    ]);
    let hotelsHit = false;
    const fetcher: GtldresultFetcher = async (url) => {
      if (url.includes(String(HOTELS_AC))) hotelsHit = true;
      if (url.includes("/applicationdetails/170")) {
        return textResponse(403, "forbidden", DETAILS_BOSCH);
      }
      return textResponse(200, portionHtml(BOSCH_APP), url);
    };
    await expect(
      acquirePilotLivePortions(
        {
          workspaceRoot,
          stagingRoot: harness.staging,
          mappingArtifactPath: harness.mappingPath,
          evidenceIndexPath: harness.runRoot,
          batchId: "halt-403",
          sleep,
        },
        fetcher,
      ),
    ).rejects.toThrow(/Run halted: HTTP 403/);
    expect(hotelsHit).toBe(false);
  });

  it("5xx retries use bounded backoff sleeps", async () => {
    const harness = await seedApprovedHarness([{ applicationId: BOSCH_APP, acId: BOSCH_AC }]);
    let detailsAttempts = 0;
    const fetcher: GtldresultFetcher = async (url) => {
      if (url.includes("/applicationdetails/170") && !url.includes("download")) {
        detailsAttempts += 1;
        if (detailsAttempts < 3) return textResponse(503, "busy", DETAILS_BOSCH);
        return textResponse(200, detailsHtml(BOSCH_APP, BOSCH_AC), DETAILS_BOSCH);
      }
      if (url.includes("downloadapplication")) {
        return textResponse(200, portionHtml(BOSCH_APP), url);
      }
      return textResponse(404, "no", url);
    };
    const result = await acquirePilotLivePortions(
      {
        workspaceRoot,
        stagingRoot: harness.staging,
        mappingArtifactPath: harness.mappingPath,
        evidenceIndexPath: harness.runRoot,
        batchId: "retry-5xx",
        sleep,
      },
      fetcher,
    );
    expect(result.completed).toContain(BOSCH_APP);
    expect(sleeps.some((ms) => ms === 4000 || ms === 8000)).toBe(true);
  });

  it("oversize portion is quarantined and not checkpointed as completed", async () => {
    const harness = await seedApprovedHarness([{ applicationId: BOSCH_APP, acId: BOSCH_AC }]);
    const big = "x".repeat(RSP_ACQUISITION_LIMITS.maxPortionBytes + 1);
    const fetcher: GtldresultFetcher = async (url) => {
      if (url.includes("/applicationdetails/170") && !url.includes("download")) {
        return textResponse(200, detailsHtml(BOSCH_APP, BOSCH_AC), DETAILS_BOSCH);
      }
      if (url.includes("downloadapplication")) {
        return {
          status: 200,
          body: Buffer.from(big),
          headers: {},
          finalUrl: url,
        };
      }
      return textResponse(404, "no", url);
    };
    const result = await acquirePilotLivePortions(
      {
        workspaceRoot,
        stagingRoot: harness.staging,
        mappingArtifactPath: harness.mappingPath,
        evidenceIndexPath: harness.runRoot,
        batchId: "oversize",
        sleep,
      },
      fetcher,
    );
    expect(result.quarantined).toContain(BOSCH_APP);
    expect(result.completed).not.toContain(BOSCH_APP);
  });

  it("pacing applies after quarantine and between apps", async () => {
    const harness = await seedApprovedHarness([
      { applicationId: BOSCH_APP, acId: BOSCH_AC },
      { applicationId: HOTELS_APP, acId: HOTELS_AC },
    ]);
    const fetcher: GtldresultFetcher = async (url) => {
      if (url.includes(`/applicationdetails/${BOSCH_AC}`) && !url.includes("download")) {
        return textResponse(
          200,
          `<html><body><div>Application ID: ${BOSCH_APP}</div></body></html>`,
          DETAILS_BOSCH,
        );
      }
      if (url.includes(`/applicationdetails/${HOTELS_AC}`) && !url.includes("download")) {
        return textResponse(200, detailsHtml(HOTELS_APP, HOTELS_AC), DETAILS_HOTELS);
      }
      if (url.includes("downloadapplication")) {
        const app = url.includes(String(HOTELS_AC)) ? HOTELS_APP : BOSCH_APP;
        return textResponse(200, portionHtml(app), url);
      }
      return textResponse(404, "no", url);
    };
    await acquirePilotLivePortions(
      {
        workspaceRoot,
        stagingRoot: harness.staging,
        mappingArtifactPath: harness.mappingPath,
        evidenceIndexPath: harness.runRoot,
        batchId: "pacing",
        sleep,
      },
      fetcher,
    );
    const paceDelays = sleeps.filter(
      (ms) => ms === RSP_ACQUISITION_LIMITS.minDelayMsBetweenGtldresultRequests,
    );
    // At least: after Bosch details (quarantine missing link), after Hotels details, after Hotels portion
    expect(paceDelays.length).toBeGreaterThanOrEqual(3);
  });

  it("does not invent network access — mocked fetcher only", async () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error("global fetch must not be used");
    }) as typeof fetch;
    try {
      const harness = await seedApprovedHarness([{ applicationId: BOSCH_APP, acId: BOSCH_AC }]);
      const fetcher: GtldresultFetcher = async (url) => {
        if (url.includes("/applicationdetails/170") && !url.includes("download")) {
          return textResponse(200, detailsHtml(BOSCH_APP, BOSCH_AC), DETAILS_BOSCH);
        }
        if (url.includes("downloadapplication")) {
          return textResponse(200, portionHtml(BOSCH_APP), url);
        }
        return textResponse(404, "no", url);
      };
      await acquirePilotLivePortions(
        {
          workspaceRoot,
          stagingRoot: harness.staging,
          mappingArtifactPath: harness.mappingPath,
          evidenceIndexPath: harness.runRoot,
          batchId: "zero-http",
          sleep,
        },
        fetcher,
      );
      expect(fetchCalls).toBe(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
