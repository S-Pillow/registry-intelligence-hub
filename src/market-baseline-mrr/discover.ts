import { compactToPeriod } from "./period";
import { fetchBounded } from "./http";
import type { DiscoveredTldPage, ReportingPeriod } from "./types";
import { MRR_INDEX_URL } from "./types";

const ICANN_ORIGIN = "https://www.icann.org";

export function absoluteIcannUrl(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${ICANN_ORIGIN}${href}`;
  return `${ICANN_ORIGIN}/${href}`;
}

/** Extract TLD report page links from the registry-reports index HTML. */
export function parseRegistryReportsIndex(html: string): Array<{ tldAsciiLabel: string; resourcePageUrl: string }> {
  const out: Array<{ tldAsciiLabel: string; resourcePageUrl: string }> = [];
  const seen = new Set<string>();
  // Anchor text like ".xyz" or "xyz" pointing at /resources/pages/<slug>-YYYY-MM-DD-en
  const re =
    /href="(\/resources\/pages\/[^"]+)"[^>]*>\s*\.?([a-z0-9](?:[a-z0-9-]*[a-z0-9])?)\s*</gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const href = m[1]!;
    const label = m[2]!.toLowerCase();
    // Skip non-TLD navigation that matches pattern sparsely
    if (href.includes("registry-reports")) continue;
    if (label === "en" || label.length > 63) continue;
    if (seen.has(label)) continue;
    // Prefer pages that look like TLD report pages (dated slug)
    if (!/-\d{4}-\d{2}-\d{2}-en$/i.test(href.split("/").pop() ?? "")) continue;
    seen.add(label);
    out.push({ tldAsciiLabel: label, resourcePageUrl: absoluteIcannUrl(href) });
  }
  out.sort((a, b) => a.tldAsciiLabel.localeCompare(b.tldAsciiLabel));
  return out;
}

const TX_LINK_RE =
  /href="([^"]*?\/mrr\/([a-z0-9-]+)\/\2-transactions-(\d{6})(?:-en)?\.csv)"/gi;
const ACT_LINK_RE =
  /href="([^"]*?\/mrr\/([a-z0-9-]+)\/\2-activity-(\d{6})(?:-en)?\.csv)"/gi;

export function parseTldReportPage(
  html: string,
  expectedTld: string,
  resourcePageUrl: string,
): DiscoveredTldPage {
  const tld = expectedTld.toLowerCase();
  const transactionsByPeriod: Record<ReportingPeriod, string> = {};
  const activityByPeriod: Record<ReportingPeriod, string> = {};

  let m: RegExpExecArray | null;
  const txRe = new RegExp(TX_LINK_RE.source, "gi");
  while ((m = txRe.exec(html))) {
    const href = m[1]!;
    const fileTld = m[2]!.toLowerCase();
    const compact = m[3]!;
    if (fileTld !== tld) continue;
    const period = compactToPeriod(compact);
    transactionsByPeriod[period] = absoluteIcannUrl(href);
  }
  const actRe = new RegExp(ACT_LINK_RE.source, "gi");
  while ((m = actRe.exec(html))) {
    const href = m[1]!;
    const fileTld = m[2]!.toLowerCase();
    const compact = m[3]!;
    if (fileTld !== tld) continue;
    const period = compactToPeriod(compact);
    activityByPeriod[period] = absoluteIcannUrl(href);
  }

  const transactionsPeriods = Object.keys(transactionsByPeriod).sort().reverse() as ReportingPeriod[];
  const activityPeriods = Object.keys(activityByPeriod).sort().reverse() as ReportingPeriod[];

  return {
    tldAsciiLabel: tld,
    resourcePageUrl,
    transactionsPeriods,
    activityPeriods,
    transactionsByPeriod,
    activityByPeriod,
  };
}

export async function discoverAllTldPages(options?: {
  indexUrl?: string;
  signal?: AbortSignal;
  fetchPage?: (url: string) => Promise<{ ok: true; text: string } | { ok: false; error: string }>;
  concurrency?: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<{
  indexUrl: string;
  pages: DiscoveredTldPage[];
  indexFetchError?: string;
}> {
  const indexUrl = options?.indexUrl ?? MRR_INDEX_URL;
  const fetchPage =
    options?.fetchPage ??
    (async (url: string) => {
      const r = await fetchBounded(url, { signal: options?.signal });
      if (!r.ok) return { ok: false as const, error: r.error };
      if (r.status === 304 || !("text" in r)) {
        return { ok: false as const, error: "Unexpected HTTP 304 for discovery HTML" };
      }
      return { ok: true as const, text: r.text };
    });

  const index = await fetchPage(indexUrl);
  if (!index.ok) {
    return { indexUrl, pages: [], indexFetchError: index.error };
  }
  const entries = parseRegistryReportsIndex(index.text);
  const pages: DiscoveredTldPage[] = [];
  const concurrency = options?.concurrency ?? 4;
  let done = 0;
  let next = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const i = next++;
      if (i >= entries.length) return;
      const entry = entries[i]!;
      const page = await fetchPage(entry.resourcePageUrl);
      if (page.ok) {
        pages.push(parseTldReportPage(page.text, entry.tldAsciiLabel, entry.resourcePageUrl));
      } else {
        pages.push({
          tldAsciiLabel: entry.tldAsciiLabel,
          resourcePageUrl: entry.resourcePageUrl,
          transactionsPeriods: [],
          activityPeriods: [],
          transactionsByPeriod: {},
          activityByPeriod: {},
        });
      }
      done += 1;
      options?.onProgress?.(done, entries.length);
    }
  });
  await Promise.all(workers);
  pages.sort((a, b) => a.tldAsciiLabel.localeCompare(b.tldAsciiLabel));
  return { indexUrl, pages };
}
