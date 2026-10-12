"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  coerceHubRegistryDataResolution,
  rehearsalRegistryApplicationsDocument,
  type HubRegistryDataResolution,
  type HubRegistryDataResolutionInput,
} from "@/lib/registry-application-payload-shared";
import type { RegistryApplicationsDocument } from "@/lib/registry-applications-document";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";

/** Stub for shared 1.x shell hooks when ActiveV2 is promoted (document is null). */
function promotedV2DocumentStub(): RegistryApplicationsDocument {
  return rehearsalRegistryApplicationsDocument();
}

const defaultResolution: HubRegistryDataResolution = {
  status: "ok",
  document: rehearsalRegistryApplicationsDocument(),
  documentV2: null,
  documentVersion: "1.0.0",
  mode: "rehearsal",
  selectionReason: "rehearsal-default",
  activeSourceError: null,
};

const HubRegistryDataContext = createContext<HubRegistryDataResolution>(defaultResolution);

export function HubRegistryDataProvider({
  resolution,
  children,
}: {
  resolution: HubRegistryDataResolutionInput;
  children: ReactNode;
}) {
  return (
    <HubRegistryDataContext.Provider value={coerceHubRegistryDataResolution(resolution)}>
      {children}
    </HubRegistryDataContext.Provider>
  );
}

export function useHubRegistryData(): HubRegistryDataResolution {
  return useContext(HubRegistryDataContext);
}

/**
 * 1.x / rehearsal document accessor.
 * Fail-closed still throws. When ActiveV2 is promoted (`document` is null), returns a
 * rehearsal stub so shared shell controls (e.g. disabled Briefings on historical Explore)
 * can mount — ActiveV2 UI must use `useHubRegistryDocumentV2` for real 2026 rows.
 */
export function useHubRegistryDocument(): RegistryApplicationsDocument {
  const resolution = useContext(HubRegistryDataContext);
  if (resolution.status === "fail-closed") {
    throw new Error(
      resolution.activeSourceError?.message
        ?? "Active registry document unavailable (fail-closed)",
    );
  }
  if (resolution.document) return resolution.document;
  if (resolution.status === "ok" && resolution.mode === "promoted-2026-v2") {
    return promotedV2DocumentStub();
  }
  throw new Error(
    resolution.activeSourceError?.message
      ?? "Active registry document unavailable (fail-closed or 2.x active — use useHubRegistryData / useHubRegistryDocumentV2)",
  );
}

export function useHubRegistryDocumentV2(): RegistryApplicationsDocumentV2 {
  const resolution = useContext(HubRegistryDataContext);
  if (resolution.status !== "ok" || !resolution.documentV2) {
    throw new Error("Active registry 2.x document unavailable");
  }
  return resolution.documentV2;
}

export function useHubRegistryApplications() {
  return useHubRegistryDocument().applications;
}
