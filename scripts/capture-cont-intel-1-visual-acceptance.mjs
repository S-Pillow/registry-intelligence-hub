/**
 * CONT-INTEL-1 rendered acceptance — desktop 1440×900 + mobile 390×844.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43127/tools/registry-intelligence-hub";
const outDir =
  process.env.CONT_INTEL_SCREENSHOT_DIR ??
  path.join(process.cwd(), ".data/visual-acceptance/cont-intel-1");

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseUrl}/contention`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("contention-page").waitFor({ timeout: 60_000 });

  const nav = page.getByTestId("hub-primary-nav");
  await nav.getByRole("link", { name: "Contention" }).waitFor();

  const uniqueSets = await page.getByTestId("metric-unique-godaddy-sets").innerText();
  if (!/\d+/.test(uniqueSets)) throw new Error(`${tag}: unique GoDaddy sets missing`);
  const gdMemberships = await page.getByTestId("metric-godaddy-memberships").innerText();
  if (!gdMemberships.includes("66")) throw new Error(`${tag}: expected 66 GoDaddy memberships, got ${gdMemberships}`);

  await page.getByTestId("contention-initial-disclosure").waitFor();
  await page.getByTestId("view-godaddy-exposure").waitFor();
  await page.screenshot({ path: path.join(outDir, `cont-intel-1-godaddy-exposure-${tag}.png`), fullPage: false });

  // Crowded sets first row should have largest membership
  const firstApps = await page.locator('[data-testid="contention-sets-table"] tbody tr').first().locator("td").nth(2).innerText();
  if (Number(firstApps) < 2) throw new Error(`${tag}: crowded GoDaddy sets not sorted by size`);

  await page.getByTestId("view-all-sets").click();
  await page.waitForTimeout(200);
  await page.getByTestId("filter-godaddy").waitFor();
  await page.screenshot({ path: path.join(outDir, `cont-intel-1-all-sets-${tag}.png`), fullPage: false });

  await page.getByTestId("view-godaddy-exposure").click();
  await page.waitForTimeout(150);
  await page.locator('[data-testid="contention-sets-table"] tbody tr').first().click();
  const detail = page.getByTestId("contention-set-detail");
  await detail.waitFor();
  await detail.getByTestId("detail-godaddy-present").waitFor();
  await detail.getByTestId("set-counterpart-context").waitFor();
  await detail.getByTestId("org-mapping-explainer").waitFor();
  const detailText = await detail.innerText();
  if (!/Applications/i.test(detailText) || !/Distinct Applicants/i.test(detailText)) {
    throw new Error(`${tag}: Application vs Applicant distinction unclear`);
  }
  if (!/Explore Application|Applicant in Explore/i.test(detailText)) {
    throw new Error(`${tag}: Explore drilldown missing`);
  }
  if (!/No public Main-RSP capability found|Public Main-RSP|Relevant for RSP research|Identity review/i.test(detailText)) {
    throw new Error(`${tag}: RSP posture missing`);
  }
  if (/no rsp selected|available customer|sales lead/i.test(detailText)) {
    throw new Error(`${tag}: forbidden RSP commercial claim`);
  }
  await page.screenshot({ path: path.join(outDir, `cont-intel-1-godaddy-set-detail-${tag}.png`), fullPage: false });
  await detail.getByRole("button", { name: "Close", exact: true }).click();

  // Non-GoDaddy set via all + excludes filter + open first
  await page.getByTestId("view-all-sets").click();
  await page.getByTestId("filter-godaddy").selectOption("excludes-godaddy");
  await page.waitForTimeout(200);
  await page.locator('[data-testid="contention-sets-table"] tbody tr').first().click();
  const nonGd = page.getByTestId("contention-set-detail");
  await nonGd.waitFor();
  await nonGd.getByTestId("detail-godaddy-absent").waitFor();
  await page.screenshot({ path: path.join(outDir, `cont-intel-1-nongodaddy-set-detail-${tag}.png`), fullPage: false });
  await nonGd.getByRole("button", { name: "Close", exact: true }).click();

  // Org explainer labels
  await page.locator('[data-testid="contention-sets-table"] tbody tr').first().click();
  await page.getByTestId("org-mapping-explainer").click();
  const explainer = await page.getByTestId("org-mapping-explainer").innerText();
  if (!/Not yet resolved/i.test(explainer) || !/Candidate match/i.test(explainer)) {
    throw new Error(`${tag}: organization explanation labels incomplete`);
  }
  await page.screenshot({ path: path.join(outDir, `cont-intel-1-org-explainer-${tag}.png`), fullPage: false });

  console.log(`OK ${tag}: uniqueGodaddySets≈${uniqueSets.trim().split("\n").pop()} gdMemberships=${gdMemberships.trim().split("\n").pop()}`);
  await page.close();
}

await run({ width: 1440, height: 900 }, "desktop");
await run({ width: 390, height: 844 }, "mobile");
await browser.close();
console.log(`CONT-INTEL-1 visual acceptance written to ${outDir}`);
