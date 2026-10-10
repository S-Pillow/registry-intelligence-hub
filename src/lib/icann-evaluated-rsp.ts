/**
 * Official ICANN evaluated MAIN/DNS/DNSSEC/PROXY/IDN RSP list — tracked normalized source.
 * Runtime rendering must not fetch the live ICANN page.
 */

import artifact from "@/data/icann-evaluated-rsp/evaluated-main-rsp-v1.json";

export const ICANN_EVALUATED_MAIN_RSP_SOURCE_URL =
  "https://newgtldprogram-2026-documents.icann.org/rsp-documents/rsp-applications.html";

export const CLEARED_RSP_EVALUATION_PHRASE = "Successfully cleared RSP evaluation";

export type RspCapabilityStatus = "SUCCESSFULLY_CLEARED" | "BLANK" | "NOT_CLEARED";

export type RspCapability = {
  status: RspCapabilityStatus;
  rawText: string;
};

export type EvaluatedRspRecord = {
  rspLegalName: string;
  doingBusinessAs: string | null;
  countryCode: string | null;
  businessUrl: string | null;
  recordLastUpdated: string | null;
  main: RspCapability;
  dnssec: RspCapability;
  dns: RspCapability;
  proxy: RspCapability;
  idnSupportLevel: number | string | null;
};

export type EvaluatedMainRspArtifact = {
  schemaVersion: string;
  source: {
    publisher: string;
    title: string;
    url: string;
    sourceLastUpdated: string;
    retrievedAt: string;
    contentSha256: string;
    contentBytes: number;
  };
  records: EvaluatedRspRecord[];
  counts: {
    records: number;
    mainSuccessfullyCleared: number;
    dnsSuccessfullyCleared: number;
    dnssecSuccessfullyCleared: number;
    proxySuccessfullyCleared: number;
  };
};

export function isSuccessfullyCleared(capability: RspCapability): boolean {
  return capability.status === "SUCCESSFULLY_CLEARED";
}

/** Normalize legal/DBA names for exact equality only (no fuzzy matching). */
export function normalizeExactIdentityName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function loadEvaluatedMainRspArtifact(): EvaluatedMainRspArtifact {
  return artifact as EvaluatedMainRspArtifact;
}

export function findEvaluatedRspByLegalName(
  records: EvaluatedRspRecord[],
  legalName: string,
): EvaluatedRspRecord | null {
  const key = normalizeExactIdentityName(legalName);
  return records.find((r) => normalizeExactIdentityName(r.rspLegalName) === key) ?? null;
}

/**
 * Deterministic HTML normalizer for the official evaluated MAIN/DNS/DNSSEC/PROXY page.
 * Used by acquisition scripts and source tests — not at page-render time.
 */
export function parseEvaluatedMainRspHtml(
  html: string,
  meta: { retrievedAt: string; contentSha256: string; contentBytes: number; url?: string },
): EvaluatedMainRspArtifact {
  const sourceLastUpdatedMatch = html.match(
    /Last updated on:\s*<span>(\d{4}-\d{2}-\d{2})<\/span>/i,
  );
  if (!sourceLastUpdatedMatch) {
    throw new Error("ICANN evaluated RSP page: missing source last-updated date");
  }

  const decode = (value: string) =>
    value
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&nbsp;/g, " ");

  const extractField = (block: string, label: string): string => {
    const re = new RegExp(`${label}:</strong>\\s*<span>([^<]*)</span>`, "i");
    const m = block.match(re);
    return m ? decode(m[1]).trim() : "";
  };

  const cellText = (td: string): string =>
    decode(td.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

  const normalizeCapability = (rawTd: string): RspCapability => {
    const t = cellText(rawTd);
    if (!t) return { status: "BLANK", rawText: "" };
    if (t.includes(CLEARED_RSP_EVALUATION_PHRASE)) {
      return { status: "SUCCESSFULLY_CLEARED", rawText: CLEARED_RSP_EVALUATION_PHRASE };
    }
    return { status: "NOT_CLEARED", rawText: t };
  };

  const rowHtmls = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]).slice(1);
  const records: EvaluatedRspRecord[] = [];

  for (const row of rowHtmls) {
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (tds.length < 7) continue;
    const [org, updated, main, dnssec, dns, proxy, idn] = tds;
    const idnText = cellText(idn);
    let idnSupportLevel: number | string | null = null;
    if (idnText) {
      const asInt = Number.parseInt(idnText, 10);
      idnSupportLevel = Number.isFinite(asInt) && String(asInt) === idnText ? asInt : idnText;
    }
    const rspLegalName = extractField(org, "Full Legal Name");
    if (!rspLegalName) {
      throw new Error("ICANN evaluated RSP row missing Full Legal Name");
    }
    records.push({
      rspLegalName,
      doingBusinessAs: extractField(org, "Doing Business As") || null,
      countryCode: extractField(org, "Country Code of Location") || null,
      businessUrl: extractField(org, "Business URL") || null,
      recordLastUpdated: cellText(updated) || null,
      main: normalizeCapability(main),
      dnssec: normalizeCapability(dnssec),
      dns: normalizeCapability(dns),
      proxy: normalizeCapability(proxy),
      idnSupportLevel,
    });
  }

  records.sort((a, b) => a.rspLegalName.localeCompare(b.rspLegalName));

  return {
    schemaVersion: "icann-evaluated-main-rsp/1.0.0",
    source: {
      publisher: "ICANN",
      title: "List of Evaluated MAIN, DNS, DNSSEC, PROXY, and IDN Support Level Applications",
      url: meta.url ?? ICANN_EVALUATED_MAIN_RSP_SOURCE_URL,
      sourceLastUpdated: sourceLastUpdatedMatch[1],
      retrievedAt: meta.retrievedAt,
      contentSha256: meta.contentSha256,
      contentBytes: meta.contentBytes,
    },
    records,
    counts: {
      records: records.length,
      mainSuccessfullyCleared: records.filter((r) => isSuccessfullyCleared(r.main)).length,
      dnsSuccessfullyCleared: records.filter((r) => isSuccessfullyCleared(r.dns)).length,
      dnssecSuccessfullyCleared: records.filter((r) => isSuccessfullyCleared(r.dnssec)).length,
      proxySuccessfullyCleared: records.filter((r) => isSuccessfullyCleared(r.proxy)).length,
    },
  };
}
