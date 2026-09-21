/**
 * D2.1A visual acceptance — q=.APP string aggregate membership under search.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43124/tools/registry-intelligence-hub";
const outDir =
  process.env.D21A_SCREENSHOT_DIR ??
  "/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/media";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const stringsExplore = `${baseUrl}/explore?dataset=2012-historical&entity=strings&q=.APP`;

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(stringsExplore, { waitUntil: "networkidle", timeout: 120_000 });
await page.screenshot({
  path: path.join(outDir, "d2-1a-strings-search-app-desktop.png"),
  fullPage: false,
});
console.log("wrote d2-1a-strings-search-app-desktop.png");

const investigate = page
  .getByRole("button", { name: "View intelligence for .APP" })
  .filter({ hasText: "Investigate" })
  .first();
await investigate.click();
await page.waitForTimeout(800);
await page.screenshot({
  path: path.join(outDir, "d2-1a-drawer-app-search-desktop.png"),
  fullPage: false,
});
console.log("wrote d2-1a-drawer-app-search-desktop.png");

await browser.close();
