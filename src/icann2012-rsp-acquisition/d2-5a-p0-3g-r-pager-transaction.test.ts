import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stagingIndexPageFetchMetadataPath } from "./bundle-paths";
import { GTLDRESULT_PATHS, RSP_MAPPING_LIVE_AUTH_ENV } from "./constants";
import { resolveGtldresultTapestryUrl } from "./gtldresult-url-resolver";
import {
  GtldresultSessionTransport,
  type GtldresultFetcher,
  type GtldresultHttpResponse,
} from "./gtldresult-session-transport";
import { readMappingLiveCheckpoint, mappingLiveCheckpointPath } from "./mapping-checkpoint";
import { runMappingLive } from "./mapping-live";
import { runMappingReview } from "./mapping-review";
import { NetworkTargetPolicyError } from "./network-target-policy";
import { executePagerTransaction } from "./pager-transaction";
import { absoluteGtldresultUrl } from "./urls";
import { classifyViewstatusPageHtml } from "./viewstatus-page-classification";

const workspaceRoot = join(process.cwd());
const noSleep = async () => undefined;
const GRID = absoluteGtldresultUrl(GTLDRESULT_PATHS.viewStatusGrid);
const HUB = absoluteGtldresultUrl(GTLDRESULT_PATHS.statusHub);
const HREF = "/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=SECRET";
const PAGER = resolveGtldresultTapestryUrl(GRID, HREF);
const VIEW = "https://gtldresult.icann.org/applicationstatus/viewstatus";

function gridHtml(start: number, end: number, total: number): string {
  return `<!DOCTYPE html><html><body>
<div>Displaying ${start} - ${end} of ${total}</div>
<ul class="pagination"><li class="active" aria-current="page"><a href="#">2</a></li></ul>
<table><tr><td><a href="/applicationstatus/viewstatus:viewapplicationdetails/900002">Details</a></td></tr>
<tr class="detail"><td>Application ID: <span>1-9999-00002</span></td></tr></table>
</body></html>`;
}

const ERROR_HTML = `<html><head><title>ICANN Error</title></head><body>ICANN Error page</body></html>`;

function textResponse(
  status: number,
  body: string,
  headers: Record<string, string>,
  url: string,
): GtldresultHttpResponse {
  return {
    status,
    body: Buffer.from(body),
    headers,
    finalUrl: url,
  };
}

describe("D2.5A-P0.3G-R pager transaction (offline)", () => {
  it("keeps the selected page-2 href on /applicationstatus and does not choose 56", () => {
    expect(PAGER).toBe(
      "https://gtldresult.icann.org/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=SECRET",
    );
    expect(PAGER).not.toContain("/application-result/");
    expect(PAGER).not.toContain("pager/56");
  });

  it("follows 302 with the same SESSION and lands on 36-70", async () => {
    const calls: Array<{ url: string; cookie: string | null }> = [];
    const fetcher: GtldresultFetcher = async (url, init) => {
      const cookie = init?.headers?.Cookie ?? null;
      calls.push({ url, cookie });
      if (url === HUB) {
        return textResponse(200, "hub", { "set-cookie": "SESSION=A; Path=/; HttpOnly" }, url);
      }
      if (url === PAGER) {
        return textResponse(302, "", { location: "/applicationstatus/viewstatus" }, url);
      }
      if (url === VIEW) {
        return textResponse(200, gridHtml(36, 70, 1930), { "content-type": "text/html" }, url);
      }
      return textResponse(404, "missing", {}, url);
    };
    const transport = new GtldresultSessionTransport(fetcher, noSleep);
    await transport.get(HUB);
    const result = await executePagerTransaction({
      transport,
      contextUrl: GRID,
      serverProvidedHref: HREF,
      expectedDisplay: { displayStart: 36, displayEnd: 70, displayTotal: 1930 },
    });

    expect(calls.find((call) => call.url === PAGER)?.cookie).toBe("SESSION=A");
    expect(calls.find((call) => call.url === VIEW)?.cookie).toBe("SESSION=A");
    expect(calls.some((call) => call.url.includes("/application-result/applicationstatus/viewstatus"))).toBe(
      false,
    );
    expect(result.transaction.pagerStatus).toBe(302);
    expect(result.transaction.redirectLocation).toBe("/applicationstatus/viewstatus");
    expect(result.transaction.redirectCount).toBe(1);
    expect(result.transaction.finalUrl).toBe(VIEW);
    expect(result.transaction.sessionCookieSent).toBe(true);
    expect(result.transaction.intermediateSetCookieObserved).toBe(false);
    expect(result.transaction.displayStart).toBe(36);
    expect(result.transaction.displayEnd).toBe(70);
    expect(result.transaction.displayTotal).toBe(1930);
    expect(result.transaction.pagerRequestedUrl).toContain("_csrf=REDACTED");
    expect(result.transaction.pagerRequestedUrl).not.toContain("SECRET");
    expect(result.transaction.serverProvidedHref).toContain("pager/2");
    expect(result.transaction.serverProvidedHref).not.toContain("SECRET");
    const serialized = JSON.stringify(result.transaction);
    expect(serialized).not.toContain("SESSION=");
    expect(serialized).not.toContain("SECRET");
  });

  it("applies Set-Cookie from the 302 before the redirect hop", async () => {
    const calls: Array<{ url: string; cookie: string | null }> = [];
    const fetcher: GtldresultFetcher = async (url, init) => {
      const cookie = init?.headers?.Cookie ?? null;
      calls.push({ url, cookie });
      if (url === HUB) {
        return textResponse(200, "hub", { "set-cookie": "SESSION=A; Path=/; HttpOnly" }, url);
      }
      if (url === PAGER) {
        return textResponse(
          302,
          "",
          {
            location: "/applicationstatus/viewstatus",
            "set-cookie": "SESSION=B; Path=/; HttpOnly",
          },
          url,
        );
      }
      if (url === VIEW) {
        const body =
          cookie === "SESSION=B" ? gridHtml(36, 70, 1930) : gridHtml(1, 35, 1930);
        return textResponse(200, body, { "content-type": "text/html" }, url);
      }
      return textResponse(404, "missing", {}, url);
    };
    const transport = new GtldresultSessionTransport(fetcher, noSleep);
    await transport.get(HUB);
    const result = await executePagerTransaction({
      transport,
      contextUrl: GRID,
      serverProvidedHref: HREF,
      expectedDisplay: { displayStart: 36, displayEnd: 70, displayTotal: 1930 },
    });
    expect(calls.find((call) => call.url === PAGER)?.cookie).toBe("SESSION=A");
    expect(calls.find((call) => call.url === VIEW)?.cookie).toBe("SESSION=B");
    expect(result.transaction.intermediateSetCookieObserved).toBe(true);
    expect(result.transaction.sessionCookieSent).toBe(true);
    expect(JSON.stringify(result.transaction)).not.toContain("SESSION=");
  });

  it("fails closed when the pager request has no session cookie", async () => {
    const calls: string[] = [];
    const fetcher: GtldresultFetcher = async (url) => {
      calls.push(url);
      return textResponse(200, gridHtml(36, 70, 1930), {}, url);
    };
    const transport = new GtldresultSessionTransport(fetcher, noSleep);
    await expect(
      executePagerTransaction({
        transport,
        contextUrl: GRID,
        serverProvidedHref: HREF,
        expectedDisplay: { displayStart: 36, displayEnd: 70, displayTotal: 1930 },
      }),
    ).rejects.toThrow(/pager request receives no session cookie/);
    expect(calls).toContain(PAGER);
    expect(calls).not.toContain(VIEW);
  });

  it("fails closed when the redirect would lose session state", async () => {
    const calls: string[] = [];
    const fetcher: GtldresultFetcher = async (url, init) => {
      calls.push(url);
      if (url === HUB) {
        return textResponse(200, "hub", { "set-cookie": "SESSION=A; Path=/; HttpOnly" }, url);
      }
      if (url === PAGER) {
        expect(init?.headers?.Cookie).toBe("SESSION=A");
        return textResponse(
          302,
          "",
          { location: "/applicationstatus/viewstatus", "set-cookie": "SESSION=; Max-Age=0" },
          url,
        );
      }
      return textResponse(200, gridHtml(36, 70, 1930), {}, url);
    };
    const transport = new GtldresultSessionTransport(fetcher, noSleep);
    await transport.get(HUB);
    await expect(
      executePagerTransaction({
        transport,
        contextUrl: GRID,
        serverProvidedHref: HREF,
      }),
    ).rejects.toThrow(/redirect loses session state/);
    expect(calls).not.toContain(VIEW);
  });

  it("rejects a cross-host 302 Location", async () => {
    const fetcher: GtldresultFetcher = async (url) => {
      if (url === HUB) {
        return textResponse(200, "hub", { "set-cookie": "SESSION=A; Path=/; HttpOnly" }, url);
      }
      if (url === PAGER) {
        return textResponse(302, "", { location: "https://evil.example/applicationstatus/viewstatus" }, url);
      }
      return textResponse(200, gridHtml(36, 70, 1930), {}, url);
    };
    const transport = new GtldresultSessionTransport(fetcher, noSleep);
    await transport.get(HUB);
    await expect(
      executePagerTransaction({ transport, contextUrl: GRID, serverProvidedHref: HREF }),
    ).rejects.toThrow(NetworkTargetPolicyError);
  });

  it("fails closed on a redirect loop", async () => {
    const fetcher: GtldresultFetcher = async (url) => {
      if (url === HUB) {
        return textResponse(200, "hub", { "set-cookie": "SESSION=A; Path=/; HttpOnly" }, url);
      }
      if (url === PAGER) {
        return textResponse(302, "", { location: "/applicationstatus/viewstatus" }, url);
      }
      if (url === VIEW) {
        return textResponse(302, "", { location: HREF }, url);
      }
      return textResponse(404, "missing", {}, url);
    };
    const transport = new GtldresultSessionTransport(fetcher, noSleep);
    await transport.get(HUB);
    await expect(
      executePagerTransaction({ transport, contextUrl: GRID, serverProvidedHref: HREF }),
    ).rejects.toThrow(/redirect loop/);
  });

  it("fails closed when the final page is an ICANN error page", async () => {
    const fetcher: GtldresultFetcher = async (url) => {
      if (url === HUB) {
        return textResponse(200, "hub", { "set-cookie": "SESSION=A; Path=/; HttpOnly" }, url);
      }
      if (url === PAGER) {
        return textResponse(302, "", { location: "/applicationstatus/viewstatus" }, url);
      }
      if (url === VIEW) return textResponse(200, ERROR_HTML, {}, url);
      return textResponse(404, "missing", {}, url);
    };
    const transport = new GtldresultSessionTransport(fetcher, noSleep);
    await transport.get(HUB);
    await expect(
      executePagerTransaction({ transport, contextUrl: GRID, serverProvidedHref: HREF }),
    ).rejects.toThrow(/final page is ICANN_ERROR_PAGE/);
    expect(classifyViewstatusPageHtml(ERROR_HTML)).toBe("ICANN_ERROR_PAGE");
  });

  it("fails closed when the final range is not 36-70", async () => {
    const fetcher: GtldresultFetcher = async (url) => {
      if (url === HUB) {
        return textResponse(200, "hub", { "set-cookie": "SESSION=A; Path=/; HttpOnly" }, url);
      }
      if (url === PAGER) {
        return textResponse(302, "", { location: "/applicationstatus/viewstatus" }, url);
      }
      if (url === VIEW) return textResponse(200, gridHtml(1, 35, 1930), {}, url);
      return textResponse(404, "missing", {}, url);
    };
    const transport = new GtldresultSessionTransport(fetcher, noSleep);
    await transport.get(HUB);
    await expect(
      executePagerTransaction({
        transport,
        contextUrl: GRID,
        serverProvidedHref: HREF,
        expectedDisplay: { displayStart: 36, displayEnd: 70, displayTotal: 1930 },
      }),
    ).rejects.toThrow(/final range is not 36-70 when 36-70 is expected/);
  });

  it("persists the safe pager transaction from a mapping-live replay", async () => {
    const page1 = `<!DOCTYPE html><html><body>
<div>Displaying 1 - 35 of 1930</div>
<ul class="pagination">
  <li class="active" aria-current="page"><a href="#">1</a></li>
  <li><a title="Go to page 2" href="${HREF}">2</a></li>
  <li><a title="Go to page 56" href="/applicationstatus/viewstatus.statusgrid.pager/56?_csrf=SECRET">56</a></li>
</ul>
<table><tr><td><a href="/applicationstatus/viewstatus:viewapplicationdetails/900001">Details</a></td></tr>
<tr class="detail"><td>Application ID: <span>1-9999-00001</span></td></tr></table>
<ul class="pagination">
  <li class="active" aria-current="page"><a href="#">1</a></li>
  <li><a title="Go to page 2" href="${HREF}">2</a></li>
  <li><a title="Go to page 56" href="/applicationstatus/viewstatus.statusgrid.pager/56?_csrf=SECRET">56</a></li>
</ul>
</body></html>`;
    const calls: Array<{ url: string; cookie: string | null }> = [];
    const fetcher: GtldresultFetcher = async (url, init) => {
      calls.push({ url, cookie: init?.headers?.Cookie ?? null });
      if (url === HUB) {
        return textResponse(200, "hub", { "set-cookie": "SESSION=A; Path=/; HttpOnly" }, url);
      }
      if (url === GRID) return textResponse(200, page1, { "content-type": "text/html" }, url);
      if (url === PAGER) {
        return textResponse(302, "", { location: "/applicationstatus/viewstatus" }, url);
      }
      if (url === VIEW) return textResponse(200, gridHtml(36, 70, 1930), { "content-type": "text/html" }, url);
      return textResponse(404, "missing", {}, url);
    };

    const staging = await mkdtemp(join(tmpdir(), "rsp-p03gr-"));
    const prev = process.env[RSP_MAPPING_LIVE_AUTH_ENV];
    process.env[RSP_MAPPING_LIVE_AUTH_ENV] = "1";
    const runId = "pager-transaction";
    try {
      const live = await runMappingLive(
        { workspaceRoot, stagingRoot: staging, runId, forceNewRun: true, sleep: noSleep },
        fetcher,
      );
      expect(live.pagesFetched).toBe(2);
      expect(calls.find((call) => call.url === PAGER)?.cookie).toBe("SESSION=A");
      expect(calls.find((call) => call.url === VIEW)?.cookie).toBe("SESSION=A");
      expect(calls.some((call) => call.url.includes("pager/56"))).toBe(false);

      const checkpoint = await readMappingLiveCheckpoint(mappingLiveCheckpointPath(staging));
      const page2 = checkpoint?.pages.find((page) => page.pageOrdinal === 2);
      expect(page2?.diagnostics.displayStart).toBe(36);
      expect(page2?.diagnostics.displayEnd).toBe(70);
      expect(page2?.diagnostics.pagerTransaction?.pagerStatus).toBe(302);
      expect(page2?.diagnostics.pagerTransaction?.redirectLocation).toBe("/applicationstatus/viewstatus");
      expect(page2?.diagnostics.pagerTransaction?.redirectCount).toBe(1);
      expect(page2?.diagnostics.pagerTransaction?.finalUrl).toBe(VIEW);
      expect(page2?.diagnostics.pagerTransaction?.sessionCookieSent).toBe(true);
      expect(page2?.diagnostics.pagerTransaction?.intermediateSetCookieObserved).toBe(false);
      expect(page2?.diagnostics.pagerTransaction?.pagerRequestedUrl).not.toContain("/application-result/");
      expect(page2?.diagnostics.pagerTransaction?.pagerRequestedUrl).toContain("_csrf=REDACTED");

      const metadata = JSON.parse(
        await readFile(stagingIndexPageFetchMetadataPath(staging, runId, 2), "utf8"),
      ) as { pagerTransaction?: { sessionCookieSent?: boolean; pagerRequestedUrl?: string } };
      expect(metadata.pagerTransaction?.sessionCookieSent).toBe(true);
      expect(metadata.pagerTransaction?.pagerRequestedUrl).toContain("_csrf=REDACTED");
      const stored = JSON.stringify(metadata.pagerTransaction);
      expect(stored).not.toContain("SESSION=");
      expect(stored).not.toContain("SECRET");
      expect(metadata.pagerTransaction?.pagerRequestedUrl).toContain("_csrf=REDACTED");
      expect(JSON.stringify(checkpoint?.pages.find((page) => page.pageOrdinal === 2)?.diagnostics.pagerTransaction)).not.toContain(
        "SESSION=",
      );
      expect(JSON.stringify(checkpoint)).not.toContain("SESSION=");

      const review = await runMappingReview({ workspaceRoot, runDir: staging });
      expect(review.failureClassification).not.toBe("INTEGRITY_FAILURE");
      expect(review.integrityFailures).toHaveLength(0);
    } finally {
      process.env[RSP_MAPPING_LIVE_AUTH_ENV] = prev;
      await rm(staging, { recursive: true, force: true });
    }
  });
});
