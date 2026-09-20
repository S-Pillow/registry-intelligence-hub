import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { describe, expect, it } from "vitest";
import {
  collectProcessTree,
  isPortInUse,
  killListenersOnPort,
  teardownSpawnedServer,
  waitForPortFree,
} from "../../scripts/smoke-process-utils.mjs";

const repoRoot = join(import.meta.dirname, "../..");

async function reserveEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

describe("smoke process utils", () => {
  it("waitForPortFree resolves immediately when port is unused", async () => {
    const port = 43987;
    expect(isPortInUse(port)).toBe(false);
    const result = await waitForPortFree(port, { timeoutMs: 2_000 });
    expect(result.ok).toBe(true);
  });

  it("teardownSpawnedServer frees a detached listener on the smoke port", async () => {
    const port = await reserveEphemeralPort();
    killListenersOnPort(port);
    await delay(200);
    const child = spawn(
      process.execPath,
      [
        "-e",
        `require("http").createServer((_, res) => res.end("ok")).listen(${port}, "127.0.0.1")`,
      ],
      { detached: true, stdio: "ignore" },
    );
    await delay(600);
    expect(isPortInUse(port)).toBe(true);

    const teardown = await teardownSpawnedServer(child, port);
    expect(teardown.ok, teardown.message).toBe(true);
    expect(isPortInUse(port)).toBe(false);
  }, 20_000);

  it("collectProcessTree includes nested children", async () => {
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1_000_000)"], {
      stdio: "ignore",
    });
    await delay(200);
    const tree = collectProcessTree(child.pid!);
    expect(tree).toContain(child.pid);
    child.kill("SIGKILL");
    await delay(100);
  });
});

describe("production-smoke teardown contract", () => {
  const smokePath = join(repoRoot, "scripts/production-smoke.mjs");
  const smokeSource = readFileSync(smokePath, "utf8");

  it("tracks spawned server with detached process group and scoped teardown", () => {
    expect(smokeSource).toMatch(/detached:\s*true/);
    expect(smokeSource).toMatch(/teardownSpawnedServer/);
    expect(smokeSource).not.toMatch(/server\.kill\(["']SIGTERM["']\)/);
    expect(smokeSource).toMatch(/production-smoke teardown failed/);
  });

  it("supports SMOKE_PORT override", () => {
    expect(smokeSource).toMatch(/process\.env\.SMOKE_PORT/);
  });
});
