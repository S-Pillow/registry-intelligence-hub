/**
 * COMMAND-CENTER-HIERARCHY-1 visual acceptance — desktop + mobile.
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const baseUrl =
  process.env.HUB_URL ?? "http://127.0.0.1:43141/tools/registry-intelligence-hub";
const outDir =
  process.env.CC_HIERARCHY_SCREENSHOT_DIR ??
  path.join(process.cwd(), ".data/visual-acceptance/cc-hierarchy-1");

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

function must(tag, name, ok) {
  if (!ok) throw new Error(`${tag} fail ${name}`);
  return ok;
}

async function assertHierarchy(page, tag) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("command-center-orientation-v2").waitFor({ timeout: 60_000 });
  await page.getByTestId("cc-section-round-posture").waitFor({ timeout: 60_000 });

  const root = page.getByTestId("command-center-intelligence-v2");
  const html = await root.innerHTML();
  const ids = [
    "cc-section-round-posture",
    "cc-section-attention",
    "cc-recent-changes",
    "cc-section-cross-round",
    "cc-section-contention",
    "cc-section-composition",
    "cc-section-coverage",
  ];
  let last = -1;
  for (const id of ids) {
    const pos = html.indexOf(`data-testid="${id}"`);
    must(tag, `order:${id}`, pos > last);
    last = pos;
  }

  const t = await page.locator("body").innerText();
  const checks = {
    A_postureFirst: /2026 round at a glance/i.test(t),
    C_noTopContentionCard: (await page.getByTestId("cc-contention-card").count()) === 0,
    D_attention: /What deserves attention/i.test(t),
    E_godaddy: /\b66\b/.test(await page.getByTestId("cc-attention-godaddy").innerText()),
    F_coverageAttention:
      /\b1614\b/.test(await page.getByTestId("cc-attention-coverage").innerText()) &&
      /\b1615\b/.test(await page.getByTestId("cc-attention-coverage").innerText()),
    G_neutralDeltas:
      (await page.getByTestId("cc-v2-cross-apps-delta").getAttribute("data-delta-style")) ===
        "neutral" &&
      (await page.getByTestId("cc-v2-cross-idn-delta").getAttribute("data-delta-style")) ===
        "neutral",
    H_crossRound: /What changed since 2012/i.test(t),
    I_contentionDepth:
      /\b263\b/.test(t) &&
      /\b891\b/.test(t) &&
      /How crowded are the contention sets/i.test(t),
    J_characteristics:
      /\b21\b/.test(await page.getByTestId("cc-v2-composition-idn").innerText()) &&
      /\b333\b/.test(await page.getByTestId("cc-v2-composition-brand").innerText()) &&
      /\b1169\b/.test(await page.getByTestId("cc-v2-composition-replacements").innerText()),
    K_coverageVisible: (await page.getByTestId("cc-v2-coverage-panel").count()) === 1,
    L_primaryCta:
      (await page
        .getByTestId("cc-v2-competitive-landscape-cta")
        .getAttribute("data-cta-priority")) === "primary",
    N_noSemanticDrift:
      /\b1615\b/.test(await page.getByTestId("cc-v2-official-apps").innerText()) &&
      /\b481\b/.test(await page.getByTestId("cc-v2-official-applicants").innerText()),
  };

  const changeState = await page.getByTestId("cc-recent-changes").getAttribute("data-change-state");
  checks.D_compactOrFullMonitoring =
    changeState === "zero" || changeState === "nonzero" || changeState === "uninitialized";
  if (changeState === "zero") {
    checks.D_quietZero = /No public Application or contention changes/i.test(
      await page.getByTestId("cc-recent-changes").innerText(),
    );
  }

  for (const [k, v] of Object.entries(checks)) {
    must(tag, k, v);
  }
  results.push({ tag, scenario: "command-center", ...checks, changeState });
}

async function capture(page, tag, name, selector) {
  const loc = page.locator(selector).first();
  await loc.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(outDir, `${tag}-${name}.png`),
    fullPage: name === "first-viewport" ? false : false,
  });
  if (name !== "first-viewport") {
    await loc.screenshot({ path: path.join(outDir, `${tag}-${name}-section.png`) });
  }
}

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport });
  await assertHierarchy(page, tag);

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("cc-section-round-posture").waitFor({ timeout: 60_000 });
  await page.screenshot({
    path: path.join(outDir, `${tag}-first-viewport.png`),
  });
  await capture(page, tag, "structural-change", '[data-testid="cc-section-cross-round"]');
  await capture(page, tag, "contention", '[data-testid="cc-section-contention"]');
  await capture(page, tag, "characteristics-coverage", '[data-testid="cc-section-composition"]');
  await page.getByTestId("cc-v2-drilldown").scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, `${tag}-final-cta.png`) });

  results.push({ tag, scenario: "screenshots", ok: true });
}

await run({ width: 1440, height: 900 }, "desktop-1440");
await run({ width: 1920, height: 1080 }, "desktop-1920");
await run({ width: 390, height: 844 }, "mobile-390");

await writeFile(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
await browser.close();
console.log(`CC-HIERARCHY-1 visual acceptance written to ${outDir}`);
console.log(JSON.stringify(results, null, 2));
