/**
 * ORG-INTEL-1A — production-like basePath navigation verification (Playwright Chromium).
 * Requires a running hub with next.config basePath mounted.
 */
import { chromium } from "playwright";
import { HUB_BASE_PATH } from "./hub-base-path.mjs";

const baseUrl =
  process.env.HUB_URL ?? `http://127.0.0.1:43137${HUB_BASE_PATH}`;
const origin = new URL(baseUrl).origin;

function assertPath(pathname, expectedSuffix, label) {
  const expected = expectedSuffix.startsWith(HUB_BASE_PATH)
    ? expectedSuffix
    : `${HUB_BASE_PATH}${expectedSuffix.startsWith("/") ? expectedSuffix : `/${expectedSuffix}`}`;
  if (pathname !== expected && !pathname.startsWith(`${expected}?`) && pathname.split("?")[0] !== expected.split("?")[0]) {
    // Compare path only when expected has query
    const pathOnly = pathname.split("?")[0];
    const expOnly = expected.split("?")[0];
    if (pathOnly !== expOnly) {
      throw new Error(`${label}: expected path under ${expected}, got ${pathname}`);
    }
  }
  if (!pathname.startsWith(HUB_BASE_PATH)) {
    throw new Error(`${label}: escaped RIH basePath — got ${pathname}`);
  }
  if (pathname === "/contention" || pathname.startsWith("/contention?")) {
    throw new Error(`${label}: landed on ForgeForward-root /contention`);
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const results = [];

try {
  // 1. Command Center → Inspect actual sets on Contention
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 120_000 });
  const cta = page.getByRole("link", { name: "Inspect actual sets on Contention" });
  await cta.waitFor({ timeout: 60_000 });
  const href = await cta.getAttribute("href");
  if (!href || (!href.includes("/contention") && href !== `${HUB_BASE_PATH}/contention`)) {
    throw new Error(`CTA href unexpected: ${href}`);
  }
  // Raw root-relative would be exactly "/contention" in the DOM when basePath is applied
  // incorrectly; Next Link should resolve to basePath-prefixed URL in the browser.
  const resolvedHref = await cta.evaluate((el) => el.href);
  const resolvedPath = new URL(resolvedHref).pathname;
  if (resolvedPath !== `${HUB_BASE_PATH}/contention`) {
    throw new Error(
      `CTA resolved pathname must be ${HUB_BASE_PATH}/contention, got ${resolvedPath} (href attr=${href})`,
    );
  }

  await Promise.all([
    page.waitForURL((url) => url.pathname === `${HUB_BASE_PATH}/contention`, { timeout: 60_000 }),
    cta.click(),
  ]);
  assertPath(new URL(page.url()).pathname, "/contention", "Command Center → Contention");
  await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
  // Contention surface markers (client-rendered); avoid fragile full-body text races.
  const contentionReady = page
    .getByRole("heading", { name: /contention/i })
    .or(page.getByTestId("contention-page"))
    .or(page.locator("[data-testid*='contention']").first())
    .or(page.getByText(/official initial contention/i).first());
  await contentionReady.first().waitFor({ timeout: 60_000 });
  const body = await page.locator("body").innerText();
  if (/Page Not Found/i.test(body) && !/contention/i.test(body)) {
    throw new Error("ForgeForward Page Not Found after Contention navigation");
  }
  results.push({
    step: "cc-to-contention",
    path: new URL(page.url()).pathname,
    ok: true,
  });

  // 2. Applicant → Organization (Salesforce)
  await page.goto(`${baseUrl}/applicant?name=${encodeURIComponent("Salesforce, Inc.")}`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.getByTestId("applicant-profile").waitFor({ timeout: 60_000 });
  await Promise.all([
    page.waitForURL((url) => url.pathname === `${HUB_BASE_PATH}/organization`, { timeout: 60_000 }),
    page.getByTestId("header-org-profile-link").click(),
  ]);
  assertPath(new URL(page.url()).pathname, "/organization", "Applicant → Organization");
  await page.getByTestId("organization-profile").waitFor({ timeout: 60_000 });
  results.push({
    step: "applicant-to-org",
    path: `${new URL(page.url()).pathname}${new URL(page.url()).search}`,
    ok: true,
  });

  // 3. Organization → Applicant
  await page.goto(`${baseUrl}/organization?key=salesforce`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.getByTestId("organization-profile").waitFor({ timeout: 60_000 });
  await Promise.all([
    page.waitForURL((url) => url.pathname === `${HUB_BASE_PATH}/applicant`, { timeout: 60_000 }),
    page.getByTestId("org-member-applicant-profile").first().click(),
  ]);
  assertPath(new URL(page.url()).pathname, "/applicant", "Organization → Applicant");
  await page.getByTestId("applicant-profile").waitFor({ timeout: 60_000 });
  results.push({
    step: "org-to-applicant",
    path: `${new URL(page.url()).pathname}${new URL(page.url()).search}`,
    ok: true,
  });

  // 4. Contention → Organization (Confirmed badge on set detail)
  await page.goto(`${baseUrl}/contention?view=all&set=3`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  await page.getByTestId("set-members-list").waitFor({ timeout: 60_000 });
  const orgBadge = page.getByTestId("org-confirmed-profile-link").first();
  await orgBadge.waitFor({ timeout: 60_000 });
  const badgeHref = await orgBadge.getAttribute("href");
  const badgeResolved = await orgBadge.evaluate((el) => el.href);
  const badgePath = new URL(badgeResolved).pathname;
  if (badgePath !== `${HUB_BASE_PATH}/organization`) {
    throw new Error(`Contention→Org badge resolved path ${badgePath}, href=${badgeHref}`);
  }
  if (!badgeResolved.includes(`${HUB_BASE_PATH}/organization?key=`)) {
    throw new Error(`Contention→Org badge must stay under RIH basePath, got ${badgeResolved}`);
  }
  await Promise.all([
    page.waitForURL((url) => url.pathname === `${HUB_BASE_PATH}/organization`, { timeout: 60_000 }),
    orgBadge.click(),
  ]);
  assertPath(new URL(page.url()).pathname, "/organization", "Contention → Organization");
  await page.getByTestId("organization-profile").waitFor({ timeout: 60_000 });
  results.push({
    step: "contention-to-org",
    path: `${new URL(page.url()).pathname}${new URL(page.url()).search}`,
    ok: true,
  });

  // Guard: never left the hub origin into a root-/contention 404 shell
  for (const r of results) {
    if (!String(r.path).startsWith(HUB_BASE_PATH) && !r.path.includes(HUB_BASE_PATH)) {
      // path field may be pathname only
      if (!r.path.startsWith(HUB_BASE_PATH)) {
        throw new Error(`result escaped basePath: ${JSON.stringify(r)}`);
      }
    }
  }

  console.log(JSON.stringify({ ok: true, origin, baseUrl, HUB_BASE_PATH, results }, null, 2));
} finally {
  await browser.close();
}
