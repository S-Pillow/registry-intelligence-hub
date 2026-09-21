/**
 * D2.1 visual acceptance — fresh `next start` after `npm run build` with 2012 payload env.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43124/tools/registry-intelligence-hub";
const outDir =
  process.env.D21_SCREENSHOT_DIR ??
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

const stringsExplore = `${baseUrl}/explore?dataset=2012-historical&entity=strings`;

await capture("d2-1-explore-strings-historical-desktop.png", stringsExplore, 1440, 900);
await capture("d2-1-explore-strings-historical-mobile.png", stringsExplore, 390, 844);

await capture(
  "d2-1-command-center-strings-handoff-desktop.png",
  `${baseUrl}/`,
  1440,
  900,
  async (page) => {
    await page.getByRole("link", { name: /Open 2012 string corpus/i }).scrollIntoViewIfNeeded();
  },
);

async function openStringDrawer(stringQuery, outfile) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${stringsExplore}&q=${encodeURIComponent(stringQuery)}`, {
    waitUntil: "networkidle",
  });
  await assertStylesLoad(page, outfile);
  const label = stringQuery === "APP" ? ".APP" : `.${stringQuery}`;
  const investigate = page
    .getByRole("button", { name: `View intelligence for ${label}` })
    .filter({ hasText: "Investigate" })
    .first();
  await investigate.scrollIntoViewIfNeeded();
  await investigate.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, outfile), fullPage: false });
  console.log(`wrote ${path.join(outDir, outfile)}`);
  await page.close();
}

await openStringDrawer("APP", "d2-1-drawer-app-multi-desktop.png");
await openStringDrawer("AAA", "d2-1-drawer-aaa-single-desktop.png");

await browser.close();
