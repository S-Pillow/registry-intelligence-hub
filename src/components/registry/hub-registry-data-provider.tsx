"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { HubRegistryDataResolution } from "@/lib/registry-application-payload-shared";
import { rehearsalRegistryApplicationsDocument } from "@/lib/registry-application-payload-shared";
import type { RegistryApplicationsDocument } from "@/lib/registry-applications-document";

const defaultResolution: HubRegistryDataResolution = {
  document: rehearsalRegistryApplicationsDocument(),
  mode: "rehearsal",
  selectionReason: "rehearsal-default",
};

const HubRegistryDataContext = createContext<HubRegistryDataResolution>(defaultResolution);

export function HubRegistryDataProvider({
  resolution,
  children,
}: {
  resolution: HubRegistryDataResolution;
  children: ReactNode;
}) {
  return <HubRegistryDataContext.Provider value={resolution}>{children}</HubRegistryDataContext.Provider>;
}

export function useHubRegistryData(): HubRegistryDataResolution {
  return useContext(HubRegistryDataContext);
}

export function useHubRegistryDocument(): RegistryApplicationsDocument {
  return useContext(HubRegistryDataContext).document;
}

export function useHubRegistryApplications() {
  return useContext(HubRegistryDataContext).document.applications;
}
