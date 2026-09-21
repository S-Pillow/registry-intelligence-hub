/**
 * D2.2 visual acceptance — fresh `next start` after `npm run build` with 2012 payload env.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43124/tools/registry-intelligence-hub";
const outDir =
  process.env.D22_SCREENSHOT_DIR ??
  "/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/media";

async function assertStylesLoad(page, label) {
  const cssHref = await page.locator('link[rel="stylesheet"]').first().getAttribute("href");
  if (!cssHref) throw new Error(`${label}: no stylesheet link in DOM`);
  const cssUrl = new URL(cssHref, page.url()).href;
  const status = await page.request.get(cssUrl).then((r) => r.status());
  if (status !== 200) {
    throw new Error(`${label}: CSS ${cssUrl} returned ${status}`);
  }
}

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function capture(file, url, width, height, after) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
  await assertStylesLoad(page, file);
  if (after) await after(page);
  const target = path.join(outDir, file);
  await page.screenshot({ path: target, fullPage: false });
  console.log(`wrote ${target}`);
  await page.close();
}

const idnExplore = `${baseUrl}/explore?dataset=2012-historical&entity=applications&idn=idn`;
const stringsIdnExplore = `${baseUrl}/explore?dataset=2012-historical&entity=strings&idn=idn`;

await capture("d2-2-command-center-idn-handoff-desktop.png", `${baseUrl}/`, 1440, 900, async (page) => {
  await page.getByRole("link", { name: /Open 2012 IDN applications/i }).scrollIntoViewIfNeeded();
});

await capture("d2-2-explore-idn-applications-desktop.png", idnExplore, 1440, 900);

await capture("d2-2-idn-application-drawer-desktop.png", idnExplore, 1440, 900, async (page) => {
  const investigate = page.getByRole("button", { name: /View intelligence for/ }).filter({ hasText: "Investigate" }).first();
  await investigate.scrollIntoViewIfNeeded();
  await investigate.click();
  await page.waitForTimeout(800);
});

await capture("d2-2-strings-idn-filter-desktop.png", stringsIdnExplore, 1440, 900);

await browser.close();
