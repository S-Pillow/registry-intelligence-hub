import { spawn, execSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { HUB_BASE_PATH, withBasePath } from "./hub-base-path.mjs";

const port = process.env.SMOKE_PORT ?? "43123";
const base = `http://127.0.0.1:${port}`;

function killListenersOnPort(targetPort) {
  try {
    execSync(`fuser -k ${targetPort}/tcp`, { stdio: "ignore" });
  } catch {
    // Nothing listening.
  }
}

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

/** Rehearsal deploy default: no REGISTRY_HUB_* pins → 12-app fixture + 2012 approved baseline counts. */
function assertRehearsalProductionContract(html) {
  if (!registryHubEnvUnset()) return;

  const required = [
    ["Rehearsal data only", "rehearsal banner"],
    ["snap-rehearsal-2026-09-16", "rehearsal snapshot id"],
    ["1930", "2012 approved application count"],
    ["1409", "2012 approved unique string count"],
    ["116", "2012 approved IDN application count"],
    ["2026 comparison pending publication", "gated cross-round delta copy"],
  ];
  for (const [needle, label] of required) {
    if (!html.includes(needle)) {
      throw new Error(`Command Center missing ${label} (${needle})`);
    }
  }
  if (html.includes("APP-91000")) {
    throw new Error("Command Center must not show staging promoted id APP-91000 in rehearsal mode");
  }
  if (!/12(?:<!-- -->)?\/(?:<!-- -->)?12(?:<!-- -->)? records/.test(html)) {
    throw new Error("Command Center missing 12/12 rehearsal fixture record coverage");
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

const paths = [
  withBasePath("/"),
  withBasePath("/explore"),
  withBasePath("/explore?entity=organizations&idn=idn"),
  withBasePath("/compare?type=organizations&ids=Atlas+Digital,Northstar+Group"),
  withBasePath("/saved"),
  withBasePath("/briefings"),
];

killListenersOnPort(port);
await delay(1200);

const server = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", port], {
  cwd: process.cwd(),
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, NODE_ENV: "production" },
});

let ready = false;
server.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  if (text.includes("Ready") || text.includes("started")) ready = true;
});
server.stderr.on("data", (chunk) => {
  if (chunk.toString().includes("Ready")) ready = true;
});

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
      assertRehearsalProductionContract(html);
    }
  }

  console.log(`production smoke OK (${paths.length} routes on ${base}, ${HUB_BASE_PATH}/_next chunks verified)`);
} finally {
  server.kill("SIGTERM");
  await delay(300);
}
