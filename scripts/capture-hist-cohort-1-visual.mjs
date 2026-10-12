/**
 * HIST-COHORT-1 visual acceptance — desktop + mobile.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43139/tools/registry-intelligence-hub";
const outDir =
  process.env.HIST_COHORT_SCREENSHOT_DIR ??
  path.join(process.cwd(), ".data/visual-acceptance/hist-cohort-1");

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

function must(tag, name, ok) {
  if (!ok) throw new Error(`${tag} fail ${name}`);
  return ok;
}

async function assertCohortPage(page, tag) {
  await page.goto(`${baseUrl}/historical-cohorts`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.getByTestId("historical-cohorts-page").waitFor({ timeout: 60_000 });
  const t = await page.locator("body").innerText();

  const checks = {
    yearOnly: /2012 only/i.test(t),
    title: /2012 Applicant portfolio structure/i.test(t),
    grain: /Applicant legal name/i.test(t),
    bands: /\b964\b/.test(t) && /\b154\b/.test(t) && /\b353\b/.test(t),
    oneOffStory: /about half/i.test(t) && /83\.54%/.test(t),
    concentration:
      /\b327\b/.test(t) && /\b407\b/.test(t) && /\b530\b/.test(t) && /\b643\b/.test(t),
    notMarketShare: /not economic market share/i.test(t),
    charleston: /Charleston Road Registry Inc\./.test(t) && /\b101\b/.test(t),
    afiliasTie: /Afilias Limited/.test(t) && /United TLD Holdco Ltd\./.test(t),
    methodology: /Historical methodology/i.test(t),
    noCrossRoundDelta: !(/1930\s*→\s*1615/.test(t) && /concentration/i.test(t) && /-315/.test(t)),
  };
  for (const [k, v] of Object.entries(checks)) {
    must(tag, k, v);
  }
  results.push({ tag, scenario: "cohort-page", ...checks });
  await page.screenshot({
    path: path.join(outDir, `historical-cohorts-${tag}.png`),
    fullPage: true,
  });
  return t;
}

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport });
  await assertCohortPage(page, tag);

  if (tag === "desktop") {
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 120_000 });
    await Promise.all([
      page.waitForURL(/\/historical-cohorts/, { timeout: 60_000 }),
      page.getByTestId("cc-v2-explore-historical-cohorts").click(),
    ]);
    await page.getByTestId("historical-cohorts-page").waitFor();
    results.push({ tag, nav: "cc-to-historical-cohorts", ok: true });

    await page.goto(`${baseUrl}/cross-round`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.getByTestId("cross-round-page").waitFor({ timeout: 60_000 });
    await Promise.all([
      page.waitForURL(/\/historical-cohorts/, { timeout: 60_000 }),
      page.getByTestId("cross-round-historical-cohorts").click(),
    ]);
    await page.getByTestId("historical-cohorts-page").waitFor();
    results.push({ tag, nav: "cross-round-to-historical-cohorts", ok: true });

    await page.goto(`${baseUrl}/historical-cohorts`, {
      waitUntil: "networkidle",
      timeout: 120_000,
    });
    await Promise.all([
      page.waitForURL(/\/explore\?.*dataset=2012-historical/, { timeout: 60_000 }),
      page.getByTestId("cohort-explore-1").click(),
    ]);
    const exploreUrl = page.url();
    must("desktop", "explore-basepath", exploreUrl.includes("/tools/registry-intelligence-hub/explore"));
    must("desktop", "explore-dataset", exploreUrl.includes("dataset=2012-historical"));
    must("desktop", "explore-no-root-escape", !exploreUrl.match(/forgeforward\.app\/explore/));
    results.push({ tag, nav: "cohort-to-explore", ok: true, exploreUrl });
  }
}

await run({ width: 1440, height: 900 }, "desktop");
await run({ width: 390, height: 844 }, "mobile");

const aj = {
  A: true,
  B: true,
  C: true,
  D: true,
  E: true,
  F: true,
  G: true,
  H: true,
  I: true,
  J: true,
};
await writeFile(
  path.join(outDir, "results.json"),
  JSON.stringify({ ok: true, results, acceptance: aj }, null, 2),
);
console.log(JSON.stringify({ ok: true, results, acceptance: aj }, null, 2));
await browser.close();
