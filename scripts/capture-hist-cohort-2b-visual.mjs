/**
 * HIST-COHORT-2B visual acceptance — desktop + mobile.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43142/tools/registry-intelligence-hub";
const outDir =
  process.env.HIST_COHORT_SCREENSHOT_DIR ??
  path.join(process.cwd(), ".data/visual-acceptance/hist-cohort-2b");

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
  await page.getByTestId("cohort-regional").waitFor({ timeout: 60_000 });
  const t = await page.locator("body").innerText();
  const html = await page.getByTestId("historical-cohorts-page").innerHTML();

  const checks = {
    A_portfolioPrimary: /2012 Applicant portfolio structure/i.test(t) && /\b964\b/.test(t),
    B_exactIntact: /Exact-string competition exposure/i.test(t) && /\b452\b/.test(t) && /\b230\b/.test(t),
    C_regionalAfterExact:
      html.indexOf('data-testid="cohort-exact-string"') <
      html.indexOf('data-testid="cohort-regional"'),
    D_fiveRows: (await page.getByTestId("cohort-regional-table").locator("tbody tr").count()) === 5,
    E_sharesComparable:
      (await page.getByTestId("cohort-regional-applicant-share-NA").innerText()).includes("52.51%") &&
      (await page.getByTestId("cohort-regional-app-share-EUR").innerText()).includes("34.97%"),
    F_codesNotMarkets:
      /\bNA\b/.test(t) &&
      /\bEUR\b/.test(t) &&
      !/North American market|European market|Asia-Pacific market/i.test(t),
    G_noWinnerChrome: !/performed better|underperformed|dominated economically/i.test(t),
    H_geoDistinction: /not the Geographic Application designation/i.test(t),
    I_exploreLinks: (
      await Promise.all(
        ["NA", "EUR", "AP", "LAC", "AF"].map(async (code) => {
          const href = await page
            .getByTestId(`cohort-regional-explore-${code}`)
            .getAttribute("href");
          return Boolean(href?.includes(`region=${code}`) && href.includes("2012-historical"));
        }),
      )
    ).every(Boolean),
    K_noCrossRoundRegional: !/2012→2026|NA 2012|regional growth|regional decline/i.test(t),
    L_anchor: (await page.getByTestId("cohort-regional").getAttribute("id")) ===
      "regional-applicant-structure",
  };

  const scroll = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  checks.J_noHScroll = scroll.sw <= scroll.cw + 1;

  for (const [k, v] of Object.entries(checks)) {
    must(tag, k, v);
  }
  results.push({ tag, scenario: "cohort-page", ...checks });

  await page.screenshot({
    path: path.join(outDir, `historical-cohorts-2b-${tag}.png`),
    fullPage: true,
  });
  await page.getByTestId("cohort-regional").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(outDir, `historical-cohorts-2b-regional-${tag}.png`),
  });
}

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport });
  await assertCohortPage(page, tag);
  await page.close();
}

await run({ width: 1440, height: 900 }, "desktop-1440");
await run({ width: 1920, height: 1080 }, "desktop-1920");
await run({ width: 390, height: 844 }, "mobile-390");

await writeFile(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
await browser.close();
console.log(`HIST-COHORT-2B visual acceptance written to ${outDir}`);
console.log(JSON.stringify(results, null, 2));
