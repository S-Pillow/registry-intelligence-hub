import {
  readCompareTray,
  type CompareTrayState,
} from "@/lib/compare-tray-storage";

const listeners = new Set<() => void>();
let cachedSnapshot: CompareTrayState | null = null;
let cachedSerialized = "";

function refreshCache(): CompareTrayState | null {
  const next = readCompareTray();
  const serialized = next ? JSON.stringify(next) : "";
  if (serialized === cachedSerialized) {
    return cachedSnapshot;
  }
  cachedSerialized = serialized;
  cachedSnapshot = next;
  return cachedSnapshot;
}

export function subscribeCompareTray(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    const onCustom = () => listener();
    window.addEventListener("rih-compare-tray", onCustom);
    window.addEventListener("storage", onCustom);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("rih-compare-tray", onCustom);
      window.removeEventListener("storage", onCustom);
    };
  }
  return () => {
    listeners.delete(listener);
  };
}

export function getCompareTraySnapshot(): CompareTrayState | null {
  return refreshCache();
}

export function getCompareTrayServerSnapshot(): CompareTrayState | null {
  return null;
}

export function notifyCompareTrayListeners(): void {
  refreshCache();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("rih-compare-tray"));
  }
  for (const listener of listeners) listener();
}
