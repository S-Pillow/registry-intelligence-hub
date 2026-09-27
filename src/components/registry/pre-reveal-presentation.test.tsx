// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { CommandCenter } from "@/components/registry/command-center";
import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import syntheticPayload from "@/data/fixtures/synthetic-promote-1-not-a-publication.payload.json";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";
import {
  claimActualityAssertedForBrowser,
  resolveActiveRegistryApplicationsDocument,
  type RegistryApplicationsDocument,
} from "@/lib/registry-application-payload-shared";

const SYNTHETIC = syntheticPayload as RegistryApplicationsDocument;
const SYNTHETIC_NAMES = ["Atlas Digital", "Kizuna Registry", "Northstar Group", ".atlas", ".secure"];

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function pageText() {
  return document.body.textContent ?? "";
}

describe("PR-1A default pre-reveal presentation", () => {
  it("does not expose rehearsal entities, rankings, or the ICANN program URL", () => {
    render(<CommandCenter />);
    const text = pageText();
    for (const name of SYNTHETIC_NAMES) {
      expect(text).not.toContain(name);
    }
    expect(text).not.toContain("Search fixture records");
    expect(text).not.toContain("https://newgtldprogram.icann.org/");
    expect(text).not.toContain("ICANN New gTLD Program");
    expect(screen.queryByTestId("applicant-concentration")).not.toBeInTheDocument();
    expect(screen.queryByTestId("interest-by-category")).not.toBeInTheDocument();
    expect(screen.queryByTestId("rehearsal-structural-context")).not.toBeInTheDocument();
    expect(screen.queryByTestId("investigation-queue-0")).not.toBeInTheDocument();
    expect(screen.getByTestId("presentation-mode-banner")).toHaveTextContent("Pre-Reveal — 2026 public application data has not been promoted");
    expect(screen.getByTestId("presentation-mode-banner").className).not.toMatch(/\bhidden\b/);
  });

  it("keeps approved 2012 aggregates and unavailable states", () => {
    render(<CommandCenter />);
    expect(screen.getByRole("button", { name: "View intelligence for Applications: 1930" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View intelligence for Unique strings: 1409" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View intelligence for IDN applications: 116" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View intelligence for Community applications: 84" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View intelligence for Geographic applications: 66" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `View intelligence for Applications in initial contention: ${APPROVED_2012_BASELINE.contentionMembershipApplications}` })).toBeInTheDocument();
    expect(screen.getByTestId("contention-set-count-unavailable")).toHaveTextContent("Contention-set count is unavailable");
    expect(screen.getByTestId("contention-set-count-unavailable")).toHaveAttribute("data-set-count-available", "false");
    expect(screen.getByTestId("category-mix-comparison")).toHaveTextContent("Category comparison unavailable");
    expect(pageText()).toContain("Market demand is not available");
    expect(pageText()).not.toMatch(/Market demand:\s*0/);
  });

  it("does not return rehearsal rows from Search, Explore, or Compare", () => {
    const { unmount } = render(<CommandCenter />);
    expect(screen.getByRole("textbox", { name: "2026 application search" })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "Rehearsal search results" })).not.toBeInTheDocument();
    expect(screen.getByTestId("pre-reveal-search-note")).toBeInTheDocument();
    unmount();

    render(<CommandCenter view="explore" />);
    expect(screen.getByText("2026 Explore is waiting for publication")).toBeInTheDocument();
    expect(pageText()).not.toContain("Atlas Digital");
    expect(pageText()).not.toContain("APP-26001");
    cleanup();

    render(<CommandCenter view="compare" compareParams={{ type: "organizations", ids: "Atlas Digital,Kizuna Registry" }} />);
    expect(screen.getByText("2026 comparison is waiting for publication")).toBeInTheDocument();
    expect(pageText()).not.toContain("Atlas Digital");
    expect(pageText()).not.toContain("Kizuna Registry");
  });

  it("does not render historicalContext category integers as 2012 cohort facts", () => {
    render(<CommandCenter presentation="rehearsal" view="compare" compareParams={{ type: "categories", ids: "Technology,Identity,Consumer,Community,Geographic,Media" }} />);
    expect(screen.getAllByText("Not available — 2012 category cohort is not an approved comparison").length).toBeGreaterThan(0);
    expect(pageText()).not.toContain("Illustrative normalized 2012 rehearsal cohort");
    expect(pageText()).not.toContain("https://newgtldprogram.icann.org/");
  });

  it("withholds stored rehearsal briefings and saved labels", async () => {
    window.localStorage.setItem("registry-hub:watchlists:v1", JSON.stringify([{
      id: "wl-1",
      name: "Atlas Digital list",
      isQuickWatch: false,
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      lastOpenedAt: "2026-09-01T00:00:00.000Z",
      items: [{ entityType: "organizations", entityKey: "Kizuna Registry", label: "Kizuna Registry", addedAt: "2026-09-01T00:00:00.000Z", recordCountAtAdd: 2 }],
    }]));
    window.localStorage.setItem("registry-hub:briefing-definitions:v1", JSON.stringify([{
      id: "b-1",
      name: "Atlas Digital briefing",
      entryPath: "instant",
      audience: "executive",
      emphasis: "all",
      detailLevel: "brief",
      sectionsWanted: ["headline-metrics"],
      scope: { kind: "entity", entityType: "organizations", entityKey: "Atlas Digital", label: "Atlas Digital" },
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
      lastOpenedAt: "2026-09-01T00:00:00.000Z",
      currentEditionId: "e-1",
    }]));
    window.localStorage.setItem("registry-hub:briefing-editions:v1", JSON.stringify([{
      id: "e-1",
      definitionId: "b-1",
      status: "draft",
      generatedAt: "2026-09-01T00:00:00.000Z",
      dataAsOfTime: "2026-09-01T00:00:00.000Z",
      snapshotId: "snap-rehearsal-2026-09-16",
      methodVersion: "round-pulse/1.0.0",
      sections: [{ id: "headline-metrics", title: "Headline metrics", included: true, asOfNote: "Kizuna Registry stands out", claims: [{ id: "c1", text: "Kizuna Registry is the lead applicant", truthClass: "calculated-metric", evidence: [] }], overflowCount: 0 }],
      limitations: [],
      recordedScopeCount: 2,
    }]));

    render(<CommandCenter view="saved" />);
    expect(await screen.findByTestId("saved-rehearsal-quarantine")).toHaveTextContent("1 watchlist item");
    expect(pageText()).not.toContain("Atlas Digital");
    expect(pageText()).not.toContain("Kizuna Registry");
    cleanup();

    render(<CommandCenter view="briefings" />);
    expect(await screen.findByTestId("briefing-rehearsal-quarantine")).toHaveTextContent("1 browser-local briefing");
    expect(screen.queryByRole("button", { name: "New Briefing" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy as plain text" })).not.toBeInTheDocument();
    expect(pageText()).not.toContain("Atlas Digital");
    expect(pageText()).not.toContain("Kizuna Registry");
  });

  it("does not crash when stored saved data is malformed", async () => {
    window.localStorage.setItem("registry-hub:watchlists:v1", "{not-json");
    render(<CommandCenter view="saved" />);
    expect(await screen.findByText("Saved 2026 entities are waiting for publication")).toBeInTheDocument();
    expect(screen.queryByTestId("saved-rehearsal-quarantine")).not.toBeInTheDocument();
  });
});

describe("PR-1A demo rehearsal mode", () => {
  it("exposes rehearsal data with a persistent label and synthetic provenance", async () => {
    const user = userEvent.setup();
    const before = JSON.stringify(DEFAULT_CLAIM_ACTUALITY_STATE);
    render(<CommandCenter presentation="rehearsal" />);
    expect(JSON.stringify(DEFAULT_CLAIM_ACTUALITY_STATE)).toBe(before);
    expect(DEFAULT_CLAIM_ACTUALITY_STATE.round2026ApplicationActuality).not.toBe("REAL_SOURCE_READY");

    const banner = screen.getByTestId("presentation-mode-banner");
    expect(banner).toHaveTextContent("Demo / Rehearsal — synthetic data, not an ICANN publication");
    expect(banner.className).not.toMatch(/\bhidden\b/);
    expect(banner.className).not.toMatch(/sm:hidden|max-sm:hidden/);
    expect(screen.getAllByText("Atlas Digital").length).toBeGreaterThan(0);
    expect(pageText()).toContain(".atlas");
    expect(pageText()).toContain(".secure");
    expect(screen.getByTestId("interest-by-category")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: /View intelligence for Atlas Digital/ })[0]);
    const source = await screen.findByTestId("rehearsal-source-name");
    expect(source).toHaveTextContent("RIH synthetic rehearsal fixture");
    expect(screen.getByTestId("rehearsal-evidence-class")).toHaveTextContent("synthetic / rehearsal");
    expect(within(source.closest("section") ?? document.body).queryByRole("link", { name: /newgtldprogram\.icann\.org/i })).not.toBeInTheDocument();
    expect(pageText()).not.toContain("https://newgtldprogram.icann.org/");
    expect(pageText()).not.toContain("ICANN New gTLD Program");
  });
});

describe("PR-1A promoted snapshot still wins over demo", () => {
  it("keeps promoted rows and does not mutate claim state", () => {
    const claim = {
      ...DEFAULT_CLAIM_ACTUALITY_STATE,
      round2026ApplicationActuality: "REAL_SOURCE_READY" as const,
      promotedAt: "2099-01-01T00:00:00.000Z",
      snapshotId: SYNTHETIC.snapshotId,
      snapshotContentHash: SYNTHETIC.snapshotContentHash ?? "",
      rawSha256: "synthetic-promote-1-raw-not-a-publication",
      stewardApprovalId: "synthetic-steward-not-a-publication",
      productApprovalId: "synthetic-product-not-a-publication",
      promotionGates: {
        snapshotValidated: true,
        parserPassed: true,
        normalizationPassed: true,
        provenanceRecorded: true,
        validationPassed: true,
        contaminationClear: true,
      },
    };
    const before = JSON.stringify(claim);
    const resolution = resolveActiveRegistryApplicationsDocument(claim, SYNTHETIC);
    render(
      <HubClaimActualityProvider claimActualityState={claimActualityAssertedForBrowser(claim, resolution)}>
        <HubRegistryDataProvider resolution={resolution}>
          <CommandCenter presentation="rehearsal" />
        </HubRegistryDataProvider>
      </HubClaimActualityProvider>,
    );
    expect(JSON.stringify(claim)).toBe(before);
    expect(screen.getByText(/synthetic-not-a-2026-publication-alpha/)).toBeInTheDocument();
    expect(pageText()).not.toContain("Atlas Digital");
    expect(pageText()).not.toContain("Kizuna Registry");
    expect(screen.queryByTestId("presentation-mode-banner")).not.toBeInTheDocument();
  });
});
