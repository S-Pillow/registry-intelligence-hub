/**
 * ORG-INTEL-1 rendered acceptance — desktop + mobile.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43136/tools/registry-intelligence-hub";
const outDir =
  process.env.ORG_INTEL_SCREENSHOT_DIR ??
  path.join(process.cwd(), ".data/visual-acceptance/org-intel-1");

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

async function openOrg(page, key) {
  await page.goto(`${baseUrl}/organization?key=${encodeURIComponent(key)}`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.getByTestId("organization-profile").waitFor({ timeout: 60_000 });
  return page.locator("body").innerText();
}

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport });

  let t = await openOrg(page, "identity-digital");
  const id = {
    tag,
    org: "Identity Digital",
    isOrgNotApplicant: /Organization profile/i.test(t) && /Confirmed Organization/i.test(t),
    applicants28: /28/.test(t) && /Applicant/.test(t),
    apps216: /216/.test(t),
    memberships157: /157/.test(t),
    hair: /Hair Apparent, LLC/.test(t),
    paws: /Paws Button, LLC/.test(t),
    attribution: /legal Applicant attribution|Applicant legal entities/i.test(t),
  };
  for (const [k, v] of Object.entries(id)) if (k !== "tag" && k !== "org" && v === false) throw new Error(`${tag} ID fail ${k}`);
  results.push(id);
  await page.screenshot({ path: path.join(outDir, `identity-digital-${tag}.png`), fullPage: true });

  if (tag === "desktop") {
    t = await openOrg(page, "namecheap");
    results.push({
      tag,
      org: "Namecheap",
      applicants20: /20/.test(t),
      ok: /Namecheap/.test(t) && /Exploration/.test(t),
    });
    if (!results.at(-1).ok) throw new Error("Namecheap fail");
    await page.screenshot({ path: path.join(outDir, `namecheap-${tag}.png`), fullPage: true });
  }

  t = await openOrg(page, "salesforce");
  const sf = {
    tag,
    org: "Salesforce",
    singleApplicant: /Salesforce, Inc\./.test(t),
    apps4: /4 of 4/.test(t) || /\b4\b/.test(t),
    viewApplicant: await page.getByTestId("view-applicant-profile").count().then((n) => n > 0),
    differentiation: /RIH maps 4 represented Applications across 1 Applicant/i.test(t),
  };
  for (const [k, v] of Object.entries(sf)) if (k !== "tag" && k !== "org" && v === false) throw new Error(`${tag} SF fail ${k}`);
  results.push(sf);
  await page.screenshot({ path: path.join(outDir, `salesforce-${tag}.png`), fullPage: true });

  if (tag === "desktop") {
    t = await openOrg(page, "hist-2012-microsoft");
    if (!/11/.test(t) || !/2/.test(t) || !/-9/.test(t)) throw new Error("Microsoft returning fail");
    if (!/Confirmed cross-round Organization relationship/i.test(t)) throw new Error("Microsoft wording");
    results.push({ tag, org: "Microsoft", returning: true });
    await page.screenshot({ path: path.join(outDir, `microsoft-${tag}.png`), fullPage: true });

    t = await openOrg(page, "hist-2012-google-charleston-road");
    if (!/101/.test(t) || !/39/.test(t) || !/-62/.test(t)) throw new Error("Google returning fail");
    results.push({ tag, org: "Google", returning: true });
    await page.screenshot({ path: path.join(outDir, `google-${tag}.png`), fullPage: true });

    // Applicant → Organization
    await page.goto(`${baseUrl}/applicant?name=${encodeURIComponent("Salesforce, Inc.")}`, {
      waitUntil: "networkidle",
    });
    await page.getByTestId("applicant-profile").waitFor();
    await Promise.all([
      page.waitForURL(/\/organization\?key=/, { timeout: 60_000 }),
      page.getByTestId("header-org-profile-link").click(),
    ]);
    await page.getByTestId("organization-profile").waitFor();
    results.push({ tag, nav: "applicant-to-org", ok: true });

    // Organization → Applicant
    await page.goto(`${baseUrl}/organization?key=salesforce`, { waitUntil: "networkidle" });
    await Promise.all([
      page.waitForURL(/\/applicant\?name=/, { timeout: 60_000 }),
      page.getByTestId("org-member-applicant-profile").first().click(),
    ]);
    await page.getByTestId("applicant-profile").waitFor();
    results.push({ tag, nav: "org-to-applicant", ok: true });
  }

  // Contention section / family list already on ID page for mobile
  if (tag === "mobile") {
    await openOrg(page, "identity-digital");
    await page.getByTestId("org-applicant-family").waitFor();
    await page.getByTestId("org-contention-section").waitFor();
    await page.screenshot({ path: path.join(outDir, `identity-family-contention-${tag}.png`), fullPage: true });
  }

  console.log(`OK ${tag}`);
  await page.close();
}

await run({ width: 1440, height: 900 }, "desktop");
await run({ width: 390, height: 844 }, "mobile");
await browser.close();
await writeFile(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
console.log(`ORG-INTEL-1 visual written to ${outDir}`);
