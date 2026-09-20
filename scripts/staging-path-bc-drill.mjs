/**
 * Staging Reveal Day Path B/C drill — HTTP smoke after operator promotion.
 * Run after: promote-actuality + build-browser-payload (see docs/reveal-day-operations-drill.md).
 *
 * Usage:
 *   REGISTRY_HUB_CLAIM_ACTUALITY_STATE_PATH=.data/reveal-2026/claim-actuality-state.json \
 *   REGISTRY_HUB_APPLICATION_PAYLOAD_PATH=.data/reveal-2026/drill-v2-browser.payload.json \
 *   node scripts/staging-path-bc-drill.mjs
 *
 * Optional: STAGING_DRILL_EXPECT_PROMOTED=1 (default) | STAGING_DRILL_EXPECT_REHEARSAL=1 for teardown check
 */
import { spawn, execSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = process.env.HUB_PORT ?? "43123";
const base = `http://127.0.0.1:${port}`;
const expectPromoted = process.env.STAGING_DRILL_EXPECT_REHEARSAL !== "1";

const routes = [
  "/tools/registry-intelligence-hub",
  "/tools/registry-intelligence-hub/explore",
  "/tools/registry-intelligence-hub/compare?type=applications&ids=APP-91000,APP-91001",
  "/tools/registry-intelligence-hub/saved",
  "/tools/registry-intelligence-hub/briefings",
];

function killListenersOnPort(targetPort) {
  try {
    execSync(`fuser -k ${targetPort}/tcp`, { stdio: "ignore" });
  } catch {
    // ignore
  }
}

killListenersOnPort(port);
await delay(1200);

console.log("Building production bundle…");
execSync("npm run build", { stdio: "inherit" });

const server = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", port], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NODE_ENV: "production" },
});

let ready = false;
server.stdout.on("data", (chunk) => {
  if (chunk.toString().includes("Ready")) ready = true;
});
server.stderr.on("data", (chunk) => {
  if (chunk.toString().includes("Ready")) ready = true;
});

try {
  for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
    await delay(500);
  }
  if (!ready) {
    const probe = await fetch(`${base}/tools/registry-intelligence-hub`);
    if (!probe.ok) throw new Error("Hub did not become ready");
  }

  const promotedMarker = "APP-91000";
  const rehearsalMarker = "APP-26001";
  const promotedLabel = "Promoted 2026 application snapshot";
  const rehearsalLabel = "Rehearsal fixture only";

  for (const path of routes) {
    const response = await fetch(`${base}${path}`);
    if (!response.ok) throw new Error(`${path} HTTP ${response.status}`);
    const html = await response.text();
    if (!html.includes("Registry Intelligence Hub") && !html.includes("Explore registry intelligence")) {
      throw new Error(`${path} missing expected hub markup`);
    }
  }

  const homeHtml = await (await fetch(`${base}/tools/registry-intelligence-hub`)).text();
  const exploreHtml = await (await fetch(`${base}/tools/registry-intelligence-hub/explore`)).text();
  if (expectPromoted) {
    if (!homeHtml.includes(promotedMarker)) {
      throw new Error("Command Center missing promoted application rows in SSR output");
    }
    if (!homeHtml.includes("Promoted 2026 applications.")) {
      throw new Error("Command Center missing promoted disclosure banner");
    }
    if (!exploreHtml.includes(promotedMarker)) {
      throw new Error("Explore missing promoted application id");
    }
    if (!exploreHtml.includes(promotedLabel)) {
      throw new Error("Explore missing promoted payload label");
    }
    if (exploreHtml.includes(rehearsalMarker)) {
      throw new Error("Explore still embeds rehearsal application id");
    }
  } else {
    if (!exploreHtml.includes(rehearsalMarker)) {
      throw new Error("Explore missing rehearsal application id after teardown");
    }
    if (exploreHtml.includes(promotedMarker)) {
      throw new Error("Explore still shows promoted application id after teardown");
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: expectPromoted ? "promoted" : "rehearsal",
        routesChecked: routes.length,
        port,
      },
      null,
      2,
    ),
  );
} finally {
  server.kill("SIGTERM");
  await delay(300);
}
