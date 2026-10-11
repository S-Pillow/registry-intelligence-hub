/**
 * PRODUCT-UX-1 rendered acceptance — desktop 1440×900 + mobile 390×844.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43128/tools/registry-intelligence-hub";
const outDir =
  process.env.PRODUCT_UX_SCREENSHOT_DIR ??
  path.join(process.cwd(), ".data/visual-acceptance/product-ux-1");

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

const forbiddenBusinessCopy = [
  /Publication 2\.x/i,
  /Publication 2\.0\.0/i,
  /1\.1-shaped/i,
  /do not fabricate/i,
  /READY_WITH_LIMITATION/,
  /registry-browser-applications/,
  /eligibility-gated/i,
  /Gated facets \(not shown\)/i,
  /Full-coverage view/i,
];

async function assertNoForbidden(page, tag, scopeTestId) {
  const root = scopeTestId ? page.getByTestId(scopeTestId) : page.locator("main");
  const text = await root.innerText();
  for (const re of forbiddenBusinessCopy) {
    if (re.test(text)) {
      throw new Error(`${tag}: forbidden business copy matched ${re}`);
    }
  }
}

async function assertPrimaryNav(page, tag) {
  const nav = page.getByTestId("hub-primary-nav");
  await nav.waitFor({ timeout: 30_000 });
  const labels = await nav.locator("a").allInnerTexts();
  const normalized = labels.map((s) => s.trim());
  for (const required of ["Command Center", "Explore", "Competitive Landscape"]) {
    if (!normalized.includes(required)) {
      throw new Error(`${tag}: missing primary nav item ${required}; got ${normalized.join(" | ")}`);
    }
  }
  for (const banned of ["Compare", "Saved", "Briefings", "Data Health"]) {
    if (normalized.includes(banned)) {
      throw new Error(`${tag}: banned primary nav item still present: ${banned}`);
    }
  }
  const methodology = nav.getByTestId("data-methodology-link");
  if (!(await methodology.count())) {
    throw new Error(`${tag}: Data & methodology link missing`);
  }
}

async function overflowCheck(page, tag) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
  if (overflow.scrollWidth > overflow.clientWidth + 2) {
    throw new Error(
      `${tag}: page-level horizontal overflow ${overflow.scrollWidth - overflow.clientWidth}px`,
    );
  }
}

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport });

  // Command Center
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("command-center-active-v2").waitFor({ timeout: 60_000 });
  await assertPrimaryNav(page, `${tag}/cc`);
  await page.getByRole("heading", { name: "2026 round at a glance" }).waitFor();
  await assertNoForbidden(page, `${tag}/cc`, "command-center-intelligence-v2");
  await page.screenshot({ path: path.join(outDir, `product-ux-1-command-${tag}.png`), fullPage: false });

  // Explore
  await page.goto(`${baseUrl}/explore`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("explore-content-v2").waitFor({ timeout: 60_000 });
  await assertPrimaryNav(page, `${tag}/explore`);
  await page.getByTestId("explore-v2-search").waitFor();
  await page.getByTestId("explore-v2-pagination").waitFor();
  const disclosure = await page.getByTestId("coverage-disclosure-v2").innerText();
  if (!/1,?615/.test(disclosure) || !/1,?614/.test(disclosure)) {
    throw new Error(`${tag}/explore: coverage must distinguish 1615/1614: ${disclosure}`);
  }
  if (!/administrative-check/i.test(disclosure)) {
    throw new Error(`${tag}/explore: administrative-check exclusion missing`);
  }
  await assertNoForbidden(page, `${tag}/explore`, "explore-content-v2");
  const pageStatus = await page.getByTestId("explore-v2-page-status").innerText();
  if (!/Showing 1–100 of 1,614/i.test(pageStatus)) {
    throw new Error(`${tag}/explore: pagination regress: ${pageStatus}`);
  }
  await page.screenshot({ path: path.join(outDir, `product-ux-1-explore-${tag}.png`), fullPage: false });

  // Competitive Landscape
  await page.goto(`${baseUrl}/competitive-landscape`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("competitive-landscape").waitFor({ timeout: 60_000 });
  await assertPrimaryNav(page, `${tag}/cl`);
  const clBody = await page.getByTestId("competitive-landscape").innerText();
  if (/Full-coverage/i.test(clBody)) {
    throw new Error(`${tag}/cl: Full-coverage intro still present`);
  }
  if (!/Data & methodology/i.test(clBody)) {
    throw new Error(`${tag}/cl: Data & methodology link missing from intro`);
  }
  await page.getByTestId("godaddy-as-applicant").waitFor();
  await page.getByTestId("godaddy-as-rsp").waitFor();
  await assertNoForbidden(page, `${tag}/cl`, "competitive-landscape");
  await page.screenshot({ path: path.join(outDir, `product-ux-1-landscape-${tag}.png`), fullPage: false });

  // Gated direct routes
  for (const route of [
    ["compare", "compare-gated-v2"],
    ["saved", "saved-gated-v2"],
    ["briefings", "briefings-gated-v2"],
  ]) {
    const [slug, testId] = route;
    await page.goto(`${baseUrl}/${slug}`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.getByTestId(testId).waitFor({ timeout: 30_000 });
    await assertPrimaryNav(page, `${tag}/${slug}`);
    const gated = await page.getByTestId(testId).innerText();
    if (/1\.1-shaped|do not fabricate|eligibility-gated|Publication 2/i.test(gated)) {
      throw new Error(`${tag}/${slug}: implementation jargon still visible`);
    }
    if (!/not available for the current 2026 data view yet/i.test(gated)) {
      throw new Error(`${tag}/${slug}: expected business gated copy`);
    }
    await page.screenshot({
      path: path.join(outDir, `product-ux-1-${slug}-${tag}.png`),
      fullPage: false,
    });
  }

  await overflowCheck(page, tag);
  console.log(JSON.stringify({ tag, viewport, ok: true }));
  await page.close();
}

await run({ width: 1440, height: 900 }, "desktop");
await run({ width: 390, height: 844 }, "mobile");
await browser.close();
console.log(`screenshots → ${outDir}`);
