import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { HUB_BASE_PATH, withBasePath } from "./hub-base-path.mjs";
import {
  killListenersOnPort,
  teardownSpawnedServer,
} from "./smoke-process-utils.mjs";

const port = process.env.SMOKE_PORT ?? "43123";
const base = `http://127.0.0.1:${port}`;

function registryHubEnvUnset() {
  return !process.env.REGISTRY_HUB_CLAIM_ACTUALITY_STATE_JSON?.trim()
    && !process.env.REGISTRY_HUB_APPLICATION_PAYLOAD_JSON?.trim()
    && !process.env.REGISTRY_HUB_CLAIM_ACTUALITY_STATE_PATH?.trim()
    && !process.env.REGISTRY_HUB_APPLICATION_PAYLOAD_PATH?.trim();
}

/** Client bundles 404 when an old next-server survives across `next build` — Hub hits the route error boundary. */
async function fetchOk(url, attempts = 8) {
  for (let i = 0; i < attempts; i += 1) {
    const response = await fetch(url);
    if (response.ok) return response;
    await delay(400);
  }
  const last = await fetch(url);
  return last;
}

/** Default production: no promoted 2026 publication and no demo opt-in. */
function assertPreRevealProductionContract(html) {
  if (!registryHubEnvUnset()) return;

  const required = [
    ["Pre-Reveal — 2026 public application data has not been promoted", "pre-reveal banner"],
    ["2026 Reveal Day data is not promoted yet", "waiting explanation"],
    ["1930", "2012 approved application count"],
    ["1409", "2012 approved unique string count"],
    ["116", "2012 approved IDN application count"],
    ["2026 comparison pending publication", "gated cross-round delta copy"],
    ["Contention-set count is unavailable", "set count stays unavailable"],
  ];
  for (const [needle, label] of required) {
    if (!html.includes(needle)) {
      throw new Error(`Command Center missing ${label} (${needle})`);
    }
  }
  if (html.includes("Rehearsal data only")) {
    throw new Error("Default Command Center must not present the demo rehearsal banner");
  }
  if (html.includes("APP-91000")) {
    throw new Error("Command Center must not show staging promoted id APP-91000");
  }
  if (/12(?:<!-- -->)?\/(?:<!-- -->)?12(?:<!-- -->)? records/.test(html)) {
    throw new Error("Default Command Center must not present 12/12 rehearsal record coverage");
  }
  if (html.includes("STARTING DOT")) {
    throw new Error("Default Command Center must not receive historical application rows");
  }
}

function assertDemoProductionContract(html) {
  const required = [
    ["Demo / Rehearsal — synthetic data, not an ICANN publication", "demo banner"],
    ["Rehearsal data only", "demo disclosure"],
    ["Atlas Digital", "rehearsal organization"],
  ];
  for (const [needle, label] of required) {
    if (!html.includes(needle)) {
      throw new Error(`Demo Command Center missing ${label} (${needle})`);
    }
  }
  if (html.includes("https://newgtldprogram.icann.org/")) {
    throw new Error("Demo Command Center must not cite the ICANN program URL as the rehearsal source");
  }
}

async function assertClientChunksResolvable(html, pagePath) {
  const chunkPattern = new RegExp(`${HUB_BASE_PATH.replace(/\//g, "\\/")}/_next/static/chunks/[a-zA-Z0-9_.-]+\\.js`, "g");
  const scripts = [...new Set([...html.matchAll(chunkPattern)].map((match) => match[0]))];
  if (!scripts.length) {
    throw new Error(`${pagePath} HTML missing ${HUB_BASE_PATH}/_next/static/chunks references (basePath asset prefix)`);
  }
  for (const script of scripts) {
    const response = await fetchOk(`${base}${script}`);
    if (!response.ok) {
      throw new Error(
        `${pagePath} references missing client chunk ${script} (HTTP ${response.status}). ` +
          "Restart production preview after build: npm run hub:production",
      );
    }
    if (!script.startsWith(`${HUB_BASE_PATH}/_next/`)) {
      throw new Error(`Client chunk must live under ${HUB_BASE_PATH}/_next/, got ${script}`);
    }
  }
}

function historicalSmokeEnv() {
  const env = { ...process.env, NODE_ENV: "production" };
  for (const key of [
    "REGISTRY_HUB_2012_APPLICATION_PAYLOAD_JSON",
    "REGISTRY_HUB_2012_APPLICATION_PAYLOAD_PATH",
    "REGISTRY_HUB_2012_CONFIRMED_PORTFOLIOS_JSON",
    "REGISTRY_HUB_2012_CONFIRMED_PORTFOLIOS_PATH",
  ]) {
    delete env[key];
  }
  return env;
}

const paths = [
  withBasePath("/"),
  withBasePath("/explore"),
  withBasePath("/explore?entity=organizations&idn=idn"),
  withBasePath("/compare?type=organizations&ids=Atlas+Digital,Northstar+Group"),
  withBasePath("/saved"),
  withBasePath("/briefings"),
  withBasePath("/data-health"),
];

killListenersOnPort(port);
await delay(1200);

const server = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", port], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
  env: historicalSmokeEnv(),
  detached: true,
});

let ready = false;
server.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  if (text.includes("Ready") || text.includes("started")) ready = true;
});
server.stderr.on("data", (chunk) => {
  if (chunk.toString().includes("Ready")) ready = true;
});

let smokeError = null;

try {
  for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
    await delay(500);
  }
  if (!ready) {
    try {
      const probe = await fetch(`${base}${withBasePath("/explore")}`);
      if (!probe.ok) throw new Error(`HTTP ${probe.status}`);
      ready = true;
    } catch {
      throw new Error("Production server did not become ready in time");
    }
  }

  if (!registryHubEnvUnset()) {
    throw new Error("production-smoke requires all four REGISTRY_HUB_* variables to be unset");
  }

  for (const path of paths) {
    const response = await fetch(`${base}${path}`);
    if (!response.ok) {
      throw new Error(`${path} returned HTTP ${response.status}`);
    }
    const html = await response.text();
    if (!html.includes("Registry Intelligence Hub") && !html.includes("Explore registry intelligence")) {
      throw new Error(`${path} missing expected hub markup`);
    }
    if (path === withBasePath("/")) {
      await assertClientChunksResolvable(html, path);
      assertPreRevealProductionContract(html);
    }
    if (path === withBasePath("/explore") && !html.includes("2026 Explore is waiting for publication")) {
      throw new Error("Default Explore must explain that 2026 rows are waiting for publication");
    }
    if (path.startsWith(withBasePath("/compare")) && !html.includes("2026 comparison is waiting for publication")) {
      throw new Error("Default Compare must not present rehearsal entities");
    }
    if (path === withBasePath("/briefings") && !html.includes("2026 briefings are waiting for publication")) {
      throw new Error("Default Briefings must not generate synthetic 2026 content");
    }
    if (path === withBasePath("/saved") && !html.includes("Saved 2026 entities are waiting for publication")) {
      throw new Error("Default Saved must not offer synthetic 2026 entities");
    }
  }

  const demo = await fetch(`${base}${withBasePath("/")}?presentation=rehearsal`);
  if (!demo.ok) throw new Error(`demo command center returned HTTP ${demo.status}`);
  assertDemoProductionContract(await demo.text());

  const historicalExplore = await fetch(`${base}${withBasePath("/explore?dataset=2012-historical&ids=1-1000-18032")}`);
  if (!historicalExplore.ok) throw new Error(`historical Explore returned HTTP ${historicalExplore.status}`);
  const historicalHtml = await historicalExplore.text();
  for (const [needle, label] of [
    ["Applicant legal name", "applicant field label"],
    ["not resolved organization ownership", "applicant is not an organization"],
    ["1-1000-18032", "committed application id"],
    ["STARTING DOT", "committed applicant legal name"],
    ["1930", "corpus size"],
  ]) {
    if (!historicalHtml.includes(needle)) {
      throw new Error(`Historical Explore missing ${label} (${needle})`);
    }
  }
  if (historicalHtml.includes("Atlas Digital") || historicalHtml.includes("Confidence: 1")) {
    const visible = historicalHtml.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
    if (visible.includes("Atlas Digital") || visible.includes("Confidence: 1")) {
      throw new Error("Historical Explore must not show rehearsal entities or payload confidence as a score");
    }
  }

  const portfolios = await fetch(`${base}${withBasePath("/explore?dataset=2012-historical&entity=confirmed-portfolios")}`);
  if (!portfolios.ok) throw new Error(`confirmed portfolios returned HTTP ${portfolios.status}`);
  const portfolioHtml = await portfolios.text();
  if (!portfolioHtml.includes("1,429") || !portfolioHtml.includes("Afilias")) {
    throw new Error("Confirmed portfolios must disclose 1,429 unresolved applications and a committed portfolio");
  }
  if (portfolioHtml.includes("Atlas Digital")) {
    const visible = portfolioHtml.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
    if (visible.includes("Atlas Digital")) {
      throw new Error("Confirmed portfolios must not include rehearsal organizations");
    }
  }

  console.log(`production smoke OK (${paths.length} routes on ${base}, ${HUB_BASE_PATH}/_next chunks verified)`);
} catch (error) {
  smokeError = error instanceof Error ? error : new Error(String(error));
} finally {
  const teardown = await teardownSpawnedServer(server, port);
  if (!teardown.ok) {
    console.error(`production-smoke teardown failed: ${teardown.message}`);
    process.exit(1);
  }
}

if (smokeError) {
  console.error(smokeError.message);
  process.exit(1);
}
