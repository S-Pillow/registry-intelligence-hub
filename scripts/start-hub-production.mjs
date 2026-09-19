/**
 * Production preview for the Hub: build, stop any stale next-server on the port
 * (stale processes keep an old client manifest while .next/static is replaced),
 * then start `next start` bound to 127.0.0.1.
 */
import { spawn } from "node:child_process";
import { execSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = process.env.HUB_PORT ?? process.env.SMOKE_PORT ?? "43123";
const host = process.env.HUB_HOST ?? "127.0.0.1";
const skipBuild = process.argv.includes("--no-build");

function killListenersOnPort(targetPort) {
  try {
    execSync(`fuser -k ${targetPort}/tcp`, { stdio: "ignore" });
  } catch {
    // Nothing listening.
  }
  try {
    execSync("pkill -f 'next-server' 2>/dev/null || true", { stdio: "ignore", shell: true });
  } catch {
    // ignore
  }
}

if (!skipBuild) {
  console.log("Building production bundle…");
  execSync("npm run build", { stdio: "inherit", cwd: process.cwd() });
}

console.log(`Stopping any stale next-server on ${host}:${port}…`);
killListenersOnPort(port);
await delay(1500);

console.log(`Starting next start on http://${host}:${port}`);
const child = spawn("npx", ["next", "start", "-H", host, "-p", port], {
  cwd: process.cwd(),
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});

child.on("exit", (code) => process.exit(code ?? 0));
