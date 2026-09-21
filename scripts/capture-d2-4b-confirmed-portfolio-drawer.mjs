/**
 * D2.4B — Afilias confirmed-portfolio drawer provenance screenshot.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43125/tools/registry-intelligence-hub";
const outDir =
  process.env.D24B_SCREENSHOT_DIR ??
  "/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/media";

const confirmedExplore = `${baseUrl}/explore?dataset=2012-historical&entity=confirmed-portfolios&q=afilias`;

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(confirmedExplore, { waitUntil: "networkidle", timeout: 120_000 });
const trigger = page.getByRole("button", { name: /View intelligence for Afilias/i }).first();
await trigger.scrollIntoViewIfNeeded();
await trigger.click();
await page.getByText(/PORTFOLIO PROVENANCE/i).waitFor({ timeout: 15_000 });
await page.getByText(/MEMBER APPLICATION SOURCE & METHOD/i).waitFor({ timeout: 15_000 });
const target = path.join(outDir, "d2-4b-confirmed-portfolio-drawer-afilias-desktop.png");
await page.screenshot({ path: target, fullPage: false });
console.log(`wrote ${target}`);
await browser.close();
