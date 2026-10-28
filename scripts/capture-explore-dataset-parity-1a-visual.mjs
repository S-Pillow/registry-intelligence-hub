/**
 * EXPLORE-DATASET-PARITY-1A visual acceptance — desktop + mobile.
 * Requires a local hub with historical 2012 + promoted 2026 payloads.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43199/tools/registry-intelligence-hub";
const outDir =
  process.env.EXPLORE_PARITY_SCREENSHOT_DIR ??
  path.join(process.cwd(), ".data/visual-acceptance/explore-dataset-parity-1a");

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function capture(viewport, tag) {
  const page = await browser.newPage({ viewport });
  const shots = [];

  // 1. Promoted 2026 Explore default
  await page.goto(`${baseUrl}/explore`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("explore-content-v2").waitFor({ timeout: 90_000 });
  await page.getByTestId("explore-dataset-switcher").waitFor();
  assert(await page.getByTestId("explore-dataset-2012").isVisible(), `${tag}: missing 2012 switch`);
  shots.push(["01-2026-default", await page.screenshot({ fullPage: false })]);

  // 2. 2012 Applications default
  await page.goto(`${baseUrl}/explore?dataset=2012-historical&entity=applications`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.getByTestId("explore-content-historical").waitFor({ timeout: 90_000 });
  assert(!(await page.getByLabel("Filter by category").count()), `${tag}: Category still present`);
  assert(!(await page.getByLabel("Filter by participation").count()), `${tag}: Participation still present`);
  assert(!(await page.getByRole("button", { name: "+ Compare" }).count()), `${tag}: Compare present`);
  assert(!(await page.getByRole("button", { name: "Watch" }).count()), `${tag}: Watch present`);
  assert(!(await page.getByRole("button", { name: "Brief this view" }).count()), `${tag}: Brief present`);
  const appStatus = await page.getByTestId("explore-historical-pagination-status").innerText();
  assert(/Showing 1–100 of 1,930/.test(appStatus), `${tag}: bad apps page1 ${appStatus}`);
  shots.push(["02-2012-applications", await page.screenshot({ fullPage: false })]);

  // 3. 2012 Strings default
  await page.goto(`${baseUrl}/explore?dataset=2012-historical&entity=strings`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  const stringStatus = await page.getByTestId("explore-historical-pagination-status").innerText();
  assert(/Showing 1–100 of 1,409/.test(stringStatus), `${tag}: bad strings page1 ${stringStatus}`);
  shots.push(["03-2012-strings", await page.screenshot({ fullPage: false })]);

  // 4. Filtered/search state
  await page.goto(`${baseUrl}/explore?dataset=2012-historical&entity=applications&q=NEUSTAR`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.getByText(/application result/i).first().waitFor();
  shots.push(["04-2012-search", await page.screenshot({ fullPage: false })]);

  // 5. Application drawer — no View full
  await page.goto(`${baseUrl}/explore?dataset=2012-historical&entity=applications&ids=1-1386-27446`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.getByRole("button", { name: /View intelligence for/i }).filter({ hasText: "Investigate" }).first().click();
  await page.getByRole("dialog").waitFor();
  assert(!(await page.getByRole("dialog").getByRole("link", { name: /View full/i }).count()), `${tag}: application View full`);
  assert(!(await page.getByRole("dialog").getByRole("button", { name: "+ Compare" }).count()), `${tag}: drawer Compare`);
  shots.push(["05-2012-app-drawer", await page.screenshot({ fullPage: false })]);
  await page.keyboard.press("Escape");

  // 6. String drawer — View applications
  await page.goto(`${baseUrl}/explore?dataset=2012-historical&entity=strings&q=AAA`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.getByRole("button", { name: /View intelligence for/i }).filter({ hasText: "Investigate" }).first().click();
  await page.getByRole("dialog").waitFor();
  const viewApps = page.getByRole("dialog").getByRole("link", { name: /View applications/i });
  assert(await viewApps.count(), `${tag}: missing View applications on string`);
  const href = await viewApps.first().getAttribute("href");
  assert(href?.includes("entity=applications") && href.includes("ids="), `${tag}: bad string href ${href}`);
  shots.push(["06-2012-string-drawer", await page.screenshot({ fullPage: false })]);
  await page.keyboard.press("Escape");

  // 7. Confirmed portfolio drawer (if sidecar available)
  await page.goto(`${baseUrl}/explore?dataset=2012-historical&entity=confirmed-portfolios&q=afilias`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  const portfolioInvestigate = page.getByRole("button", { name: /View intelligence for/i }).filter({ hasText: "Investigate" });
  if (await portfolioInvestigate.count()) {
    await portfolioInvestigate.first().click();
    await page.getByRole("dialog").waitFor();
    assert(await page.getByRole("dialog").getByRole("link", { name: /View applications/i }).count(), `${tag}: portfolio View applications`);
    shots.push(["07-2012-portfolio-drawer", await page.screenshot({ fullPage: false })]);
    await page.keyboard.press("Escape");
  }

  // 8–9. Middle + final historical pages
  await page.goto(`${baseUrl}/explore?dataset=2012-historical&entity=applications`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.getByTestId("explore-historical-pagination-page-select").selectOption("10");
  await page.waitForTimeout(200);
  const mid = await page.getByTestId("explore-historical-pagination-status").innerText();
  assert(/Showing 901–1,000 of 1,930/.test(mid), `${tag}: bad mid page ${mid}`);
  shots.push(["08-2012-page-middle", await page.screenshot({ fullPage: false })]);

  await page.getByTestId("explore-historical-pagination-page-select").selectOption("20");
  await page.waitForTimeout(200);
  const last = await page.getByTestId("explore-historical-pagination-status").innerText();
  assert(/Showing 1,901–1,930 of 1,930/.test(last), `${tag}: bad final page ${last}`);
  shots.push(["09-2012-page-final", await page.screenshot({ fullPage: false })]);

  // 10. Mobile historical results (viewport already mobile when tag=mobile)
  shots.push(["10-2012-results", await page.screenshot({ fullPage: false })]);

  for (const [name, buffer] of shots) {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path.join(outDir, `${name}-${tag}.png`), buffer);
  }
  await page.close();
  console.log(`${tag}: wrote ${shots.length} screenshots`);
}

await capture({ width: 1280, height: 900 }, "desktop");
await capture({ width: 390, height: 844 }, "mobile");
await browser.close();
console.log(`explore-dataset-parity-1a visual OK → ${outDir}`);
