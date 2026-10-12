/**
 * APPLICANT-INTEL-1 rendered acceptance — desktop 1440×900 + mobile 390×844.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43135/tools/registry-intelligence-hub";
const outDir =
  process.env.APPLICANT_INTEL_SCREENSHOT_DIR ??
  path.join(process.cwd(), ".data/visual-acceptance/applicant-intel-1");

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

function enc(name) {
  return encodeURIComponent(name);
}

async function assertProfile(page, tag, name, checks) {
  await page.goto(`${baseUrl}/applicant?name=${enc(name)}`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.getByTestId("applicant-profile").waitFor({ timeout: 60_000 });
  const text = await page.locator("body").innerText();
  const row = { tag, applicant: name, ...checks(text) };
  results.push(row);
  for (const [k, v] of Object.entries(row)) {
    if (k === "tag" || k === "applicant") continue;
    if (v === false) throw new Error(`${tag} ${name}: check failed: ${k}`);
  }
  return text;
}

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport });

  await assertProfile(page, tag, "Salesforce, Inc.", (t) => ({
    whoIsApplicant: /Salesforce, Inc\./i.test(t),
    orgDistinct: /Confirmed\s*·\s*Salesforce/i.test(t) && /Legal Applicant remains/i.test(t),
    website: /salesforce\.com/i.test(t),
    apps4: /Applications[\s\S]*?\b4\b/i.test(t) || /4 of 4/i.test(t),
    brand4: /4 of 4/i.test(t),
    strings: /\.force/i.test(t) && /\.salesforce/i.test(t) && /\.slack/i.test(t) && /\.tableau/i.test(t),
    notFakeSlackOrg: !/Confirmed\s*·\s*Slack/i.test(t),
    rspLimitation: /Selected RSP is not established/i.test(t),
    sources: /Sources|Data & methodology/i.test(t),
  }));
  await page.screenshot({
    path: path.join(outDir, `applicant-salesforce-${tag}.png`),
    fullPage: true,
  });

  await assertProfile(page, tag, "Hair Apparent, LLC", (t) => ({
    whoIsApplicant: /Hair Apparent, LLC/i.test(t),
    org: /Identity Digital/i.test(t),
    website: /identity\.digital/i.test(t),
    parent: /Slow Rider, LLC/i.test(t),
    ultimate: /Ethos Capital/i.test(t),
    siblings: /Other represented Applicants mapped to Identity Digital/i.test(t),
  }));
  await page.screenshot({
    path: path.join(outDir, `applicant-hair-apparent-${tag}.png`),
    fullPage: true,
  });

  await assertProfile(page, tag, "Anthropic, PBC", (t) => ({
    whoIsApplicant: /Anthropic, PBC/i.test(t),
    org: /Confirmed\s*·\s*Anthropic/i.test(t),
    website: /anthropic\.com/i.test(t),
    apps2: /2 of 2/i.test(t) || /Applications[\s\S]*?\b2\b/i.test(t),
  }));
  await page.screenshot({
    path: path.join(outDir, `applicant-anthropic-${tag}.png`),
    fullPage: true,
  });

  await assertProfile(page, tag, "Amazon Registry Services, Inc.", (t) => ({
    whoIsApplicant: /Amazon Registry Services, Inc\./i.test(t),
    unresolved: /Not yet resolved|No broader Organization mapping/i.test(t),
    portfolio: /Application portfolio/i.test(t),
    noOrgGate: /Applicant intelligence below still applies|Public RSP posture/i.test(t),
  }));
  await page.screenshot({
    path: path.join(outDir, `applicant-amazon-unresolved-${tag}.png`),
    fullPage: true,
  });

  // Contention page distribution UX
  await page.goto(`${baseUrl}/contention`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("contention-distribution-panel").waitFor({ timeout: 60_000 });
  const distText = await page.getByTestId("contention-distribution-panel").innerText();
  if (!/How crowded are the contention sets/i.test(distText)) {
    throw new Error(`${tag}: crowding heading missing`);
  }
  if (!/competing Applications/i.test(distText)) {
    throw new Error(`${tag}: largest-set Applications wording missing`);
  }
  if (/\bSize \d+:/i.test(distText)) {
    throw new Error(`${tag}: old Size N chips still present`);
  }
  await page.screenshot({
    path: path.join(outDir, `contention-distribution-${tag}.png`),
    fullPage: false,
  });

  const size13 = page.getByTestId("contention-dist-size-13");
  if (await size13.count()) {
    await size13.click();
    await page.getByTestId("contention-dist-reveal").waitFor();
    const reveal = await page.getByTestId("contention-dist-reveal").innerText();
    if (!/13 Applications/i.test(reveal) || !/distinct Applicants/i.test(reveal)) {
      throw new Error(`${tag}: distribution reveal incomplete`);
    }
    await page.screenshot({
      path: path.join(outDir, `contention-distribution-reveal-13-${tag}.png`),
      fullPage: false,
    });
  }

  // Applicant with contention — open a GoDaddy set member profile if available
  await page.goto(`${baseUrl}/contention?view=godaddy`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.locator('[data-testid="contention-sets-table"] tbody tr').first().click();
  await page.getByTestId("contention-set-detail").waitFor();
  const profileLink = page.getByTestId("contention-member-applicant-profile").first();
  if (await profileLink.count()) {
    await Promise.all([
      page.waitForURL(/\/applicant\?name=/, { timeout: 60_000 }),
      profileLink.click(),
    ]);
    await page.getByTestId("applicant-profile").waitFor({ timeout: 60_000 });
    const contestedText = await page.locator("body").innerText();
    if (!/Contention|contention set/i.test(contestedText)) {
      throw new Error(`${tag}: contended applicant profile missing contention section`);
    }
    await page.screenshot({
      path: path.join(outDir, `applicant-with-contention-${tag}.png`),
      fullPage: true,
    });
  }

  console.log(`OK ${tag}`);
  await page.close();
}

await run({ width: 1440, height: 900 }, "desktop");
await run({ width: 390, height: 844 }, "mobile");
await browser.close();
await writeFile(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
console.log(`APPLICANT-INTEL-1 visual acceptance written to ${outDir}`);
