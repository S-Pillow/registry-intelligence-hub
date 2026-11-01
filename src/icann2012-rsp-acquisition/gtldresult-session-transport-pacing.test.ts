import { describe, expect, it } from "vitest";
import { RSP_ACQUISITION_LIMITS, RETRY_BACKOFF_MS } from "./constants";
import {
  GtldresultSessionTransport,
  type GtldresultFetcher,
  type GtldresultHttpResponse,
} from "./gtldresult-session-transport";
import { buildDetailsUrl, buildPortionUrl } from "./urls";

const DETAILS = buildDetailsUrl(170);
const PORTION = buildPortionUrl(170);
const MIN = RSP_ACQUISITION_LIMITS.minDelayMsBetweenGtldresultRequests;

function textResponse(
  status: number,
  body: string,
  url: string,
  extra?: { headers?: Record<string, string>; setCookieHeaders?: string[] },
): GtldresultHttpResponse {
  return {
    status,
    body: Buffer.from(body),
    headers: extra?.headers ?? {},
    finalUrl: url,
    setCookieHeaders: extra?.setCookieHeaders ?? ["JSESSIONID=t; Path=/"],
  };
}

function fakeClock() {
  let nowMs = 0;
  const sleeps: number[] = [];
  const outboundAt: number[] = [];
  return {
    sleeps,
    outboundAt,
    now: () => nowMs,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      nowMs += ms;
    },
    markOutbound: () => {
      outboundAt.push(nowMs);
    },
  };
}

describe("GtldresultSessionTransport outbound pacing + request accounting", () => {
  it("paces details → portion (2 requests, ≥1000ms gap)", async () => {
    const clock = fakeClock();
    const fetcher: GtldresultFetcher = async (url) => {
      clock.markOutbound();
      return textResponse(200, "ok", url);
    };
    const transport = new GtldresultSessionTransport(fetcher, clock.sleep, clock.now);
    await transport.get(DETAILS);
    await transport.get(PORTION);
    expect(transport.getOutboundRequestCount()).toBe(2);
    expect(clock.outboundAt).toEqual([0, MIN]);
    expect(clock.sleeps).toEqual([MIN]);
  });

  it("paces details request → redirect hop → portion (3 requests)", async () => {
    const clock = fakeClock();
    const hop = `${DETAILS}?hop=1`;
    const fetcher: GtldresultFetcher = async (url) => {
      clock.markOutbound();
      if (url === DETAILS) {
        return textResponse(302, "", DETAILS, {
          headers: { location: hop },
          setCookieHeaders: ["JSESSIONID=a; Path=/"],
        });
      }
      return textResponse(200, "ok", url);
    };
    const transport = new GtldresultSessionTransport(fetcher, clock.sleep, clock.now);
    await transport.get(DETAILS);
    await transport.get(PORTION);
    expect(transport.getOutboundRequestCount()).toBe(3);
    expect(clock.outboundAt).toEqual([0, MIN, MIN * 2]);
    expect(clock.sleeps.filter((ms) => ms === MIN)).toHaveLength(2);
  });

  it("paces portion-side redirect", async () => {
    const clock = fakeClock();
    const hop = `${PORTION}&hop=1`;
    const fetcher: GtldresultFetcher = async (url) => {
      clock.markOutbound();
      if (url === PORTION) {
        return textResponse(302, "", PORTION, {
          headers: { location: hop },
          setCookieHeaders: ["JSESSIONID=a; Path=/"],
        });
      }
      return textResponse(200, "ok", url);
    };
    const transport = new GtldresultSessionTransport(fetcher, clock.sleep, clock.now);
    await transport.get(DETAILS);
    await transport.get(PORTION);
    expect(transport.getOutboundRequestCount()).toBe(3);
    expect(clock.outboundAt[2]! - clock.outboundAt[1]!).toBe(MIN);
  });

  it("paces every hop in a multi-redirect chain", async () => {
    const clock = fakeClock();
    let hop = 0;
    const fetcher: GtldresultFetcher = async (url) => {
      clock.markOutbound();
      if (hop < 2) {
        hop += 1;
        return textResponse(302, "", url, {
          headers: { location: `${DETAILS}?n=${hop}` },
          setCookieHeaders: ["JSESSIONID=a; Path=/"],
        });
      }
      return textResponse(200, "ok", url);
    };
    const transport = new GtldresultSessionTransport(fetcher, clock.sleep, clock.now);
    await transport.get(DETAILS);
    expect(transport.getOutboundRequestCount()).toBe(3);
    expect(clock.outboundAt).toEqual([0, MIN, MIN * 2]);
  });

  it("5xx retry backoff satisfies minimum without an extra 1000ms sleep", async () => {
    const clock = fakeClock();
    let attempts = 0;
    const fetcher: GtldresultFetcher = async (url) => {
      clock.markOutbound();
      attempts += 1;
      if (attempts === 1) return textResponse(503, "busy", url);
      return textResponse(200, "ok", url);
    };
    const transport = new GtldresultSessionTransport(fetcher, clock.sleep, clock.now);
    await transport.get(DETAILS);
    expect(transport.getOutboundRequestCount()).toBe(2);
    expect(clock.sleeps).toContain(RETRY_BACKOFF_MS[0]);
    // After 4s backoff, paceBeforeOutbound must not add another 1000ms.
    expect(clock.sleeps.filter((ms) => ms === MIN)).toHaveLength(0);
    expect(clock.outboundAt[1]! - clock.outboundAt[0]!).toBe(RETRY_BACKOFF_MS[0]);
  });

  it("counts one details redirect as 3 total with portion (happy accounting)", async () => {
    const clock = fakeClock();
    const fetcher: GtldresultFetcher = async (url) => {
      if (url === DETAILS) {
        return textResponse(302, "", DETAILS, {
          headers: { location: `${DETAILS}?r=1` },
          setCookieHeaders: ["JSESSIONID=a; Path=/"],
        });
      }
      return textResponse(200, "ok", url);
    };
    const transport = new GtldresultSessionTransport(fetcher, clock.sleep, clock.now);
    await transport.get(DETAILS);
    await transport.get(PORTION);
    expect(transport.getOutboundRequestCount()).toBe(3);
  });

  it("counts two 5xx retries then success on details + portion as 4", async () => {
    const clock = fakeClock();
    let detailsAttempts = 0;
    const fetcher: GtldresultFetcher = async (url) => {
      if (url.startsWith(DETAILS.split("?")[0]!) && !url.includes("download")) {
        detailsAttempts += 1;
        if (detailsAttempts < 3) return textResponse(503, "busy", url);
        return textResponse(200, "ok", url);
      }
      return textResponse(200, "ok", url);
    };
    const transport = new GtldresultSessionTransport(fetcher, clock.sleep, clock.now);
    await transport.get(DETAILS);
    await transport.get(PORTION);
    expect(transport.getOutboundRequestCount()).toBe(4);
  });
});
