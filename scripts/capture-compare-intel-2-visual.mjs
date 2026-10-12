/**
 * COMPARE-INTEL-2 visual acceptance — desktop + mobile.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43138/tools/registry-intelligence-hub";
const outDir =
  process.env.COMPARE_INTEL_SCREENSHOT_DIR ??
  path.join(process.cwd(), ".data/visual-acceptance/compare-intel-2");

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

function ids(...keys) {
  return keys.map((k) => encodeURIComponent(k)).join("%7C");
}

async function openCompare(page, type, keys) {
  const url = `${baseUrl}/compare?type=${type}&ids=${ids(...keys)}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("compare-intelligence-page").waitFor({ timeout: 60_000 });
  return page.locator("body").innerText();
}

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport });
  const t1 = await openCompare(page, "organization", ["identity-digital", "namecheap"]);
  const orgPair = {
    tag,
    scenario: "identity-digital-vs-namecheap",
    grain: /Organization comparison/i.test(t1),
    apps: /216/.test(t1) && /40/.test(t1),
    memberships: /157/.test(t1) && /21/.test(t1),
    entities: /\b28\b/.test(t1) && /\b20\b/.test(t1),
  };
  for (const [k, v] of Object.entries(orgPair)) {
    if (k !== "tag" && k !== "scenario" && v === false) throw new Error(`${tag} fail ${k}`);
  }
  results.push(orgPair);
  await page.screenshot({
    path: path.join(outDir, `compare-org-idn-namecheap-${tag}.png`),
    fullPage: true,
  });

  const t2 = await openCompare(page, "organization", [
    "hist-2012-microsoft",
    "hist-2012-google-charleston-road",
  ]);
  const returning = {
    tag,
    scenario: "microsoft-vs-google",
    ms: /\b11\b/.test(t2) && /\b2\b/.test(t2) && /-9/.test(t2),
    google: /\b101\b/.test(t2) && /\b39\b/.test(t2) && /-62/.test(t2),
  };
  for (const [k, v] of Object.entries(returning)) {
    if (k !== "tag" && k !== "scenario" && v === false) throw new Error(`${tag} fail ${k}`);
  }
  results.push(returning);
  await page.screenshot({
    path: path.join(outDir, `compare-org-ms-google-${tag}.png`),
    fullPage: true,
  });

  const t3 = await openCompare(page, "applicant", ["Salesforce, Inc.", "Hair Apparent, LLC"]);
  const applicants = {
    tag,
    scenario: "salesforce-vs-hair-apparent",
    grain: /Applicant comparison/i.test(t3),
    sfApps: /\b4\b/.test(t3),
    noOrgLeak: !/\b216\b/.test(t3),
  };
  for (const [k, v] of Object.entries(applicants)) {
    if (k !== "tag" && k !== "scenario" && v === false) throw new Error(`${tag} fail ${k}`);
  }
  results.push(applicants);
  await page.screenshot({
    path: path.join(outDir, `compare-applicant-sf-hair-${tag}.png`),
    fullPage: true,
  });

  if (tag === "desktop") {
    await openCompare(page, "organization", ["salesforce", "identity-digital"]);
    await page.screenshot({
      path: path.join(outDir, "compare-org-sf-idn-desktop.png"),
      fullPage: true,
    });

    await openCompare(page, "applicant", ["Amazon Registry Services, Inc.", "Anthropic, PBC"]);
    const amazonText = await page.locator("body").innerText();
    if (!/Not resolved/i.test(amazonText)) throw new Error("amazon unresolved missing");
    results.push({ tag, scenario: "amazon-unresolved", ok: true });

    // Profile drilldowns
    await openCompare(page, "organization", ["identity-digital", "namecheap"]);
    await Promise.all([
      page.waitForURL(/\/organization\?key=/, { timeout: 60_000 }),
      page.getByTestId("compare-profile-link-0").click(),
    ]);
    await page.getByTestId("organization-profile").waitFor({ timeout: 60_000 });
    results.push({ tag, nav: "compare-to-org", ok: true });

    await openCompare(page, "applicant", ["Salesforce, Inc.", "Hair Apparent, LLC"]);
    await Promise.all([
      page.waitForURL(/\/applicant\?name=/, { timeout: 60_000 }),
      page.getByTestId("compare-profile-link-0").click(),
    ]);
    await page.getByTestId("applicant-profile").waitFor({ timeout: 60_000 });
    results.push({ tag, nav: "compare-to-applicant", ok: true });

    await openCompare(page, "organization", ["identity-digital", "namecheap"]);
    await Promise.all([
      page.waitForURL(/\/contention/, { timeout: 60_000 }),
      page.getByTestId("compare-contention-link").click(),
    ]);
    results.push({ tag, nav: "compare-to-contention", ok: page.url().includes("/contention") });

    // Tray workflow from org profile (fresh page — avoids prior navigation residue)
    const trayPage = await browser.newPage({ viewport });
    await trayPage.goto(`${baseUrl}/organization?key=identity-digital`, {
      waitUntil: "networkidle",
      timeout: 120_000,
    });
    await trayPage.getByTestId("organization-profile").waitFor({ timeout: 60_000 });
    await trayPage.getByTestId("organization-add-to-compare").click({ timeout: 60_000 });
    await trayPage.goto(`${baseUrl}/organization?key=namecheap`, {
      waitUntil: "networkidle",
      timeout: 120_000,
    });
    await trayPage.getByTestId("organization-profile").waitFor({ timeout: 60_000 });
    await trayPage.getByTestId("organization-add-to-compare").click({ timeout: 60_000 });
    await trayPage.getByTestId("compare-tray-floating-open").waitFor({ timeout: 60_000 });
    await trayPage.getByTestId("compare-tray-floating-open").click();
    await trayPage.waitForURL(/\/compare\?/, { timeout: 60_000 });
    await trayPage.getByTestId("compare-intelligence-page").waitFor();
    results.push({ tag, nav: "tray-open", ok: true });
    await trayPage.close();
  }
}

await run({ width: 1440, height: 900 }, "desktop");
await run({ width: 390, height: 844 }, "mobile");
await writeFile(path.join(outDir, "results.json"), JSON.stringify({ ok: true, results }, null, 2));
console.log(JSON.stringify({ ok: true, results }, null, 2));
await browser.close();
