#!/usr/bin/env node
/**
 * Bounded acquisition: fetch ICANN evaluated MAIN/DNS/DNSSEC/PROXY/IDN list
 * and write the tracked normalized artifact used at build time.
 *
 * Usage: node scripts/acquire-icann-evaluated-rsp.mjs
 * Does not run at page-render time.
 */

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL =
  "https://newgtldprogram-2026-documents.icann.org/rsp-documents/rsp-applications.html";
const CLEARED = "Successfully cleared RSP evaluation";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outPath = join(root, "src/data/icann-evaluated-rsp/evaluated-main-rsp-v1.json");

function decode(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}

function extractField(block, label) {
  const re = new RegExp(`${label}:</strong>\\s*<span>([^<]*)</span>`, "i");
  const m = block.match(re);
  return m ? decode(m[1]).trim() : "";
}

function cellText(td) {
  return decode(td.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function normalizeCapability(rawTd) {
  const t = cellText(rawTd);
  if (!t) return { status: "BLANK", rawText: "" };
  if (t.includes(CLEARED)) return { status: "SUCCESSFULLY_CLEARED", rawText: CLEARED };
  return { status: "NOT_CLEARED", rawText: t };
}

function parse(html, meta) {
  const sourceLastUpdatedMatch = html.match(
    /Last updated on:\s*<span>(\d{4}-\d{2}-\d{2})<\/span>/i,
  );
  if (!sourceLastUpdatedMatch) {
    throw new Error("Missing source last-updated date on ICANN page");
  }
  const rowHtmls = [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]).slice(1);
  const records = [];
  for (const row of rowHtmls) {
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (tds.length < 7) continue;
    const [org, updated, main, dnssec, dns, proxy, idn] = tds;
    const idnText = cellText(idn);
    let idnSupportLevel = null;
    if (idnText) {
      const asInt = Number.parseInt(idnText, 10);
      idnSupportLevel = Number.isFinite(asInt) && String(asInt) === idnText ? asInt : idnText;
    }
    const rspLegalName = extractField(org, "Full Legal Name");
    if (!rspLegalName) throw new Error("Row missing Full Legal Name");
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
      url: SOURCE_URL,
      sourceLastUpdated: sourceLastUpdatedMatch[1],
      retrievedAt: meta.retrievedAt,
      contentSha256: meta.contentSha256,
      contentBytes: meta.contentBytes,
    },
    records,
    counts: {
      records: records.length,
      mainSuccessfullyCleared: records.filter((r) => r.main.status === "SUCCESSFULLY_CLEARED").length,
      dnsSuccessfullyCleared: records.filter((r) => r.dns.status === "SUCCESSFULLY_CLEARED").length,
      dnssecSuccessfullyCleared: records.filter((r) => r.dnssec.status === "SUCCESSFULLY_CLEARED")
        .length,
      proxySuccessfullyCleared: records.filter((r) => r.proxy.status === "SUCCESSFULLY_CLEARED")
        .length,
    },
  };
}

const res = await fetch(SOURCE_URL, {
  headers: { "user-agent": "RIH-RSP-INTEL-1/1.0 (bounded acquisition; offline artifact for builds)" },
});
if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
const buf = Buffer.from(await res.arrayBuffer());
const retrievedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const artifact = parse(buf.toString("utf8"), {
  retrievedAt,
  contentSha256: createHash("sha256").update(buf).digest("hex"),
  contentBytes: buf.length,
});

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      wrote: outPath,
      sourceLastUpdated: artifact.source.sourceLastUpdated,
      records: artifact.counts.records,
      mainSuccessfullyCleared: artifact.counts.mainSuccessfullyCleared,
      contentSha256: artifact.source.contentSha256,
    },
    null,
    2,
  ),
);
