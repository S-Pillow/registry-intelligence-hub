"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ConfirmedPortfoliosSidecarResolution } from "@/historical-2012/confirmed-portfolios-sidecar-shared";
import type { Historical2012PayloadResolution } from "@/historical-2012/payload-shared";
import type { Historical2012StructuralSummary } from "@/historical-2012/structural-summary";

const defaultApplicationResolution: Historical2012PayloadResolution = {
  status: "not-loaded",
  reason: "not-configured",
  errorMessage:
    "2012 historical application rows are not available.",
};

const defaultConfirmedPortfoliosResolution: ConfirmedPortfoliosSidecarResolution = {
  status: "not-loaded",
  reason: "not-configured",
  errorMessage:
    "2012 confirmed portfolio sidecar is not available.",
};

export type HubHistorical2012ContextValue = {
  applicationPayload: Historical2012PayloadResolution;
  confirmedPortfolios: ConfirmedPortfoliosSidecarResolution;
  structuralSummary: Historical2012StructuralSummary | null;
};

const HubHistorical2012Context = createContext<HubHistorical2012ContextValue>({
  applicationPayload: defaultApplicationResolution,
  confirmedPortfolios: defaultConfirmedPortfoliosResolution,
  structuralSummary: null,
});

export function HubHistorical2012Provider({
  applicationPayload,
  confirmedPortfolios,
  structuralSummary = null,
  children,
}: {
  applicationPayload: Historical2012PayloadResolution;
  confirmedPortfolios: ConfirmedPortfoliosSidecarResolution;
  structuralSummary?: Historical2012StructuralSummary | null;
  children: ReactNode;
}) {
  return (
    <HubHistorical2012Context.Provider value={{ applicationPayload, confirmedPortfolios, structuralSummary }}>
      {children}
    </HubHistorical2012Context.Provider>
  );
}

/** Back-compat: 2012 application browser payload resolution (D1/D2). */
export function useHistorical2012Payload(): Historical2012PayloadResolution {
  return useContext(HubHistorical2012Context).applicationPayload;
}

export function useHistorical2012ConfirmedPortfolios(): ConfirmedPortfoliosSidecarResolution {
  return useContext(HubHistorical2012Context).confirmedPortfolios;
}

export function useHistorical2012StructuralSummary(): Historical2012StructuralSummary | null {
  return useContext(HubHistorical2012Context).structuralSummary;
}
