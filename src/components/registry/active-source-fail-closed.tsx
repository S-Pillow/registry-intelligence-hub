"use client";

import type { HubRegistryDataResolution } from "@/lib/registry-application-payload-shared";

export function ActiveSourceFailClosed({ resolution }: { resolution: HubRegistryDataResolution }) {
  return (
    <section
      data-testid="active-source-fail-closed"
      className="rounded-lg border border-red-300 bg-red-50 px-4 py-6 text-sm text-red-950"
      role="alert"
    >
      <h1 className="text-lg font-bold">Active 2026 source unavailable</h1>
      <p className="mt-2">
        Claim actuality is REAL_SOURCE_READY but the configured browser payload could not be
        activated. Rehearsal rows are intentionally not shown.
      </p>
      <p className="mt-2 font-mono text-xs" data-testid="active-source-error-code">
        {resolution.selectionReason}
      </p>
      <p className="mt-1 text-xs" data-testid="active-source-error-message">
        {resolution.activeSourceError?.message ?? "fail-closed"}
      </p>
    </section>
  );
}
