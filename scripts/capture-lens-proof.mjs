import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.HUB_URL ?? "http://127.0.0.1:43123/tools/registry-intelligence-hub";
const outDir =
  process.env.LENS_PROOF_DIR ??
  "/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/media";

const views = [
  { lens: "all", file: "lens-proof-all-intelligence.png", button: "All Intelligence" },
  { lens: "commercial", file: "lens-proof-commercial.png", button: "Commercial" },
  { lens: "strategy", file: "lens-proof-product-strategy.png", button: "Product & Strategy" },
  { lens: "marketing", file: "lens-proof-marketing.png", button: "Marketing" },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.waitForSelector('[data-testid="above-fold-lens-surface"]');

for (const { file, button } of views) {
  await page.getByRole("button", { name: button, exact: true }).click();
  await page.waitForSelector('[data-testid="lens-round-pulse-eyebrow"]');
  const target = path.join(outDir, file);
  await page.screenshot({ path: target, fullPage: false });
  console.log(`wrote ${target}`);
}

await browser.close();
