/**
 * D1 visual acceptance captures — requires a fresh `next start` after `npm run build`
 * (stale next-server serves HTML with missing /_next chunks → unstyled pages).
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43123/tools/registry-intelligence-hub";
const outDir =
  process.env.D1_SCREENSHOT_DIR ??
  "/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/media";

async function assertStylesLoad(page, label) {
  const cssHref = await page.locator('link[rel="stylesheet"]').first().getAttribute("href");
  if (!cssHref) throw new Error(`${label}: no stylesheet link in DOM`);
  const cssUrl = new URL(cssHref, page.url()).href;
  const status = await page.request.get(cssUrl).then((r) => r.status());
  if (status !== 200) {
    throw new Error(
      `${label}: CSS ${cssUrl} returned ${status} — restart next start after npm run build`,
    );
  }
  const sheetCount = await page.evaluate(() => document.styleSheets.length);
  if (sheetCount < 1) throw new Error(`${label}: document.styleSheets empty`);
  const bodyBg = await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor,
  );
  console.log(`${label}: css OK (${cssHref}), styleSheets=${sheetCount}, body bg=${bodyBg}`);
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

await capture(
  "d1-explore-2012-historical-desktop.png",
  `${baseUrl}/explore?dataset=2012-historical`,
  1440,
  900,
);

await capture(
  "d1-explore-2012-mobile.png",
  `${baseUrl}/explore?dataset=2012-historical`,
  390,
  844,
);

await capture(
  "d1-data-health-entity-loaded.png",
  `${baseUrl}/data-health`,
  1440,
  900,
);

const drawerPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await drawerPage.goto(`${baseUrl}/explore?dataset=2012-historical`, {
  waitUntil: "networkidle",
});
await assertStylesLoad(drawerPage, "drawer");
const investigateBtn = drawerPage.getByRole("button", { name: /^Investigate$/i }).first();
if (await investigateBtn.count()) {
  await investigateBtn.click();
  await drawerPage.waitForTimeout(800);
}
await drawerPage.screenshot({
  path: path.join(outDir, "d1-explore-investigate-drawer.png"),
  fullPage: false,
});
console.log(`wrote ${path.join(outDir, "d1-explore-investigate-drawer.png")}`);
await drawerPage.close();

// Regression: 2026 rehearsal Explore styling
await capture(
  "d1-explore-2026-rehearsal-regression-desktop.png",
  `${baseUrl}/explore`,
  1440,
  900,
);

await browser.close();
console.log("D1 visual capture OK");
