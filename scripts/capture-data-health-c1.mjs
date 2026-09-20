import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.HUB_URL ?? "http://127.0.0.1:43123/tools/registry-intelligence-hub";
const outDir =
  process.env.DATA_HEALTH_SCREENSHOT_DIR ??
  "/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/media";

const shots = [
  { file: "data-health-c1-desktop-viewport.png", width: 1440, height: 900 },
  { file: "data-health-c1-mobile-viewport.png", width: 390, height: 844 },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
for (const { file, width, height } of shots) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${baseUrl}/data-health`, { waitUntil: "networkidle" });
  await page.waitForSelector("#current-state-heading");
  await page.evaluate(() => window.scrollTo(0, 0));
  const target = path.join(outDir, file);
  await page.screenshot({ path: target, fullPage: false });
  console.log(`wrote ${target}`);
  await page.close();
}

await browser.close();
