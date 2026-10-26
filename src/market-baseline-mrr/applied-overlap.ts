import { readFile } from "node:fs/promises";
import { normalizeTldAsciiLabel } from "./period";

/**
 * Extract exact ASCII applied-string labels from a 2026 APS publication snapshot
 * (or a simple JSON list). IDN/U-label conversion is deferred unless already ASCII.
 */
export function extractAsciiAppliedLabels(payload: unknown): string[] {
  const out = new Set<string>();
  if (!payload || typeof payload !== "object") return [];

  const tryAdd = (raw: unknown) => {
    if (typeof raw !== "string") return;
    const s = raw.trim().toLowerCase();
    if (!s || s.includes(".")) return;
    try {
      // Exact ASCII / A-label only (including xn--); no speculative U-label conversion.
      out.add(normalizeTldAsciiLabel(s.startsWith(".") ? s.slice(1) : s));
    } catch {
      // skip invalid
    }
  };

  const root = payload as Record<string, unknown>;
  const apps = (root.applications ?? root.trackedApplications ?? root) as unknown;
  if (Array.isArray(apps)) {
    for (const app of apps) {
      if (!app || typeof app !== "object") continue;
      const a = app as Record<string, unknown>;
      const applied = a.appliedString as Record<string, unknown> | string | undefined;
      if (typeof applied === "string") tryAdd(applied);
      else if (applied && typeof applied === "object") {
        tryAdd(applied.label);
        tryAdd(applied.asciiLabel);
        tryAdd(applied.aLabel);
      }
      tryAdd(a.appliedStringLabel);
      tryAdd(a.label);
    }
  } else if (Array.isArray(payload)) {
    for (const x of payload) tryAdd(x);
  }

  return [...out].sort();
}

export async function loadAppliedAsciiLabelsFromFile(path: string): Promise<string[]> {
  const text = await readFile(path, "utf8");
  const json = JSON.parse(text) as unknown;
  return extractAsciiAppliedLabels(json);
}

/** SAFE overlap: applied ASCII label ∩ IANA delegated labels ∩ discovered MRR TLDs. */
export function selectDelegatedApplicationOverlaps(args: {
  appliedAsciiLabels: string[];
  delegatedLabels: Set<string>;
  discoveredMrrLabels: Set<string>;
}): string[] {
  return args.appliedAsciiLabels
    .filter(
      (l) =>
        args.delegatedLabels.has(l.toLowerCase()) && args.discoveredMrrLabels.has(l.toLowerCase()),
    )
    .sort();
}
