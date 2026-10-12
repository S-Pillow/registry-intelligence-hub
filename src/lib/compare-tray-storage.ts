/**
 * Client Compare tray for COMPARE-INTEL-2 (sessionStorage).
 * Homogeneous Applicant or Organization selections only.
 */

import {
  COMPARE_INTEL_MAX,
  compareIntelHref,
  type CompareIntelEntityType,
  isCompareIntelEntityType,
} from "@/lib/compare-intelligence";

export const COMPARE_TRAY_STORAGE_KEY = "rih-compare-intel-2-tray/v1";

export type CompareTrayItem = {
  key: string;
  label: string;
};

export type CompareTrayState = {
  type: CompareIntelEntityType;
  items: CompareTrayItem[];
};

export type CompareTrayAddResult =
  | { ok: true; state: CompareTrayState }
  | { ok: false; reason: "max" | "duplicate" | "mixed-grain" | "invalid"; message: string; state: CompareTrayState | null };

function emptyState(type: CompareIntelEntityType): CompareTrayState {
  return { type, items: [] };
}

export function readCompareTray(): CompareTrayState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(COMPARE_TRAY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CompareTrayState;
    if (!isCompareIntelEntityType(parsed.type) || !Array.isArray(parsed.items)) return null;
    const items = parsed.items
      .filter((i) => i && typeof i.key === "string" && typeof i.label === "string")
      .map((i) => ({ key: i.key.trim(), label: i.label.trim() }))
      .filter((i) => i.key);
    if (items.length === 0) return null;
    return { type: parsed.type, items: items.slice(0, COMPARE_INTEL_MAX) };
  } catch {
    return null;
  }
}

export function writeCompareTray(state: CompareTrayState | null): void {
  if (typeof window === "undefined") return;
  if (!state || state.items.length === 0) {
    sessionStorage.removeItem(COMPARE_TRAY_STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(COMPARE_TRAY_STORAGE_KEY, JSON.stringify(state));
}

export function addToCompareTray(
  type: CompareIntelEntityType,
  item: CompareTrayItem,
): CompareTrayAddResult {
  const current = readCompareTray();
  if (current && current.type !== type) {
    return {
      ok: false,
      reason: "mixed-grain",
      message:
        current.type === "applicant"
          ? "Compare already holds Applicants. Clear the tray or finish that comparison before adding Organizations — mixed grains are not compared in the same metric columns."
          : "Compare already holds Organizations. Clear the tray or finish that comparison before adding Applicants — mixed grains are not compared in the same metric columns.",
      state: current,
    };
  }
  const state = current ?? emptyState(type);
  if (state.items.some((i) => i.key === item.key)) {
    return { ok: false, reason: "duplicate", message: "Already in Compare tray.", state };
  }
  if (state.items.length >= COMPARE_INTEL_MAX) {
    return {
      ok: false,
      reason: "max",
      message: `Compare tray holds at most ${COMPARE_INTEL_MAX} entities.`,
      state,
    };
  }
  const next = { type, items: [...state.items, { key: item.key.trim(), label: item.label.trim() }] };
  writeCompareTray(next);
  return { ok: true, state: next };
}

export function removeFromCompareTray(key: string): CompareTrayState | null {
  const current = readCompareTray();
  if (!current) return null;
  const items = current.items.filter((i) => i.key !== key);
  const next = items.length ? { type: current.type, items } : null;
  writeCompareTray(next);
  return next;
}

export function clearCompareTray(): void {
  writeCompareTray(null);
}

export function compareTrayOpenHref(state: CompareTrayState): string {
  return compareIntelHref(
    state.type,
    state.items.map((i) => i.key),
    "Compare tray",
  );
}
