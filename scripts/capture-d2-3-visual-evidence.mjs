/**
 * D2.3 visual acceptance — fresh `next start` after `npm run build` with 2012 payload env.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43124/tools/registry-intelligence-hub";
const outDir =
  process.env.D23_SCREENSHOT_DIR ??
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

const contentionExplore = `${baseUrl}/explore?dataset=2012-historical&entity=applications&contention=in`;
const stringsContentionExplore = `${baseUrl}/explore?dataset=2012-historical&entity=strings&contention=in`;

await capture("d2-3-command-center-contention-desktop.png", `${baseUrl}/`, 1440, 900, async (page) => {
  await page.getByRole("link", { name: /Open 2012 contention applications/i }).scrollIntoViewIfNeeded();
});

await capture("d2-3-explore-contention-applications-desktop.png", contentionExplore, 1440, 900);

await capture("d2-3-contention-application-drawer-desktop.png", contentionExplore, 1440, 900, async (page) => {
  const investigate = page
    .getByRole("button", { name: /View intelligence for/ })
    .first();
  await investigate.scrollIntoViewIfNeeded();
  await investigate.click();
  await page.waitForTimeout(800);
});

await capture("d2-3-strings-contention-filter-desktop.png", stringsContentionExplore, 1440, 900);

await browser.close();
