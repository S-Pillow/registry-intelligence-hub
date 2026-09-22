import {
  assertAllowedGtldresultRedirect,
  assertAllowedGtldresultRequestUrl,
} from "./network-target-policy";
import { redactForbiddenFetchMetadataKeys } from "./fetch-metadata-contract";
import { GTLDRESULT_ORIGIN, RSP_ACQUISITION_LIMITS, RETRY_BACKOFF_MS } from "./constants";
import { absoluteGtldresultUrl } from "./urls";

export interface GtldresultHttpResponse {
  status: number;
  body: Uint8Array;
  headers: Record<string, string>;
  finalUrl: string;
}

export type GtldresultFetcher = (url: string) => Promise<GtldresultHttpResponse>;

export interface SleepFn {
  (ms: number): Promise<void>;
}

export const defaultSleep: SleepFn = (ms) => new Promise((r) => setTimeout(r, ms));

/** In-memory same-origin cookie jar — never persisted. */
export class GtldresultSessionTransport {
  private cookies = new Map<string, string>();

  constructor(
    private readonly fetchImpl: GtldresultFetcher,
    private readonly sleep: SleepFn = defaultSleep,
  ) {}

  getCookieHeaderForRequest(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  /** Returns redacted safe headers for snapshot metadata (no Set-Cookie / CSRF). */
  redactResponseHeaders(headers: Record<string, string>): Record<string, string> {
    return redactForbiddenFetchMetadataKeys(headers);
  }

  ingestSetCookieHeaders(headers: Record<string, string>, responseUrl: string): void {
    const host = new URL(responseUrl).hostname;
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() !== "set-cookie") continue;
      if (!value) continue;
      const nameValue = value.split(";")[0]?.trim();
      if (!nameValue) continue;
      const eq = nameValue.indexOf("=");
      if (eq <= 0) continue;
      const name = nameValue.slice(0, eq);
      const cookieValue = nameValue.slice(eq + 1);
      this.cookies.set(name, cookieValue);
    }
    void host;
  }

  clearSession(): void {
    this.cookies.clear();
  }

  async waitBetweenRequests(): Promise<void> {
    await this.sleep(RSP_ACQUISITION_LIMITS.minDelayMsBetweenGtldresultRequests);
  }

  async get(url: string): Promise<GtldresultHttpResponse> {
    assertAllowedGtldresultRequestUrl(url);
    const headers: Record<string, string> = { Accept: "text/html,*/*" };
    const cookieHeader = this.getCookieHeaderForRequest();
    if (cookieHeader) headers.Cookie = cookieHeader;

    let lastStatus = 0;
    for (let attempt = 0; attempt < RSP_ACQUISITION_LIMITS.maxRetriesPerUrl; attempt++) {
      const response = await this.fetchImpl(url);
      lastStatus = response.status;
      this.ingestSetCookieHeaders(response.headers, response.finalUrl);

      if (response.status === 429 || response.status === 403) {
        throw new Error(`Run halted: HTTP ${response.status} on ${url}`);
      }
      if (response.status >= 500) {
        const delay = RETRY_BACKOFF_MS[Math.min(attempt, RETRY_BACKOFF_MS.length - 1)];
        await this.sleep(delay);
        continue;
      }
      return response;
    }
    throw new Error(`Transport exhausted for ${url} (last HTTP ${lastStatus})`);
  }
}

export interface RedirectFollowingFetcherOptions {
  onRedirect?: (fromUrl: string, toUrl: string) => void;
  maxRedirects?: number;
}

/** Wraps a base fetcher to follow same-host HTTPS redirects and reject cross-host. */
export function createRedirectFollowingFetcher(
  base: (url: string, init?: { headers?: Record<string, string> }) => Promise<GtldresultHttpResponse>,
  options: RedirectFollowingFetcherOptions = {},
): GtldresultFetcher {
  const maxRedirects = options.maxRedirects ?? 5;
  return async (startUrl: string) => {
    let current = startUrl;
    for (let hop = 0; hop <= maxRedirects; hop++) {
      const response = await base(current);
      if (response.status < 300 || response.status >= 400) {
        return { ...response, finalUrl: current };
      }
      const location = response.headers.location ?? response.headers.Location;
      if (!location) {
        return { ...response, finalUrl: current };
      }
      const next = absoluteGtldresultUrl(location);
      assertAllowedGtldresultRedirect(current, next);
      options.onRedirect?.(current, next);
      current = next;
    }
    throw new Error(`Too many redirects from ${startUrl}`);
  };
}

/** Node fetch adapter — tests should inject mocks instead of calling this against ICANN. */
export function createNodeGtldresultFetcher(): GtldresultFetcher {
  return createRedirectFollowingFetcher(async (url, init) => {
    assertAllowedGtldresultRequestUrl(url);
    const response = await fetch(url, {
      headers: init?.headers ?? { Accept: "text/html,*/*" },
      redirect: "manual",
    });
    const body = new Uint8Array(await response.arrayBuffer());
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    if (response.headers.get("set-cookie")) {
      headers["set-cookie"] = response.headers.get("set-cookie") ?? "";
    }
    return {
      status: response.status,
      body,
      headers,
      finalUrl: url,
    };
  });
}

export function assertSameOriginUrl(url: string): void {
  assertAllowedGtldresultRequestUrl(url);
  const parsed = new URL(url);
  if (parsed.origin !== GTLDRESULT_ORIGIN) {
    throw new Error(`Rejected non-gtldresult origin: ${url}`);
  }
}
