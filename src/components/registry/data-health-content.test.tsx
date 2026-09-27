// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DataHealthContent } from "@/components/registry/data-health-content";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubHistorical2012Provider } from "@/components/registry/hub-historical-2012-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import type { Historical2012PayloadResolution } from "@/historical-2012/payload-shared";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";
import { approvedApplicationActualityPromotionFixture } from "@/lib/claim-actuality-browser-wiring.test";
import {
  buildBrowserApplicationPayloadFromPublication,
  resolveActiveRegistryApplicationsDocument,
} from "@/lib/registry-application-payload";
import { loadPublicationSnapshotFromPath } from "@/reveal-day-2026/dry-run";
import { join } from "node:path";

const DRILL_PUBLICATION = join(
  process.cwd(),
  "src/reveal-day-2026/fixtures/drill-2026-intake-v1/publication.snapshot.json",
);

function renderDataHealth(
  claimActuality = DEFAULT_CLAIM_ACTUALITY_STATE,
  resolution = resolveActiveRegistryApplicationsDocument(claimActuality, null),
  historical2012: Historical2012PayloadResolution = {
    status: "not-loaded",
    reason: "not-configured",
    errorMessage: "not configured",
  },
) {
  return render(
    <HubClaimActualityProvider claimActualityState={claimActuality}>
      <HubRegistryDataProvider resolution={resolution}>
        <HubHistorical2012Provider applicationPayload={historical2012} confirmedPortfolios={{ status: "not-loaded", reason: "not-configured", errorMessage: "not configured" }}>
          <DataHealthContent />
        </HubHistorical2012Provider>
      </HubRegistryDataProvider>
    </HubClaimActualityProvider>,
  );
}

describe("DataHealthContent", () => {
  it("renders operator sections, current state summary, and browser state facts from Ticket B", () => {
    renderDataHealth();

    expect(screen.getByRole("heading", { name: "Data Health" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Current state/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Source Health" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Intelligence Readiness" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Browser Data State" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2012 historical round" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2026 browser entities" })).toBeInTheDocument();

    expect(screen.getByText(/1930 applications · 1409 unique strings · 116 IDN applications/i)).toBeInTheDocument();
    expect(screen.getByText(/withheld from the default product surface/i)).toBeInTheDocument();
    expect(screen.getByText(/Not published — rehearsal identity only/i)).toBeInTheDocument();
    expect(screen.getByText(/Synthetic rehearsal only/i)).toBeInTheDocument();
    expect(screen.getAllByText(/not 2012 Reveal Day applicants/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Atlas Digital/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/Comparable method/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Blocked by method/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Prerequisite checklist/i)).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "2012 aggregate readiness" }).closest("li")).toHaveTextContent(
      /Ready/,
    );
    expect(screen.getByRole("heading", { name: "2012 entity browser" }).closest("li")).toHaveTextContent(
      /Not loaded/,
    );
    expect(screen.queryByRole("heading", { name: "2012 entity browser" })?.closest("li")).not.toHaveTextContent(
      /Blocked/,
    );
    expect(screen.getByRole("heading", { name: "Cross-round comparison" }).closest("li")).toHaveTextContent(
      /Gated/,
    );
  });

  it("renders promoted claim with matching payload (drill fixture pattern)", async () => {
    const publication = await loadPublicationSnapshotFromPath(DRILL_PUBLICATION);
    const payload = buildBrowserApplicationPayloadFromPublication(publication);
    const promoted = {
      ...approvedApplicationActualityPromotionFixture(),
      snapshotId: payload.snapshotId,
      snapshotContentHash: payload.snapshotContentHash!,
    };
    const resolution = resolveActiveRegistryApplicationsDocument(promoted, payload);
    renderDataHealth(promoted, resolution);

    expect(screen.getAllByText(/Promoted 2026 payload active/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/100-record/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Approved source ready/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Hash-matched browser application payload/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Hash-matched browser application payload: Complete/i)).toBeInTheDocument();
  });

  it("shows fail-closed rehearsal fallback when promotion pins mismatch", async () => {
    const publication = await loadPublicationSnapshotFromPath(DRILL_PUBLICATION);
    const payload = buildBrowserApplicationPayloadFromPublication(publication);
    const promoted = {
      ...approvedApplicationActualityPromotionFixture(),
      snapshotId: payload.snapshotId,
      snapshotContentHash: payload.snapshotContentHash!,
    };
    const resolution = resolveActiveRegistryApplicationsDocument(
      { ...promoted, snapshotContentHash: "wrong-hash" },
      payload,
    );
    renderDataHealth(promoted, resolution);

    expect(
      screen.getAllByText(/Content hash pin mismatch — fail-closed to rehearsal/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByLabelText(/Hash-matched browser application payload: Fail-closed fallback/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/withheld from the default product surface/i).length).toBeGreaterThan(0);
  });
});
