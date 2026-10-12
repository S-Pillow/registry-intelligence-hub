/**
 * CROSS-ROUND-STRUCT-1 visual acceptance — desktop + mobile.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43138/tools/registry-intelligence-hub";
const outDir =
  process.env.CROSS_ROUND_SCREENSHOT_DIR ??
  path.join(process.cwd(), ".data/visual-acceptance/cross-round-struct-1");

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseUrl}/cross-round`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("cross-round-page").waitFor({ timeout: 60_000 });
  const t = await page.locator("body").innerText();

  const summary = {
    tag,
    title: /2012 vs 2026/.test(t),
    apps: /1,?930/.test(t) && /1,?615/.test(t) && /-315/.test(t),
    idn: /\b116\b/.test(t) && /\b21\b/.test(t) && /-95/.test(t),
    microsoft: /\b11\b/.test(t) && /\b2\b/.test(t) && /-9/.test(t),
    google: /\b101\b/.test(t) && /\b39\b/.test(t) && /-62/.test(t),
    blocked: /What RIH does not compare yet/i.test(t) && /Contention/i.test(t),
    unmatchedNotNew: /not labeled new/i.test(t),
  };
  for (const [k, v] of Object.entries(summary)) {
    if (k !== "tag" && v === false) throw new Error(`${tag} fail ${k}`);
  }
  results.push(summary);
  await page.screenshot({ path: path.join(outDir, `cross-round-${tag}.png`), fullPage: true });

  if (tag === "desktop") {
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 120_000 });
    await Promise.all([
      page.waitForURL(/\/cross-round/, { timeout: 60_000 }),
      page.getByTestId("cc-v2-explore-cross-round").click(),
    ]);
    await page.getByTestId("cross-round-page").waitFor();
    results.push({ tag, nav: "cc-to-cross-round", ok: true });

    await page.goto(`${baseUrl}/cross-round`, { waitUntil: "networkidle" });
    await Promise.all([
      page.waitForURL(/\/organization\?key=/, { timeout: 60_000 }),
      page.getByTestId("returning-profile-link-hist-2012-microsoft").click(),
    ]);
    await page.getByTestId("organization-profile").waitFor();
    results.push({ tag, nav: "cross-round-to-microsoft", ok: true });

    await page.goto(`${baseUrl}/cross-round`, { waitUntil: "networkidle" });
    await Promise.all([
      page.waitForURL(/\/organization\?key=/, { timeout: 60_000 }),
      page.getByTestId("returning-profile-link-hist-2012-google-charleston-road").click(),
    ]);
    await page.getByTestId("organization-profile").waitFor();
    results.push({ tag, nav: "cross-round-to-google", ok: true });
  }
}

await run({ width: 1440, height: 900 }, "desktop");
await run({ width: 390, height: 844 }, "mobile");
await writeFile(path.join(outDir, "results.json"), JSON.stringify({ ok: true, results }, null, 2));
console.log(JSON.stringify({ ok: true, results }, null, 2));
await browser.close();
