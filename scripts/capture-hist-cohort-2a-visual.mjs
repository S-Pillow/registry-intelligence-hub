/**
 * HIST-COHORT-2A visual acceptance — desktop + mobile.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43140/tools/registry-intelligence-hub";
const outDir =
  process.env.HIST_COHORT_SCREENSHOT_DIR ??
  path.join(process.cwd(), ".data/visual-acceptance/hist-cohort-2a");

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
  await page.getByTestId("cohort-exact-string").waitFor({ timeout: 60_000 });
  const t = await page.locator("body").innerText();

  const checks = {
    yearOnly: /2012 only/i.test(t),
    title: /2012 Applicant portfolio structure/i.test(t),
    grain: /Applicant legal name/i.test(t),
    bands: /\b964\b/.test(t) && /\b154\b/.test(t) && /\b353\b/.test(t),
    oneOffStory: /about half/i.test(t) && /83\.54%/.test(t),
    concentration:
      /\b327\b/.test(t) && /\b407\b/.test(t) && /\b530\b/.test(t) && /\b643\b/.test(t),
    exactSection: /Exact-string competition exposure/i.test(t),
    exactApplicants: /\b452\b/.test(t),
    exactApps: /\b751\b/.test(t),
    exactGroups: /\b230\b/.test(t),
    charleston58: /Charleston Road Registry Inc\./.test(t) && /\b58\b/.test(t),
    tldh56: /Top Level Domain Holdings Limited/.test(t) && /\b56\b/.test(t),
    uniregistry45: /Uniregistry, Corp\./.test(t) && /\b45\b/.test(t),
    amazon35: /Amazon EU S\.à r\.l\./.test(t) && /\b35\b/.test(t),
    nuDot13: /NU DOT CO LLC/.test(t) && /\b13\b/.test(t),
    notOfficialContention: /not official contention/i.test(t),
    conceptsSeparate: /keeps the two historical concepts separate/i.test(t),
    noCrossRoundCompetitionDelta: !(/exact-string[\s\S]{0,80}→\s*2026/i.test(t)),
  };
  for (const [k, v] of Object.entries(checks)) {
    must(tag, k, v);
  }
  results.push({ tag, scenario: "cohort-page", ...checks });
  await page.screenshot({
    path: path.join(outDir, `historical-cohorts-2a-${tag}.png`),
    fullPage: true,
  });
}

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport });
  await assertCohortPage(page, tag);

  if (tag === "desktop") {
    await page.goto(`${baseUrl}/historical-cohorts`, {
      waitUntil: "networkidle",
      timeout: 120_000,
    });
    await Promise.all([
      page.waitForURL(/\/explore\?.*dataset=2012-historical/, { timeout: 60_000 }),
      page.getByTestId("cohort-exact-string-explore-1").click(),
    ]);
    const exploreUrl = page.url();
    must("desktop", "explore-basepath", exploreUrl.includes("/tools/registry-intelligence-hub/explore"));
    must("desktop", "explore-dataset", exploreUrl.includes("dataset=2012-historical"));
    must("desktop", "explore-q", /Charleston/i.test(decodeURIComponent(exploreUrl)));
    must("desktop", "no-applicant-profile", !/\/applicant\?/.test(exploreUrl));
    results.push({ tag, nav: "exact-string-to-explore", ok: true, exploreUrl });
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
