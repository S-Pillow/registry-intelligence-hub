import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = process.env.SMOKE_PORT ?? "43123";
const base = `http://127.0.0.1:${port}`;
const paths = [
  "/tools/registry-intelligence-hub",
  "/tools/registry-intelligence-hub/explore",
  "/tools/registry-intelligence-hub/explore?entity=organizations&idn=idn",
  "/tools/registry-intelligence-hub/compare?type=organizations&ids=Atlas+Digital,Northstar+Group",
];

const server = spawn("npx", ["next", "start", "-p", port], {
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
  }

  console.log(`production smoke OK (${paths.length} routes on ${base})`);
} finally {
  server.kill("SIGTERM");
  await delay(300);
}
