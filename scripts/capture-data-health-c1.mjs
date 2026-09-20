import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.HUB_URL ?? "http://127.0.0.1:43123/tools/registry-intelligence-hub";
const outDir =
  process.env.DATA_HEALTH_SCREENSHOT_DIR ??
  "/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/media";

const legacyShots = [
  { file: "data-health-c1-desktop-viewport.png", width: 1440, height: 900 },
  { file: "data-health-c1-mobile-viewport.png", width: 390, height: 844 },
];

const acceptanceShots = [
  {
    file: "data-health-c1-accept-desktop-current-state.png",
    width: 1440,
    height: 900,
    focusCurrentState: true,
  },
  {
    file: "data-health-c1-accept-mobile-nav.png",
    width: 390,
    height: 844,
    focusNav: true,
  },
];

const shots = [...legacyShots, ...acceptanceShots];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
for (const { file, width, height, focusCurrentState, focusNav } of shots) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto(`${baseUrl}/data-health`, { waitUntil: "networkidle" });
  await page.waitForSelector("#current-state-heading");

  if (focusCurrentState) {
    const section = page.locator("#current-state-heading").locator("xpath=ancestor::section[1]");
    await section.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -8));
    const box = await section.boundingBox();
    if (box) {
      const target = path.join(outDir, file);
      await page.screenshot({
        path: target,
        clip: {
          x: 0,
          y: Math.max(0, box.y - 16),
          width,
          height: Math.min(height, box.height + 32),
        },
      });
      console.log(`wrote ${target}`);
      await page.close();
      continue;
    }
  }

  if (focusNav) {
    await page.evaluate(() => window.scrollTo(0, 0));
    const nav = page.getByRole("link", { name: "Data Health", exact: true });
    await nav.waitFor({ state: "visible" });
  } else {
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  const target = path.join(outDir, file);
  await page.screenshot({ path: target, fullPage: false });
  console.log(`wrote ${target}`);
  await page.close();
}

await browser.close();
