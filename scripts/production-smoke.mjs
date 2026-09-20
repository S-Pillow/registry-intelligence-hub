import { spawn, execSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = process.env.SMOKE_PORT ?? "43123";
const base = `http://127.0.0.1:${port}`;

function killListenersOnPort(targetPort) {
  try {
    execSync(`fuser -k ${targetPort}/tcp`, { stdio: "ignore" });
  } catch {
    // Nothing listening.
  }
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
  if (process.env.REGISTRY_HUB_CLAIM_ACTUALITY_STATE_JSON?.trim()) return;
  if (process.env.REGISTRY_HUB_APPLICATION_PAYLOAD_JSON?.trim()) return;
  if (process.env.REGISTRY_HUB_CLAIM_ACTUALITY_STATE_PATH?.trim()) return;
  if (process.env.REGISTRY_HUB_APPLICATION_PAYLOAD_PATH?.trim()) return;

  if (!html.includes("Rehearsal data only")) {
    throw new Error("Command Center missing rehearsal banner (unexpected promoted claim/payload?)");
  }
  if (!html.includes("snap-rehearsal-2026-09-16")) {
    throw new Error("Command Center missing rehearsal snapshot id (12-app fixture)");
  }
  if (!html.includes("1930")) {
    throw new Error("Command Center missing 2012 approved baseline application count (1930)");
  }
  if (!html.includes("2026 comparison pending publication")) {
    throw new Error("Command Center missing gated cross-round delta copy for rehearsal 2026");
  }
}

async function assertClientChunksResolvable(html, pagePath) {
  const scripts = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[a-zA-Z0-9_.-]+\.js/g)].map((match) => match[0]))];
  for (const script of scripts) {
    const response = await fetchOk(`${base}${script}`);
    if (!response.ok) {
      throw new Error(
        `${pagePath} references missing client chunk ${script} (HTTP ${response.status}). ` +
          "Restart production preview after build: npm run hub:production",
      );
    }
  }
}
const paths = [
  "/tools/registry-intelligence-hub",
  "/tools/registry-intelligence-hub/explore",
  "/tools/registry-intelligence-hub/explore?entity=organizations&idn=idn",
  "/tools/registry-intelligence-hub/compare?type=organizations&ids=Atlas+Digital,Northstar+Group",
  "/tools/registry-intelligence-hub/saved",
  "/tools/registry-intelligence-hub/briefings",
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
      const probe = await fetch(`${base}/tools/registry-intelligence-hub/explore`);
      if (!probe.ok) throw new Error(`HTTP ${probe.status}`);
      ready = true;
    } catch {
      throw new Error("Production server did not become ready in time");
    }
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
    if (path === "/tools/registry-intelligence-hub") {
      await assertClientChunksResolvable(html, path);
      assertRehearsalProductionContract(html);
    }
  }

  console.log(`production smoke OK (${paths.length} routes on ${base}, client chunks verified)`);
} finally {
  server.kill("SIGTERM");
  await delay(300);
}
