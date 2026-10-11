#!/usr/bin/env node
/**
 * ORG-RES-WEB-1 — read-only APS Applicant identity acquisition.
 * Fetches Application summary (organizationWebsite) for one representative
 * Application per represented Applicant legal name. Optional --responses for
 * shared-domain follow-up. Does not mutate Reveal Day publication state.
 *
 * Usage:
 *   node scripts/acquire-applicant-identity-web1.mjs
 *   node scripts/acquire-applicant-identity-web1.mjs --responses
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = process.cwd();
const BASE = "https://newgtldprogram-aps.icann.org/aps";
const UA =
  "RIH-OrgResWeb1/1.0 (+https://forgeforward.app; registry-intelligence-hub; read-only)";
const OUT = join(ROOT, ".data/applicant-identity-2026");
const wantResponses = process.argv.includes("--responses");

async function loadPublication() {
  const path = join(ROOT, ".data/reveal-2026/publications/aps-applications-2.0.0.snapshot.json");
  return JSON.parse(await readFile(path, "utf8"));
}

function representatives(applications) {
  const by = new Map();
  for (const a of applications) {
    const list = by.get(a.applicant) ?? [];
    list.push(a.applicationId);
    by.set(a.applicant, list);
  }
  return [...by.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, ids]) => ({
      applicantLegalName: name,
      representativeApplicationId: [...ids].sort((a, b) => a.localeCompare(b))[0],
    }));
}

async function fetchJson(url, attempt = 0) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if ((res.status === 429 || res.status === 503) && attempt < 8) {
    await new Promise((r) => setTimeout(r, Math.min(60_000, 2 ** attempt * 1000)));
    return fetchJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, status: res.status };
}

async function main() {
  const pub = await loadPublication();
  const reps = representatives(pub.applications);
  await mkdir(join(OUT, "summaries"), { recursive: true });
  if (wantResponses) await mkdir(join(OUT, "responses"), { recursive: true });

  let ok = 0;
  for (const row of reps) {
    const url = `${BASE}/applications/${encodeURIComponent(row.representativeApplicationId)}/summary`;
    const dest = join(OUT, "summaries", `${row.representativeApplicationId}.json`);
    const metaPath = join(OUT, "summaries", `${row.representativeApplicationId}.meta.json`);
    try {
      await readFile(dest);
      await readFile(metaPath);
    } catch {
      const { buf, status } = await fetchJson(url);
      await writeFile(dest, buf);
      await writeFile(
        metaPath,
        `${JSON.stringify(
          {
            applicationId: row.representativeApplicationId,
            applicantLegalName: row.applicantLegalName,
            url,
            retrievedAt: new Date().toISOString(),
            httpStatus: status,
            contentSha256: createHash("sha256").update(buf).digest("hex"),
            byteLength: buf.length,
            extractorVersion: "aps-summary/1.0.0",
          },
          null,
          2,
        )}\n`,
      );
      ok += 1;
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  console.log(JSON.stringify({ representatives: reps.length, newlyFetchedSummaries: ok, out: OUT }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
