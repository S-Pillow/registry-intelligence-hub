// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataHealthContent } from "@/components/registry/data-health-content";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";
import { rehearsalRegistryApplicationsDocument } from "@/lib/registry-application-payload-shared";

function renderDataHealth() {
  return render(
    <HubClaimActualityProvider claimActualityState={DEFAULT_CLAIM_ACTUALITY_STATE}>
      <HubRegistryDataProvider
        resolution={{
          document: rehearsalRegistryApplicationsDocument(),
          mode: "rehearsal",
          selectionReason: "rehearsal-default",
        }}
      >
        <DataHealthContent />
      </HubRegistryDataProvider>
    </HubClaimActualityProvider>,
  );
}

describe("DataHealthContent", () => {
  it("renders operator sections and browser state facts from Ticket B", () => {
    renderDataHealth();

    expect(screen.getByRole("heading", { name: "Data Health" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Source Health" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Intelligence Readiness" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Browser Data State" })).toBeInTheDocument();

    expect(screen.getByText(/1930 applications \/ 1409 unique strings \/ 116 IDN/i)).toBeInTheDocument();
    expect(screen.getByText(/12-record/i)).toBeInTheDocument();
    expect(screen.getByText(/Not published \/ not promoted/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Atlas Digital, Kizuna/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/BLOCKED_METHOD/i).length).toBeGreaterThan(0);
  });
});
