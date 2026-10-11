#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { join } from "node:path";

const BASE =
  process.env.HUB_BASE_URL ?? "http://127.0.0.1:43134/tools/registry-intelligence-hub";
const OUT = join(process.cwd(), ".data-brand1/visual");

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
}

async function openProspect(page, query) {
  await page.goto(`${BASE}/competitive-landscape?q=${encodeURIComponent(query)}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(500);
  const rspTab = page.getByRole("tab", { name: /RSP research/i });
  if (await rspTab.count()) await rspTab.click();
  await page.waitForTimeout(300);
  try {
    await page.getByText(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")).first().click({
      timeout: 4000,
    });
  } catch {
    /* may already be selected */
  }
  await page.waitForTimeout(400);
  const why = page.locator("[data-testid=org-evidence-explanation] summary").first();
  if (await why.count()) await why.click();
  await page.waitForTimeout(200);
  const panel = page.locator("[data-testid=applicant-identity-evidence]");
  const panelText = (await panel.count()) ? await panel.first().innerText() : "";
  const bodyText = await page.locator("body").innerText();
  return { bodyText, panelText };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ]) {
    const page = await browser.newPage({ viewport });

    const sf = await openProspect(page, "Salesforce");
    await shot(page, `${viewport.name}-landscape-salesforce`);
    results.push({
      viewport: viewport.name,
      surface: "competitive-landscape-salesforce",
      sfApplicant: /Salesforce, Inc\./i.test(sf.bodyText),
      sfOrg: /Confirmed\s*·\s*Salesforce/i.test(`${sf.bodyText}\n${sf.panelText}`),
      sfWebsite: /salesforce\.com/i.test(`${sf.bodyText}\n${sf.panelText}`),
      sfBrand: /Brand applications/i.test(`${sf.bodyText}\n${sf.panelText}`),
      whyConfirmed: /Why this Organization is confirmed/i.test(`${sf.bodyText}\n${sf.panelText}`),
      fakeSlackOrg: /Confirmed\s*·\s*Slack/i.test(sf.bodyText),
    });

    await page.goto(`${BASE}/explore?q=${encodeURIComponent("Salesforce")}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(500);
    const exploreText = await page.locator("body").innerText();
    await shot(page, `${viewport.name}-explore-salesforce`);
    results.push({
      viewport: viewport.name,
      surface: "explore-salesforce",
      hasSalesforce: /Salesforce, Inc\./i.test(exploreText),
      hasSlackString: /\bslack\b/i.test(exploreText),
      hasTableauString: /\btableau\b/i.test(exploreText),
    });

    const an = await openProspect(page, "Anthropic");
    await shot(page, `${viewport.name}-landscape-anthropic`);
    results.push({
      viewport: viewport.name,
      surface: "competitive-landscape-anthropic",
      anthropicApplicant: /Anthropic, PBC/i.test(an.bodyText),
      anthropicOrg: /Confirmed\s*·\s*Anthropic/i.test(`${an.bodyText}\n${an.panelText}`),
      fakeClaudeOrg: /Confirmed\s*·\s*Claude/i.test(an.bodyText),
    });

    const am = await openProspect(page, "Amazon Registry");
    await shot(page, `${viewport.name}-landscape-amazon-registry`);
    results.push({
      viewport: viewport.name,
      surface: "competitive-landscape-amazon-registry",
      amazonVisible: /Amazon Registry Services/i.test(am.bodyText),
      remainsUnresolved: !/Confirmed\s*·\s*Amazon(?!\s*Registry)/i.test(
        `${am.bodyText}\n${am.panelText}`,
      ),
      forcedConfirm: /Confirmed\s*·\s*Amazon(?!\s*Registry)/i.test(
        `${am.bodyText}\n${am.panelText}`,
      ),
    });

    await page.close();
  }

  await browser.close();
  console.log(JSON.stringify({ base: BASE, out: OUT, results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
