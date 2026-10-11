/**
 * EXPLORE-PAGING-1 rendered acceptance — desktop + mobile pagination.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43127/tools/registry-intelligence-hub";
const outDir =
  process.env.EXPLORE_PAGING_SCREENSHOT_DIR ??
  path.join(process.cwd(), ".data/visual-acceptance/explore-paging-1");

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const url = `${baseUrl}/explore`;

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport });
  await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("explore-content-v2").waitFor({ timeout: 60_000 });
  await page.getByTestId("explore-v2-pagination").waitFor();

  const first = await page.getByTestId("explore-v2-page-status").innerText();
  if (!/Showing 1–100 of 1,614/i.test(first)) {
    throw new Error(`${tag}: unexpected first page status: ${first}`);
  }
  await page.screenshot({ path: path.join(outDir, `explore-paging-1-page1-${tag}.png`), fullPage: false });

  await page.getByTestId("explore-v2-next").click();
  await page.waitForTimeout(150);
  const second = await page.getByTestId("explore-v2-page-status").innerText();
  if (!/Showing 101–200 of 1,614/i.test(second)) {
    throw new Error(`${tag}: unexpected second page status: ${second}`);
  }
  await page.screenshot({ path: path.join(outDir, `explore-paging-1-page2-${tag}.png`), fullPage: false });

  await page.getByTestId("explore-v2-page-select").selectOption("17");
  await page.waitForTimeout(150);
  const last = await page.getByTestId("explore-v2-page-status").innerText();
  if (!/Showing 1,601–1,614 of 1,614/i.test(last)) {
    throw new Error(`${tag}: unexpected last page status: ${last}`);
  }
  if (!(await page.getByTestId("explore-v2-next").isDisabled())) {
    throw new Error(`${tag}: Next should be disabled on last page`);
  }
  await page.screenshot({ path: path.join(outDir, `explore-paging-1-last-${tag}.png`), fullPage: false });

  // Filtered set
  await page.getByTestId("explore-v2-search").fill("Registry Services");
  await page.waitForTimeout(200);
  const filtered = await page.getByTestId("explore-v2-page-status").innerText();
  if (!/Showing 1–/i.test(filtered) || /of 1,614/.test(filtered)) {
    // May still be 1,614 if search matches many — accept any filtered-driven range that starts at 1
    if (!/Page 1 of /i.test(filtered)) {
      throw new Error(`${tag}: filter did not reset to page 1: ${filtered}`);
    }
  }
  await page.screenshot({ path: path.join(outDir, `explore-paging-1-filtered-${tag}.png`), fullPage: false });

  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  if (overflow.scrollWidth > overflow.clientWidth + 2) {
    throw new Error(
      `${tag}: page-level horizontal overflow ${overflow.scrollWidth - overflow.clientWidth}px`,
    );
  }

  console.log(JSON.stringify({ tag, viewport, first: first.trim(), second: second.trim(), last: last.trim(), ok: true }));
  await page.close();
}

await run({ width: 1440, height: 900 }, "desktop");
await run({ width: 390, height: 844 }, "mobile");
await browser.close();
console.log(`screenshots → ${outDir}`);
