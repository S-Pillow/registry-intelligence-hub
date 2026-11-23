// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RegistrationForecastContent } from "@/components/registry/registration-forecast-content";
import {
  defaultUnavailableSuffixDemandEvidence,
  type ForecastRow,
} from "@/lib/registration-forecast";

afterEach(() => cleanup());

const blockedRow = (label: string, contested = false): ForecastRow => ({
  stringLabel: label,
  unicodeLabel: null,
  status: "demand_unavailable",
  contested,
  officialContentionSetIds: contested ? ["76"] : [],
  applicantCount: contested ? 2 : 1,
  applicantLegalNames: contested
    ? ["Registry Services, LLC", "Salesforce, Inc."]
    : ["Registry Services, LLC"],
  compoundWordCandidate: true,
  suffixDemandCount: null,
  range: null,
  statusNote: "No approved domain-name-level dataset is currently accessible.",
});

describe("RegistrationForecastContent", () => {
  it("renders assumptions, coverage blocker, and example rows without fabricated ranges", () => {
    const demand = defaultUnavailableSuffixDemandEvidence();
    render(
      <RegistrationForecastContent
        rows={[blockedRow("master"), blockedRow("force", true)]}
        demandEvidence={demand}
        applicationSnapshotId="snap-aps-2026-applications-string-confirmation-v1"
      />,
    );

    expect(screen.getByTestId("forecast-estimate-disclaimer")).toHaveTextContent(/estimates, not facts/i);
    expect(screen.getByTestId("forecast-demand-status")).toHaveTextContent(/unavailable/i);
    expect(screen.getByTestId("forecast-demand-blocker")).toHaveTextContent(/domain-name-level/i);
    expect(screen.getByTestId("forecast-row-master")).toBeInTheDocument();
    expect(screen.getByTestId("forecast-row-force")).toHaveTextContent(/winner not predicted/i);
    expect(screen.queryByTestId("forecast-range-master")).not.toBeInTheDocument();
    expect(screen.getByTestId("forecast-chart-empty-master")).toBeInTheDocument();
  });
});
