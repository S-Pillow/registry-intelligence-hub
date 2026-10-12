"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import type { CompareIntelEntityType } from "@/lib/compare-intelligence";
import {
  addToCompareTray,
  compareTrayOpenHref,
} from "@/lib/compare-tray-storage";
import {
  getCompareTrayServerSnapshot,
  getCompareTraySnapshot,
  notifyCompareTrayListeners,
  subscribeCompareTray,
} from "@/lib/compare-tray-subscribe";

export function CompareAddButton({
  type,
  entityKey,
  label,
  className = "",
  testId,
}: {
  type: CompareIntelEntityType;
  entityKey: string;
  label: string;
  className?: string;
  testId?: string;
}) {
  const tray = useSyncExternalStore(
    subscribeCompareTray,
    getCompareTraySnapshot,
    getCompareTrayServerSnapshot,
  );
  const [message, setMessage] = useState<string | null>(null);
  const selected = tray?.type === type && tray.items.some((i) => i.key === entityKey);

  return (
    <div className={`inline-flex flex-col gap-1 ${className}`}>
      <button
        type="button"
        disabled={selected}
        data-testid={testId ?? `compare-add-${type}-${entityKey}`}
        className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-bold text-[#006a56] hover:border-[#007d65] hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={selected ? `Added ${label} to Compare` : `Add ${label} to Compare`}
        onClick={() => {
          const result = addToCompareTray(type, { key: entityKey, label });
          notifyCompareTrayListeners();
          setMessage(result.ok ? "Added to Compare tray" : result.message);
        }}
      >
        {selected ? "In Compare" : "Add to Compare"}
      </button>
      {message ? (
        <p className="max-w-xs text-xs text-slate-600" data-testid="compare-add-message">
          {message}{" "}
          {tray && tray.items.length >= 2 ? (
            <Link href={compareTrayOpenHref(tray)} className="font-semibold text-[#006a56] underline">
              Open Compare
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

/** Compact floating tray for profile / landscape surfaces. */
export function CompareTrayFloating() {
  const tray = useSyncExternalStore(
    subscribeCompareTray,
    getCompareTraySnapshot,
    getCompareTrayServerSnapshot,
  );
  if (!tray || tray.items.length === 0) return null;
  return (
    <div
      className="fixed bottom-4 right-4 z-40 max-w-sm rounded-lg border border-[#006a56]/40 bg-white p-3 shadow-lg"
      data-testid="compare-tray-floating"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-[#006a56]">
        Compare · {tray.type === "applicant" ? "Applicants" : "Organizations"} ({tray.items.length})
      </p>
      <p className="mt-1 text-xs text-slate-600">{tray.items.map((i) => i.label).join(" · ")}</p>
      {tray.items.length >= 2 ? (
        <Link
          href={compareTrayOpenHref(tray)}
          className="mt-2 inline-flex rounded-lg bg-[#006a56] px-3 py-1.5 text-xs font-bold text-white"
          data-testid="compare-tray-floating-open"
        >
          Open Compare
        </Link>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Add one more like entity</p>
      )}
    </div>
  );
}
