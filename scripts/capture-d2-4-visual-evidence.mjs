/**
 * D2.4 visual acceptance — production server with 2012 application payload + confirmed portfolio sidecar.
 */
import { chromium, devices } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43125/tools/registry-intelligence-hub";
const outDir =
  process.env.D24_SCREENSHOT_DIR ??
  "/cursor/stores/bc-e04e6cc5-a825-4e04-8ec0-9262ee0fe1cb/media";

const confirmedExplore = `${baseUrl}/explore?dataset=2012-historical&entity=confirmed-portfolios`;
const legalNamesExplore = `${baseUrl}/explore?dataset=2012-historical&entity=applicant-legal-names`;
const dataHealth = `${baseUrl}/data-health`;

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function capture(file, url, viewport, after) {
  const page = await browser.newPage({ viewport });
  await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
  const cssHref = await page.locator('link[rel="stylesheet"]').first().getAttribute("href");
  if (!cssHref) throw new Error(`${file}: missing stylesheet`);
  const cssStatus = await page.request.get(new URL(cssHref, page.url()).href).then((r) => r.status());
  if (cssStatus !== 200) throw new Error(`${file}: css ${cssStatus}`);
  if (after) await after(page);
  const target = path.join(outDir, file);
  await page.screenshot({ path: target, fullPage: false });
  console.log(`wrote ${target}`);
  await page.close();
}

await capture("d2-4-explore-confirmed-portfolios-desktop.png", confirmedExplore, { width: 1440, height: 900 });

await capture(
  "d2-4-explore-confirmed-portfolios-mobile.png",
  confirmedExplore,
  devices["iPhone 13"].viewport,
);

await capture(
  "d2-4-confirmed-portfolio-drawer-afilias-desktop.png",
  `${confirmedExplore}&q=afilias`,
  { width: 1440, height: 900 },
  async (page) => {
    const trigger = page.getByRole("button", { name: /View intelligence for Afilias/i }).first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await page.getByText(/INTELLIGENCE DRAWER · CONFIRMED PORTFOLIO/i).waitFor({ timeout: 15_000 });
  },
);

await capture("d2-4-explore-applicant-legal-names-desktop.png", legalNamesExplore, { width: 1440, height: 900 });

await capture("d2-4-data-health-confirmed-portfolios-desktop.png", dataHealth, { width: 1440, height: 900 });

await browser.close();
