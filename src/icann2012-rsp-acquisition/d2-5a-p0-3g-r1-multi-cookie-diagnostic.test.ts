import { describe, expect, it } from "vitest";
import { assertPagerDiagnosticAuthGate } from "./auth-gates";
import { networkPolicyForCommand } from "./command-mode";
import {
  GTLDRESULT_PATHS,
  RSP_MAPPING_LIVE_AUTH_ENV,
  RSP_PAGER_DIAGNOSTIC_AUTH_ENV,
} from "./constants";
import {
  createNodeGtldresultFetcher,
  GtldresultSessionTransport,
  readFetchSetCookieHeaders,
  type GtldresultFetcher,
  type GtldresultHttpResponse,
} from "./gtldresult-session-transport";
import { runMappingLive } from "./mapping-live";
import {
  createPagerDiagnosticBudget,
  formatPagerLiveDiagnosticReport,
  PAGER_DIAGNOSTIC_HTTP_CEILING,
  redirectLocationPath,
  runPagerLiveDiagnostic,
} from "./pager-live-diagnostic";
import { resolveGtldresultTapestryUrl } from "./gtldresult-url-resolver";
import { assertNoSensitiveArtifactMaterial } from "./sensitive-artifact-guard";
import { absoluteGtldresultUrl } from "./urls";
import { parseViewstatusGridHtml } from "./viewstatus-parser";

const workspaceRoot = process.cwd();
const noSleep = async () => undefined;
const HUB = absoluteGtldresultUrl(GTLDRESULT_PATHS.statusHub);
const GRID = absoluteGtldresultUrl(GTLDRESULT_PATHS.viewStatusGrid);
const PAGE2_HREF = "/applicationstatus/viewstatus.statusgrid.pager/2?_csrf=SECRET";
const PAGE3_HREF = "/applicationstatus/viewstatus.statusgrid.pager/3?_csrf=SECRET";
const PAGE56_HREF = "/applicationstatus/viewstatus.statusgrid.pager/56?_csrf=SECRET";
const PAGER = resolveGtldresultTapestryUrl(GRID, PAGE2_HREF);
const PAGER3 = resolveGtldresultTapestryUrl(GRID, PAGE3_HREF);
const VIEW = "https://gtldresult.icann.org/applicationstatus/viewstatus";
const ERROR_HTML = `<html><head><title>ICANN Error</title></head><body>ICANN Error page</body></html>`;

function textResponse(
  status: number,
  body: string,
  headers: Record<string, string>,
  url: string,
  setCookieHeaders?: readonly string[],
): GtldresultHttpResponse {
  return {
    status,
    body: Buffer.from(body),
    headers,
    finalUrl: url,
    setCookieHeaders,
  };
}

function pagerRegion(links: string): string {
  return `<ul class="pagination">${links}</ul>`;
}

function activePage(label: number): string {
  return `<li class="active" aria-current="page"><a aria-disabled="true" href="#">${label}</a></li>`;
}

function pageLink(label: number, href: string): string {
  return `<li><a title="Go to page ${label}" href="${href}">${label}</a></li>`;
}

function gridRows(count: number, idStart: number): string {
  return Array.from({ length: count }, (_, index) => {
    const n = idStart + index;
    const app = `1-2100-${String(n).padStart(5, "0")}`;
    const ac = 910000 + n;
    return `<tr><td><a href="/applicationstatus/viewstatus:viewapplicationdetails/${ac}">Details</a></td></tr><tr class="detail"><td>Application ID: <span>${app}</span></td></tr>`;
  }).join("");
}

function controls(active: number, links: string): string {
  const body = `${activePage(active)}${links}`;
  return `${pagerRegion(body)}${pagerRegion(body)}`;
}

function page1Html(): string {
  return `<!DOCTYPE html><html><body>
<div>Displaying 1 - 35 of 1930</div>
${controls(1, `${pageLink(2, PAGE2_HREF)}${pageLink(56, PAGE56_HREF)}`)}
${gridRows(1, 1)}
</body></html>`;
}

function page2Html(start: number, end: number, total: number, rowCount: number): string {
  return `<!DOCTYPE html><html><body>
<div>Displaying ${start} - ${end} of ${total}</div>
${controls(2, `${pageLink(3, PAGE3_HREF)}${pageLink(56, PAGE56_HREF)}`)}
${gridRows(rowCount, 100)}
<form><input name="formdata" value="FORMDATA_SECRET"></form>
</body></html>`;
}

async function withEnv(
  name: string,
  value: string | undefined,
  fn: () => Promise<void>,
): Promise<void> {
  const prev = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  try {
    await fn();
  } finally {
    if (prev === undefined) delete process.env[name];
    else process.env[name] = prev;
  }
}

describe("D2.5A-P0.3G-R1 multi-cookie transport and pager diagnostic", () => {
  it("stores every Set-Cookie line and does not comma-split Expires", async () => {
    const fetcher: GtldresultFetcher = async (url) =>
      textResponse(
        200,
        "hub",
        {
          "set-cookie":
            "SESSION=A; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/, OTHER=SHOULD_NOT_SPLIT",
        },
        url,
      );
    const transport = new GtldresultSessionTransport(fetcher, noSleep);
    await transport.get(HUB);
    expect(transport.getCookieHeaderForRequest()).toBe("SESSION=A");

    const steps: Array<readonly string[]> = [
      [
        "SESSION=A; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; HttpOnly",
        "OTHER=X; Path=/",
      ],
      ["OTHER=Z; Path=/"],
    ];
    let step = 0;
    const multi = new GtldresultSessionTransport(async (url) => {
      const lines = steps[step] ?? [];
      step += 1;
      return textResponse(200, "hub", {}, url, lines);
    }, noSleep);
    await multi.get(HUB);
    expect(multi.getCookieHeaderForRequest()).toBe("SESSION=A; OTHER=X");
    await multi.get(HUB);
    expect(multi.getCookieHeaderForRequest()).toBe("SESSION=A; OTHER=Z");
  });

  it("reads every Node Set-Cookie header via getSetCookie()", async () => {
    const headers = new Headers();
    headers.append(
      "set-cookie",
      "SESSION=A; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; HttpOnly",
    );
    headers.append("set-cookie", "OTHER=X; Path=/");
    expect(readFetchSetCookieHeaders(headers)).toEqual([
      "SESSION=A; Expires=Wed, 21 Oct 2015 07:28:00 GMT; Path=/; HttpOnly",
      "OTHER=X; Path=/",
    ]);
    expect(headers.get("set-cookie")).toContain(", OTHER=X");

    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response("hub", { status: 200, headers });
    try {
      const transport = new GtldresultSessionTransport(createNodeGtldresultFetcher(), noSleep);
      await transport.get(HUB);
      expect(transport.getCookieHeaderForRequest()).toBe("SESSION=A; OTHER=X");
      expect(transport.getLastExchange()?.setCookieHeaderCount).toBe(2);
      const serialized = JSON.stringify(transport.getLastExchange());
      expect(serialized).not.toContain("SESSION=A");
      expect(serialized).not.toContain("OTHER=X");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("follows page 1 SESSION=A through pager/2 to 36-70 and stops", async () => {
    const calls: string[] = [];
    const fetcher: GtldresultFetcher = async (url, init) => {
      calls.push(url);
      if (url === HUB) {
        return textResponse(200, "hub", { "set-cookie": "SESSION=A; Path=/; HttpOnly" }, url);
      }
      if (url === GRID) return textResponse(200, page1Html(), {}, url);
      if (url === PAGER) {
        expect(init?.headers?.Cookie).toBe("SESSION=A");
        return textResponse(302, "", { location: "/applicationstatus/viewstatus" }, url);
      }
      if (url === VIEW) {
        expect(init?.headers?.Cookie).toBe("SESSION=A");
        return textResponse(200, page2Html(36, 70, 1930, 35), {}, url);
      }
      return textResponse(404, "missing", {}, url);
    };
    expect(parseViewstatusGridHtml(page2Html(36, 70, 1930, 35)).rows).toHaveLength(35);

    await withEnv(RSP_PAGER_DIAGNOSTIC_AUTH_ENV, "1", async () => {
      const report = await runPagerLiveDiagnostic({ sleep: noSleep }, fetcher);
      expect(report.classification).toBe("PAGER_PAGE2_OK");
      expect(report.pagerLabelSelected).toBe(2);
      expect(report.serverProvidedHref).toContain("pager/2");
      expect(report.serverProvidedHref).toContain("_csrf=REDACTED");
      expect(report.serverProvidedHref).not.toContain("SECRET");
      expect(report.pagerStatus).toBe(302);
      expect(report.redirectCount).toBe(1);
      expect(report.redirectLocationPath).toBe("/applicationstatus/viewstatus");
      expect(report.finalUrl).toBe(VIEW);
      expect(report.sessionCookieSent).toBe(true);
      expect(report.setCookieHeaderCount).toBe(0);
      expect(report.sessionUpdatedDuringTransaction).toBe(false);
      expect(report.displayStart).toBe(36);
      expect(report.displayEnd).toBe(70);
      expect(report.displayTotal).toBe(1930);
      expect(report.parsedRowCount).toBe(35);
      expect(report.icannErrorPage).toBe(false);
      expect(report.httpRequestCount).toBe(4);
      expect(report.httpRequestCount).toBeLessThanOrEqual(PAGER_DIAGNOSTIC_HTTP_CEILING);
      expect(report.requestCeiling).toBe(18);
      expect(calls).not.toContain(PAGER3);
      expect(calls.some((url) => url.includes("pager/56"))).toBe(false);
      expect(calls.some((url) => url.includes("downloadapplication"))).toBe(false);
      const serialized = JSON.stringify(report);
      expect(serialized).not.toContain("SECRET");
      expect(serialized).not.toContain("SESSION=");
      expect(serialized).not.toContain("FORMDATA");
      assertNoSensitiveArtifactMaterial(serialized, "pager-diagnostic.json");
      expect(formatPagerLiveDiagnosticReport(report)).toContain("Set-Cookie count: 0");
      expect(formatPagerLiveDiagnosticReport(report)).not.toContain("SECRET");
    });
  });

  it("applies every pager Set-Cookie and sends the rotated SESSION on the redirect", async () => {
    const calls: Array<{ url: string; cookie: string | null }> = [];
    const fetcher: GtldresultFetcher = async (url, init) => {
      const cookie = init?.headers?.Cookie ?? null;
      calls.push({ url, cookie });
      if (url === HUB) {
        return textResponse(200, "hub", {}, url, [
          "SESSION=A; Path=/; HttpOnly",
          "OTHER=X; Path=/",
        ]);
      }
      if (url === GRID) return textResponse(200, page1Html(), {}, url);
      if (url === PAGER) {
        return textResponse(302, "", { location: "/applicationstatus/viewstatus" }, url, [
          "SESSION=B; Path=/; HttpOnly",
          "OTHER=Y; Path=/",
        ]);
      }
      if (url === VIEW) {
        const body =
          cookie === "SESSION=B; OTHER=Y" ? page2Html(36, 70, 1930, 35) : page2Html(1, 35, 1930, 1);
        return textResponse(200, body, {}, url);
      }
      return textResponse(404, "missing", {}, url);
    };

    await withEnv(RSP_PAGER_DIAGNOSTIC_AUTH_ENV, "1", async () => {
      const report = await runPagerLiveDiagnostic({ sleep: noSleep }, fetcher);
      expect(calls.find((call) => call.url === PAGER)?.cookie).toBe("SESSION=A; OTHER=X");
      expect(calls.find((call) => call.url === VIEW)?.cookie).toBe("SESSION=B; OTHER=Y");
      expect(report.classification).toBe("PAGER_PAGE2_OK");
      expect(report.sessionUpdatedDuringTransaction).toBe(true);
      expect(report.setCookieHeaderCount).toBe(2);
      expect(report.sessionCookieSent).toBe(true);
      expect(report.parsedRowCount).toBe(35);
      const serialized = JSON.stringify(report);
      expect(serialized).not.toContain("SESSION=");
      expect(serialized).not.toContain("OTHER=");
      expect(serialized).not.toContain("SECRET");
      assertNoSensitiveArtifactMaterial(serialized, "pager-diagnostic.json");
    });
  });

  it("does not let an unrelated Set-Cookie replace SESSION", async () => {
    const calls: Array<{ url: string; cookie: string | null }> = [];
    const fetcher: GtldresultFetcher = async (url, init) => {
      calls.push({ url, cookie: init?.headers?.Cookie ?? null });
      if (url === HUB) {
        return textResponse(200, "hub", {}, url, [
          "SESSION=A; Path=/; HttpOnly",
          "OTHER=X; Path=/",
        ]);
      }
      if (url === GRID) return textResponse(200, page1Html(), {}, url);
      if (url === PAGER) {
        return textResponse(302, "", { location: "/applicationstatus/viewstatus" }, url, [
          "OTHER=Y; Path=/",
        ]);
      }
      if (url === VIEW) return textResponse(200, page2Html(36, 70, 1930, 35), {}, url);
      return textResponse(404, "missing", {}, url);
    };
    await withEnv(RSP_PAGER_DIAGNOSTIC_AUTH_ENV, "1", async () => {
      const report = await runPagerLiveDiagnostic({ sleep: noSleep }, fetcher);
      expect(calls.find((call) => call.url === VIEW)?.cookie).toBe("SESSION=A; OTHER=Y");
      expect(report.classification).toBe("PAGER_PAGE2_OK");
      expect(report.sessionUpdatedDuringTransaction).toBe(false);
      expect(report.setCookieHeaderCount).toBe(1);
      expect(JSON.stringify(report)).not.toContain("OTHER=");
    });
  });

  it("stops when the pager request has no session", async () => {
    const calls: string[] = [];
    const fetcher: GtldresultFetcher = async (url) => {
      calls.push(url);
      if (url === HUB || url === GRID) return textResponse(200, url === GRID ? page1Html() : "hub", {}, url);
      if (url === PAGER) return textResponse(302, "", { location: "/applicationstatus/viewstatus" }, url);
      return textResponse(200, page2Html(36, 70, 1930, 35), {}, url);
    };
    await withEnv(RSP_PAGER_DIAGNOSTIC_AUTH_ENV, "1", async () => {
      const report = await runPagerLiveDiagnostic({ sleep: noSleep }, fetcher);
      expect(report.classification).toBe("STOPPED_NO_SESSION");
      expect(report.sessionCookieSent).toBe(false);
      expect(calls).toContain(PAGER);
      expect(calls).not.toContain(VIEW);
      expect(calls).not.toContain(PAGER3);
    });
  });

  it("stops on a cross-host redirect without requesting the other host", async () => {
    const calls: string[] = [];
    const fetcher: GtldresultFetcher = async (url) => {
      calls.push(url);
      if (url === HUB) return textResponse(200, "hub", { "set-cookie": "SESSION=A; Path=/" }, url);
      if (url === GRID) return textResponse(200, page1Html(), {}, url);
      if (url === PAGER) {
        return textResponse(302, "", { location: "https://evil.example/applicationstatus/viewstatus" }, url);
      }
      return textResponse(200, page2Html(36, 70, 1930, 35), {}, url);
    };
    await withEnv(RSP_PAGER_DIAGNOSTIC_AUTH_ENV, "1", async () => {
      const report = await runPagerLiveDiagnostic({ sleep: noSleep }, fetcher);
      expect(report.classification).toBe("STOPPED_CROSS_HOST_REDIRECT");
      expect(calls.every((url) => url.startsWith("https://gtldresult.icann.org/"))).toBe(true);
      expect(calls).not.toContain(PAGER3);
    });
  });

  it("stops on a redirect loop inside the request ceiling", async () => {
    const calls: string[] = [];
    const fetcher: GtldresultFetcher = async (url) => {
      calls.push(url);
      if (url === HUB) return textResponse(200, "hub", { "set-cookie": "SESSION=A; Path=/" }, url);
      if (url === GRID) return textResponse(200, page1Html(), {}, url);
      if (url === PAGER) return textResponse(302, "", { location: "/applicationstatus/viewstatus" }, url);
      if (url === VIEW) return textResponse(302, "", { location: PAGE2_HREF }, url);
      return textResponse(404, "missing", {}, url);
    };
    await withEnv(RSP_PAGER_DIAGNOSTIC_AUTH_ENV, "1", async () => {
      const report = await runPagerLiveDiagnostic({ sleep: noSleep }, fetcher);
      expect(report.classification).toBe("STOPPED_REDIRECT_LOOP");
      expect(report.httpRequestCount).toBeLessThanOrEqual(PAGER_DIAGNOSTIC_HTTP_CEILING);
      expect(calls).not.toContain(PAGER3);
    });
  });

  it("stops on an ICANN error page", async () => {
    const calls: string[] = [];
    const fetcher: GtldresultFetcher = async (url) => {
      calls.push(url);
      if (url === HUB) return textResponse(200, "hub", { "set-cookie": "SESSION=A; Path=/" }, url);
      if (url === GRID) return textResponse(200, page1Html(), {}, url);
      if (url === PAGER) return textResponse(302, "", { location: "/applicationstatus/viewstatus" }, url);
      if (url === VIEW) return textResponse(200, ERROR_HTML, {}, url);
      return textResponse(404, "missing", {}, url);
    };
    await withEnv(RSP_PAGER_DIAGNOSTIC_AUTH_ENV, "1", async () => {
      const report = await runPagerLiveDiagnostic({ sleep: noSleep }, fetcher);
      expect(report.classification).toBe("STOPPED_ICANN_ERROR_PAGE");
      expect(report.icannErrorPage).toBe(true);
      expect(calls).not.toContain(PAGER3);
      expect(JSON.stringify(report)).not.toContain("SESSION=");
    });
  });

  it("stops and reports an incorrect final range without continuing", async () => {
    const calls: string[] = [];
    const fetcher: GtldresultFetcher = async (url) => {
      calls.push(url);
      if (url === HUB) return textResponse(200, "hub", { "set-cookie": "SESSION=A; Path=/" }, url);
      if (url === GRID) return textResponse(200, page1Html(), {}, url);
      if (url === PAGER) return textResponse(302, "", { location: "/applicationstatus/viewstatus" }, url);
      if (url === VIEW) return textResponse(200, page2Html(1, 35, 1930, 35), {}, url);
      return textResponse(404, "missing", {}, url);
    };
    await withEnv(RSP_PAGER_DIAGNOSTIC_AUTH_ENV, "1", async () => {
      const report = await runPagerLiveDiagnostic({ sleep: noSleep }, fetcher);
      expect(report.classification).toBe("STOPPED_UNEXPECTED_PAGE_SIZE");
      expect(report.displayStart).toBe(1);
      expect(report.displayEnd).toBe(35);
      expect(report.displayTotal).toBe(1930);
      expect(report.detail).toContain("1-35 of 1930");
      expect(calls.filter((url) => url === VIEW)).toHaveLength(1);
      expect(calls).not.toContain(PAGER3);
    });
  });

  it("stops when the server uses a different page size", async () => {
    const calls: string[] = [];
    const fetcher: GtldresultFetcher = async (url) => {
      calls.push(url);
      if (url === HUB) return textResponse(200, "hub", { "set-cookie": "SESSION=A; Path=/" }, url);
      if (url === GRID) return textResponse(200, page1Html(), {}, url);
      if (url === PAGER) return textResponse(302, "", { location: "/applicationstatus/viewstatus" }, url);
      if (url === VIEW) return textResponse(200, page2Html(36, 90, 1930, 55), {}, url);
      return textResponse(404, "missing", {}, url);
    };
    await withEnv(RSP_PAGER_DIAGNOSTIC_AUTH_ENV, "1", async () => {
      const report = await runPagerLiveDiagnostic({ sleep: noSleep }, fetcher);
      expect(report.classification).toBe("STOPPED_UNEXPECTED_PAGE_SIZE");
      expect(report.displayStart).toBe(36);
      expect(report.displayEnd).toBe(90);
      expect(report.displayTotal).toBe(1930);
      expect(report.parsedRowCount).toBe(55);
      expect(calls).not.toContain(PAGER3);
      expect(report.httpRequestCount).toBe(4);
    });
  });

  it("stops when the range matches but the parsed row count is not 35", async () => {
    const fetcher: GtldresultFetcher = async (url) => {
      if (url === HUB) return textResponse(200, "hub", { "set-cookie": "SESSION=A; Path=/" }, url);
      if (url === GRID) return textResponse(200, page1Html(), {}, url);
      if (url === PAGER) return textResponse(302, "", { location: "/applicationstatus/viewstatus" }, url);
      if (url === VIEW) return textResponse(200, page2Html(36, 70, 1930, 10), {}, url);
      return textResponse(404, "missing", {}, url);
    };
    await withEnv(RSP_PAGER_DIAGNOSTIC_AUTH_ENV, "1", async () => {
      const report = await runPagerLiveDiagnostic({ sleep: noSleep }, fetcher);
      expect(report.classification).toBe("STOPPED_ROW_COUNT_MISMATCH");
      expect(report.displayStart).toBe(36);
      expect(report.displayEnd).toBe(70);
      expect(report.parsedRowCount).toBe(10);
    });
  });

  it("hard-stops after logical page 2 and enforces the HTTP ceiling", async () => {
    const calls: string[] = [];
    const fetcher: GtldresultFetcher = async (url) => {
      calls.push(url);
      if (url === HUB) return textResponse(200, "hub", { "set-cookie": "SESSION=A; Path=/" }, url);
      if (url === GRID) return textResponse(200, page1Html(), {}, url);
      if (url === PAGER) return textResponse(302, "", { location: "/applicationstatus/viewstatus" }, url);
      if (url === VIEW) return textResponse(200, page2Html(36, 70, 1930, 35), {}, url);
      throw new Error(`unexpected diagnostic request ${url}`);
    };
    await withEnv(RSP_PAGER_DIAGNOSTIC_AUTH_ENV, "1", async () => {
      const report = await runPagerLiveDiagnostic({ sleep: noSleep }, fetcher);
      expect(report.classification).toBe("PAGER_PAGE2_OK");
      expect(report.stoppedAfterLogicalPage).toBe(2);
      expect(calls).toEqual([HUB, GRID, PAGER, VIEW]);
    });

    const budgetCalls: string[] = [];
    const budget = createPagerDiagnosticBudget(async (url) => {
      budgetCalls.push(url);
      return textResponse(200, "ok", {}, url);
    });
    await expect(budget.fetcher(PAGER3)).rejects.toThrow(/refused a pager URL/);
    await expect(
      budget.fetcher(absoluteGtldresultUrl(GTLDRESULT_PATHS.downloadPublicPortion(1))),
    ).rejects.toThrow(/cannot download application portions/);
    expect(budgetCalls).toEqual([]);
    for (let i = 0; i < PAGER_DIAGNOSTIC_HTTP_CEILING; i += 1) {
      await budget.fetcher(HUB);
    }
    await expect(budget.fetcher(HUB)).rejects.toThrow(/ceiling/);
    expect(budgetCalls).toHaveLength(PAGER_DIAGNOSTIC_HTTP_CEILING);
    budget.seal();
    await expect(budget.fetcher(HUB)).rejects.toThrow(/hard stop/);
    expect(budgetCalls).toHaveLength(PAGER_DIAGNOSTIC_HTTP_CEILING);
  });

  it("performs zero HTTP when diagnostic authorization is absent", async () => {
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
      await withEnv(RSP_PAGER_DIAGNOSTIC_AUTH_ENV, undefined, async () => {
        await withEnv(RSP_MAPPING_LIVE_AUTH_ENV, "1", async () => {
          await expect(runPagerLiveDiagnostic({ sleep: noSleep }, fetcher)).rejects.toThrow(
            /PAGER_DIAGNOSTIC_AUTHORIZED/,
          );
          await expect(runPagerLiveDiagnostic()).rejects.toThrow(/does not authorize this command/);
          expect(assertPagerDiagnosticAuthGate).toThrow(/MAPPING_AUTHORIZED/);
        });
      });
      expect(calls).toEqual([]);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("keeps mapping-live on its own authorization gate", async () => {
    const diagnostic = networkPolicyForCommand("pager-live-diagnostic");
    const mapping = networkPolicyForCommand("mapping-live");
    expect(diagnostic.requiresPagerDiagnosticAuth).toBe(true);
    expect(diagnostic.requiresMappingLiveAuth).toBe(false);
    expect(mapping.requiresMappingLiveAuth).toBe(true);
    expect(mapping.requiresPagerDiagnosticAuth).toBe(false);
    expect(redirectLocationPath("https://gtldresult.icann.org/applicationstatus/viewstatus?_csrf=SECRET")).toBe(
      "/applicationstatus/viewstatus?_csrf=REDACTED",
    );

    const calls: string[] = [];
    const fetcher: GtldresultFetcher = async (url) => {
      calls.push(url);
      throw new Error("mapping HTTP must not run");
    };
    await withEnv(RSP_PAGER_DIAGNOSTIC_AUTH_ENV, "1", async () => {
      await withEnv(RSP_MAPPING_LIVE_AUTH_ENV, undefined, async () => {
        await expect(
          runMappingLive({ workspaceRoot, stagingRoot: "/tmp/rsp-diagnostic-must-not-run", runId: "nope" }, fetcher),
        ).rejects.toThrow(/MAPPING_AUTHORIZED/);
        expect(calls).toEqual([]);
      });
    });
  });
});
