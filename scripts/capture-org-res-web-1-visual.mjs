#!/usr/bin/env node
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { join } from "node:path";

const BASE =
  process.env.HUB_BASE_URL ?? "http://127.0.0.1:43133/tools/registry-intelligence-hub";
const OUT = join(process.cwd(), ".data/applicant-identity-2026/visual");

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
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
    // Competitive Landscape — Identity Digital family
    await page.goto(`${BASE}/competitive-landscape?q=${encodeURIComponent("Hair Apparent")}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(500);
    const hairRow = page.getByText("Hair Apparent, LLC").first();
    await hairRow.waitFor({ timeout: 15000 });
    // switch to rsp prospects and open Hair if present, else stay on participants
    const bodyText = await page.locator("body").innerText();
    const hasConfirmed = /Confirmed\s*·\s*Identity Digital/i.test(bodyText) || /Identity Digital/i.test(bodyText);
    await shot(page, `${viewport.name}-landscape-hair`);
    results.push({ viewport: viewport.name, surface: "competitive-landscape", hairVisible: true, hasConfirmed });

    // Contention — find a set with Hair Apparent
    await page.goto(`${BASE}/contention?q=${encodeURIComponent("Hair Apparent")}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(500);
    const contText = await page.locator("body").innerText();
    const hasWebsite = /identity\.digital/i.test(contText);
    const hasApplicant = /Hair Apparent, LLC/i.test(contText);
    // open first set if buttons exist
    const setLink = page.locator("[data-testid^=set-row-], a, button").filter({ hasText: /set|contention|\./i }).first();
    try {
      await page.getByText("Hair Apparent, LLC").first().click({ timeout: 3000 });
    } catch {
      /* list may already show detail */
    }
    await page.waitForTimeout(400);
    await shot(page, `${viewport.name}-contention-hair`);
    results.push({
      viewport: viewport.name,
      surface: "contention",
      hasApplicant,
      hasWebsite,
    });

    // Second cluster — Namecheap exploration entity
    await page.goto(
      `${BASE}/competitive-landscape?q=${encodeURIComponent("Adhara Exploration")}`,
      { waitUntil: "networkidle" },
    );
    await page.waitForTimeout(400);
    const ncText = await page.locator("body").innerText();
    await shot(page, `${viewport.name}-landscape-namecheap`);
    results.push({
      viewport: viewport.name,
      surface: "namecheap",
      hasNamecheap: /Namecheap/i.test(ncText),
      hasAdhara: /Adhara Exploration/i.test(ncText),
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
