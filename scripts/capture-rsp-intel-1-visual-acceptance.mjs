/**
 * RSP-INTEL-1 rendered acceptance — desktop 1440×900 + mobile 390×844.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43126/tools/registry-intelligence-hub";
const outDir =
  process.env.RSP_INTEL_SCREENSHOT_DIR ??
  path.join(process.cwd(), ".data/visual-acceptance/rsp-intel-1");

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const url = `${baseUrl}/competitive-landscape`;

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport });
  await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("competitive-landscape").waitFor({ timeout: 30_000 });
  await page.getByTestId("godaddy-as-applicant").waitFor();
  await page.getByTestId("godaddy-as-rsp").waitFor();

  const applicantApps = await page.getByTestId("focal-applications").innerText();
  if (!applicantApps.includes("77")) throw new Error(`${tag}: expected 77 own applications, got ${applicantApps}`);

  const limitation = await page.getByTestId("selected-rsp-limitation").innerText();
  if (!/does not disclose which RSP/i.test(limitation)) {
    throw new Error(`${tag}: selected-RSP limitation missing`);
  }

  await page.screenshot({ path: path.join(outDir, `rsp-intel-1-roles-${tag}.png`), fullPage: false });

  await page.getByTestId("cta-explore-rsp-prospects").click();
  await page.getByTestId("rsp-prospects-surface").waitFor();
  const body = await page.getByTestId("rsp-prospects-surface").innerText();
  if (!/does not mean/i.test(body) || !/no RSP selected/i.test(body)) {
    throw new Error(`${tag}: Main-RSP match ≠ selected RSP limitation missing`);
  }
  if (/available customer|unassigned RSP|needs an RSP/i.test(body)) {
    throw new Error(`${tag}: forbidden commercial claim visible`);
  }

  // Largest potential prospect path: filter to no public Main-RSP match
  await page.getByTestId("filter-main-rsp-signal").selectOption("none");
  await page.waitForTimeout(200);
  const firstRow = page.locator('[data-testid="rsp-prospect-table"] tbody tr').first();
  await firstRow.getByTestId("prospect-row-select").click();
  await page.getByTestId("prospect-evidence-panel").waitFor();
  const evidence = await page.getByTestId("prospect-evidence-panel").innerText();
  if (!/Potential RSP prospect|No public Main-RSP match/i.test(evidence)) {
    throw new Error(`${tag}: prospect evidence unclear`);
  }
  await page.getByTestId("prospect-explore-applications").waitFor();

  // Self-RSP capable: Charleston / evaluated filter
  await page.getByTestId("filter-main-rsp-signal").selectOption("evaluated");
  await page.waitForTimeout(200);
  const selfCapable = page.locator('[data-testid="rsp-prospect-table"] tbody tr').first();
  await selfCapable.getByTestId("prospect-row-select").click();
  await page.getByTestId("matched-rsp-evidence").waitFor({ timeout: 10_000 });

  // Overflow check
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  if (overflow.scrollWidth > overflow.clientWidth + 2) {
    console.warn(`${tag}: page-level horizontal overflow ${overflow.scrollWidth - overflow.clientWidth}px`);
  }

  await page.screenshot({ path: path.join(outDir, `rsp-intel-1-prospects-${tag}.png`), fullPage: false });
  console.log(JSON.stringify({ tag, viewport, applicantApps: applicantApps.trim(), ok: true }));
  await page.close();
}

await run({ width: 1440, height: 900 }, "desktop");
await run({ width: 390, height: 844 }, "mobile");
await browser.close();
console.log(`screenshots → ${outDir}`);
