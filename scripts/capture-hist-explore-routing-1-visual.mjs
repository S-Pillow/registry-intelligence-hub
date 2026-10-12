/**
 * HIST-EXPLORE-ROUTING-1 visual acceptance — historical vs current Explore.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43143/tools/registry-intelligence-hub";
const outDir =
  process.env.HIST_EXPLORE_ROUTING_SCREENSHOT_DIR ??
  path.join(process.cwd(), ".data/visual-acceptance/hist-explore-routing-1");

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

function must(tag, name, ok, detail = "") {
  if (!ok) throw new Error(`${tag} fail ${name}${detail ? `: ${detail}` : ""}`);
  return ok;
}

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport });
  const checks = {};

  // A–D: historical NA region
  await page.goto(
    `${baseUrl}/explore?dataset=2012-historical&entity=applications&region=NA`,
    { waitUntil: "networkidle", timeout: 120_000 },
  );
  await page.getByTestId("explore-content-historical").waitFor({ timeout: 60_000 });
  const histText = await page.locator("body").innerText();
  checks.A_openHistoricalNA = page.url().includes("dataset=2012-historical") && page.url().includes("region=NA");
  checks.B_historicalIdentifiable =
    /2012 Reveal Day historical|2012 historical corpus|full 2012 Reveal Day/i.test(histText);
  checks.C_notPromoted2026 =
    !/1,614 application records currently represented/i.test(histText) &&
    (await page.getByTestId("explore-content-v2").count()) === 0;
  checks.D_naHistoricalCount =
    /911|1,?930/.test(histText) &&
    (await page.getByTestId("explore-dataset-badge").innerText()).includes("1930");

  await page.screenshot({
    path: path.join(outDir, `explore-historical-na-${tag}.png`),
    fullPage: true,
  });

  // E: from cohort page NA drilldown
  await page.goto(`${baseUrl}/historical-cohorts`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.getByTestId("cohort-regional-explore-NA").click();
  await page.waitForURL(/dataset=2012-historical.*region=NA|region=NA.*dataset=2012-historical/, {
    timeout: 60_000,
  });
  await page.getByTestId("explore-content-historical").waitFor({ timeout: 60_000 });
  checks.E_cohortDrilldownHistorical =
    (await page.getByTestId("explore-content-v2").count()) === 0 &&
    page.url().includes("dataset=2012-historical");

  // F: Applicant q
  await page.goto(
    `${baseUrl}/explore?dataset=2012-historical&entity=applications&q=${encodeURIComponent("Charleston Road Registry Inc.")}`,
    { waitUntil: "networkidle", timeout: 120_000 },
  );
  await page.getByTestId("explore-content-historical").waitFor({ timeout: 60_000 });
  checks.F_applicantHistorical =
    (await page.getByLabel("Search all registry records").inputValue()) ===
      "Charleston Road Registry Inc." &&
    (await page.getByTestId("explore-content-v2").count()) === 0;

  // G: strings
  await page.goto(`${baseUrl}/explore?dataset=2012-historical&entity=strings`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.getByTestId("explore-content-historical").waitFor({ timeout: 60_000 });
  const stringsText = await page.locator("body").innerText();
  checks.G_stringsHistorical =
    /unique applied strings|2012/i.test(stringsText) &&
    (await page.getByTestId("explore-content-v2").count()) === 0;
  await page.screenshot({
    path: path.join(outDir, `explore-historical-strings-${tag}.png`),
    fullPage: true,
  });

  // H: plain explore remains current
  await page.goto(`${baseUrl}/explore`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.getByTestId("explore-content-v2").waitFor({ timeout: 60_000 });
  const currentText = await page.locator("body").innerText();
  checks.H_currentExploreIntact =
    (await page.getByTestId("explore-content-historical").count()) === 0 &&
    /1,614|1614/.test(currentText);
  await page.screenshot({
    path: path.join(outDir, `explore-current-${tag}.png`),
    fullPage: true,
  });

  for (const [k, v] of Object.entries(checks)) must(tag, k, v);
  results.push({ tag, ...checks });
  await page.close();
}

await run({ width: 1440, height: 900 }, "desktop-1440");
await run({ width: 390, height: 844 }, "mobile-390");

await writeFile(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
await browser.close();
console.log(`HIST-EXPLORE-ROUTING-1 visual acceptance written to ${outDir}`);
console.log(JSON.stringify(results, null, 2));
