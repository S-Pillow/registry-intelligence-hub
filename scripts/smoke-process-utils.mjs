/**
 * Scoped process/port helpers for production smoke and hub preview.
 * Never use broad `pkill -f next-server` — only the spawned process group or HUB_PORT listeners.
 */
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, readlinkSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

function localPortHexLE(targetPort) {
  const hex = targetPort.toString(16).padStart(4, "0").toUpperCase();
  return hex.slice(2) + hex.slice(0, 2);
}

function listeningInodesForPort(targetPort) {
  const portSuffix = `:${localPortHexLE(targetPort)}`;
  const inodes = new Set();
  for (const table of ["/proc/net/tcp", "/proc/net/tcp6"]) {
    try {
      const lines = readFileSync(table, "utf8").trim().split("\n").slice(1);
      for (const line of lines) {
        const cols = line.trim().split(/\s+/);
        if (cols[3] !== "0A") continue;
        if (!cols[1]?.endsWith(portSuffix)) continue;
        inodes.add(cols[9]);
      }
    } catch {
      // Not Linux or unreadable.
    }
  }
  return inodes;
}

function pidsOnPortViaProc(targetPort) {
  const inodes = listeningInodesForPort(targetPort);
  if (!inodes.size) return [];
  const pids = [];
  for (const entry of readdirSync("/proc")) {
    const pid = Number.parseInt(entry, 10);
    if (!Number.isFinite(pid)) continue;
    let fdDir;
    try {
      fdDir = join("/proc", entry, "fd");
      for (const fd of readdirSync(fdDir)) {
        let link;
        try {
          link = readlinkSync(join(fdDir, fd));
        } catch {
          continue;
        }
        const match = link.match(/^socket:\[(\d+)\]$/);
        if (match && inodes.has(match[1])) {
          pids.push(pid);
          break;
        }
      }
    } catch {
      continue;
    }
  }
  return [...new Set(pids)];
}

function isPortInUseViaBind(targetPort) {
  try {
    execSync(
      `${process.execPath} -e "require('net').createServer().once('error',()=>process.exit(0)).listen(${targetPort},'127.0.0.1',()=>process.exit(1))"`,
      { stdio: "ignore", timeout: 2_000 },
    );
    return true;
  } catch (error) {
    return error?.status !== 1;
  }
}

/** Kill processes listening on targetPort only (shared VPS safe). */
export function killListenersOnPort(targetPort) {
  try {
    execSync(`fuser -k ${targetPort}/tcp`, { stdio: "ignore" });
    return;
  } catch {
    // fuser unavailable or nothing listening — kill PIDs we can see on the port.
  }
  for (const pid of pidsOnPort(targetPort)) {
    try {
      signalProcessTree(pid, "SIGKILL");
    } catch {
      // Already exited.
    }
  }
}

function pidsOnPortViaSs(targetPort) {
  try {
    execSync("command -v ss >/dev/null 2>&1", { stdio: "ignore" });
    const out = execSync(`ss -tlnp sport = :${targetPort} 2>/dev/null`, { encoding: "utf8" });
    const pids = [...out.matchAll(/pid=(\d+)/g)].map((match) => Number.parseInt(match[1], 10));
    return [...new Set(pids.filter(Number.isFinite))];
  } catch {
    return [];
  }
}

/** PIDs listening on targetPort (fuser → ss → /proc). */
export function pidsOnPort(targetPort) {
  const numericPort = Number(targetPort);
  try {
    const out = execSync(`fuser ${numericPort}/tcp 2>/dev/null`, { encoding: "utf8" }).trim();
    if (out) {
      return [...new Set(out.split(/\s+/).map((token) => Number.parseInt(token, 10)).filter(Number.isFinite))];
    }
  } catch {
    // fuser missing or no listeners — fall through.
  }
  const viaSs = pidsOnPortViaSs(numericPort);
  if (viaSs.length) return viaSs;
  return pidsOnPortViaProc(numericPort);
}

export function isPortInUse(targetPort) {
  const numericPort = Number(targetPort);
  if (pidsOnPort(numericPort).length > 0) return true;
  return isPortInUseViaBind(numericPort);
}

export async function waitForPortFree(targetPort, { timeoutMs = 15_000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isPortInUse(targetPort)) return { ok: true };
    await delay(intervalMs);
  }
  const remaining = pidsOnPort(targetPort);
  return {
    ok: false,
    message:
      `Port ${targetPort} still in use after ${timeoutMs}ms` +
      (remaining.length ? ` (PIDs: ${remaining.join(", ")})` : ""),
  };
}

function childPids(parentPid) {
  try {
    const out = execSync(`pgrep -P ${parentPid}`, { encoding: "utf8" }).trim();
    if (!out) return [];
    return out.split("\n").map((line) => Number.parseInt(line, 10)).filter(Number.isFinite);
  } catch {
    return [];
  }
}

/** Depth-first collect of parentPid and all descendants (Linux pgrep). */
export function collectProcessTree(rootPid) {
  const seen = new Set();
  const stack = [rootPid];
  while (stack.length) {
    const pid = stack.pop();
    if (!Number.isFinite(pid) || seen.has(pid)) continue;
    seen.add(pid);
    for (const child of childPids(pid)) stack.push(child);
  }
  return [...seen];
}

/** Send signal to each PID in tree (children before root). */
export function signalProcessTree(rootPid, signal = "SIGTERM") {
  const tree = collectProcessTree(rootPid);
  const ordered = tree.filter((pid) => pid !== rootPid).concat(rootPid);
  for (const pid of ordered) {
    try {
      process.kill(pid, signal);
    } catch {
      // Already exited.
    }
  }
}

/**
 * Terminate a detached spawn's process group, then fall back to explicit tree kill.
 * Returns whether the port is free after waiting.
 */
export async function teardownSpawnedServer(child, targetPort, { waitTimeoutMs = 15_000 } = {}) {
  const rootPid = child.pid;
  if (rootPid) {
    try {
      process.kill(-rootPid, "SIGTERM");
    } catch {
      signalProcessTree(rootPid, "SIGTERM");
    }
    await delay(400);
    if (isPortInUse(targetPort)) {
      try {
        process.kill(-rootPid, "SIGKILL");
      } catch {
        signalProcessTree(rootPid, "SIGKILL");
      }
    }
  }

  try {
    child.kill("SIGKILL");
  } catch {
    // Already dead.
  }

  const portResult = await waitForPortFree(targetPort, { timeoutMs: waitTimeoutMs });
  if (portResult.ok) return portResult;

  const smokePids = rootPid ? new Set(collectProcessTree(rootPid)) : new Set();
  const portPids = pidsOnPort(targetPort);
  const orphanSmoke = portPids.filter((pid) => smokePids.has(pid));
  if (orphanSmoke.length) {
    for (const pid of orphanSmoke) signalProcessTree(pid, "SIGKILL");
    const retry = await waitForPortFree(targetPort, { timeoutMs: 5_000 });
    if (retry.ok) return retry;
  }

  return portResult;
}
