import {
  assertAllowedGtldresultRedirect,
  assertAllowedGtldresultRequestUrl,
} from "./network-target-policy";
import { redactForbiddenFetchMetadataKeys } from "./fetch-metadata-contract";
import { GTLDRESULT_ORIGIN, RSP_ACQUISITION_LIMITS, RETRY_BACKOFF_MS } from "./constants";
import { absoluteGtldresultUrl } from "./urls";
import { PaginationSafetyError } from "./viewstatus-page-meta";

export interface GtldresultHttpResponse {
  status: number;
  body: Uint8Array;
  headers: Record<string, string>;
  finalUrl: string;
}

export type GtldresultFetcher = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<GtldresultHttpResponse>;

/** In-memory hop record. URL fields may still contain query secrets; persist only after redaction. */
export interface SafePagerExchange {
  requestedUrl: string;
  pagerStatus: number | null;
  redirectLocation: string | null;
  redirectCount: number;
  finalUrl: string;
  sessionCookieSent: boolean;
  intermediateSetCookieObserved: boolean;
}

export class PagerTransactionError extends PaginationSafetyError {
  constructor(message: string) {
    super(message);
    this.name = "PagerTransactionError";
  }
}

const MAX_REDIRECTS = 5;

export function responseHasSetCookie(headers: Record<string, string>): boolean {
  return Object.keys(headers).some((key) => key.toLowerCase() === "set-cookie" && Boolean(headers[key]));
}

export interface SleepFn {
  (ms: number): Promise<void>;
}

export const defaultSleep: SleepFn = (ms) => new Promise((r) => setTimeout(r, ms));

/** In-memory same-origin cookie jar — never persisted. */
export class GtldresultSessionTransport {
  private cookies = new Map<string, string>();
  private lastExchange: SafePagerExchange | null = null;

  constructor(
    private readonly fetchImpl: GtldresultFetcher,
    private readonly sleep: SleepFn = defaultSleep,
  ) {}

  getCookieHeaderForRequest(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  getLastExchange(): SafePagerExchange | null {
    return this.lastExchange;
  }

  /** Returns redacted safe headers for snapshot metadata (no Set-Cookie / CSRF). */
  redactResponseHeaders(headers: Record<string, string>): Record<string, string> {
    return redactForbiddenFetchMetadataKeys(headers);
  }

  ingestSetCookieHeaders(headers: Record<string, string>, responseUrl: string): void {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() !== "set-cookie") continue;
      if (!value) continue;
      this.applySetCookie(value);
    }
    void responseUrl;
  }

  private applySetCookie(value: string): void {
    const parts = value
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean);
    const nameValue = parts[0] ?? "";
    const eq = nameValue.indexOf("=");
    if (eq <= 0) return;
    const name = nameValue.slice(0, eq).trim();
    const cookieValue = nameValue.slice(eq + 1).trim();
    if (!name) return;
    const maxAgePart = parts.find((part) => part.toLowerCase().startsWith("max-age="));
    const maxAge = maxAgePart ? Number(maxAgePart.slice(maxAgePart.indexOf("=") + 1)) : null;
    if ((maxAge != null && Number.isFinite(maxAge) && maxAge <= 0) || cookieValue.length === 0) {
      this.cookies.delete(name);
      return;
    }
    this.cookies.set(name, cookieValue);
  }

  clearSession(): void {
    this.cookies.clear();
    this.lastExchange = null;
  }

  async waitBetweenRequests(): Promise<void> {
    await this.sleep(RSP_ACQUISITION_LIMITS.minDelayMsBetweenGtldresultRequests);
  }

  /**
   * One exchange, including same-origin redirects.
   * Set-Cookie on a 302 is applied before the next hop. Redirects are not left
   * to an opaque follower that would drop intermediate session updates.
   */
  async get(url: string): Promise<GtldresultHttpResponse> {
    assertAllowedGtldresultRequestUrl(url);
    const requestedUrl = url;
    let current = url;
    const visited = new Set<string>();
    let redirectCount = 0;
    let pagerStatus: number | null = null;
    let redirectLocation: string | null = null;
    let sessionCookieSent = false;
    let intermediateSetCookieObserved = false;

    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (visited.has(current)) {
        throw new PagerTransactionError("redirect loop");
      }
      visited.add(current);

      const cookieHeader = this.getCookieHeaderForRequest();
      const pagerHop = hop === 0 && isPagerRequest(current);
      if (hop === 0) sessionCookieSent = Boolean(cookieHeader);
      if (pagerHop && !cookieHeader) {
        await this.fetchOnce(current, undefined);
        throw new PagerTransactionError("pager request receives no session cookie");
      }
      if (hop > 0 && !cookieHeader) {
        throw new PagerTransactionError("redirect loses session state");
      }

      const response = await this.fetchOnce(current, cookieHeader);
      if (hop === 0) pagerStatus = response.status;
      const setCookie = responseHasSetCookie(response.headers);
      const redirecting = response.status >= 300 && response.status < 400;
      if (redirecting && setCookie) intermediateSetCookieObserved = true;

      if (!redirecting) {
        this.lastExchange = {
          requestedUrl,
          pagerStatus,
          redirectLocation,
          redirectCount,
          finalUrl: current,
          sessionCookieSent,
          intermediateSetCookieObserved,
        };
        return { ...response, finalUrl: current };
      }

      const location = response.headers.location ?? response.headers.Location;
      if (!location) {
        this.lastExchange = {
          requestedUrl,
          pagerStatus,
          redirectLocation,
          redirectCount,
          finalUrl: current,
          sessionCookieSent,
          intermediateSetCookieObserved,
        };
        return { ...response, finalUrl: current };
      }
      if (redirectLocation == null) redirectLocation = location;
      const next = resolveRedirectTarget(current, location);
      assertAllowedGtldresultRedirect(current, next);
      redirectCount += 1;
      if (redirectCount > MAX_REDIRECTS) {
        throw new PagerTransactionError("redirect loop");
      }
      current = next;
    }
    throw new PagerTransactionError("redirect loop");
  }

  private async fetchOnce(
    url: string,
    cookieHeader: string | undefined,
  ): Promise<GtldresultHttpResponse> {
    assertAllowedGtldresultRequestUrl(url);
    const headers: Record<string, string> = { Accept: "text/html,*/*" };
    if (cookieHeader) headers.Cookie = cookieHeader;

    let lastStatus = 0;
    for (let attempt = 0; attempt < RSP_ACQUISITION_LIMITS.maxRetriesPerUrl; attempt++) {
      const response = await this.fetchImpl(url, { headers });
      lastStatus = response.status;
      this.ingestSetCookieHeaders(response.headers, response.finalUrl || url);

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

function isPagerRequest(url: string): boolean {
  try {
    return /\/viewstatus\.statusgrid\.pager\/\d+\/?$/.test(new URL(url).pathname);
  } catch {
    return /viewstatus\.statusgrid\.pager\/\d+/.test(url);
  }
}

function resolveRedirectTarget(fromUrl: string, location: string): string {
  return new URL(location, fromUrl).toString();
}

export interface RedirectFollowingFetcherOptions {
  onRedirect?: (fromUrl: string, toUrl: string) => void;
  maxRedirects?: number;
}

/**
 * Same-host redirect wrapper for tests that inject a bare fetcher.
 * Live pager hops use GtldresultSessionTransport.get, which applies
 * intermediate Set-Cookie before the next request. This wrapper does not.
 */
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

/**
 * Node fetch adapter with redirect:"manual".
 * Session-aware redirect following lives in GtldresultSessionTransport.get.
 * Tests should inject mocks instead of calling this against ICANN.
 */
export function createNodeGtldresultFetcher(): GtldresultFetcher {
  return async (url, init) => {
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
    const setCookies = response.headers.getSetCookie?.() ?? [];
    if (setCookies.length > 0) {
      headers["set-cookie"] = setCookies[0] ?? "";
    } else if (response.headers.get("set-cookie")) {
      headers["set-cookie"] = response.headers.get("set-cookie") ?? "";
    }
    return {
      status: response.status,
      body,
      headers,
      finalUrl: url,
    };
  };
}

export function assertSameOriginUrl(url: string): void {
  assertAllowedGtldresultRequestUrl(url);
  const parsed = new URL(url);
  if (parsed.origin !== GTLDRESULT_ORIGIN) {
    throw new Error(`Rejected non-gtldresult origin: ${url}`);
  }
}
