// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubHistorical2012Provider } from "@/components/registry/hub-historical-2012-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { CommandCenter } from "@/components/registry/command-center";
import { APPROVED_2012_BASELINE } from "@/comparison/approved-2012-baseline";
import syntheticPayload from "@/data/fixtures/synthetic-promote-1-not-a-publication.payload.json";
import type { Registry2012ApplicationsDocument } from "@/historical-2012/browser-payload-document";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import {
  CONFIRMED_2012_MAPPED_APPLICATION_COUNT,
  CONFIRMED_2012_PORTFOLIO_COUNT,
  OFFLINE_2012_ORG_UNRESOLVED_APPLICATIONS,
} from "@/historical-2012/confirmed-portfolios-constants";
import { resolveHistorical2012BrowserPayload } from "@/historical-2012/payload-shared";
import {
  prepareHistorical2012SharedLayout,
  type Historical2012StructuralSummary,
} from "@/historical-2012/structural-summary";
import type { Historical2012PayloadResolution } from "@/historical-2012/payload-shared";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";
import {
  claimActualityAssertedForBrowser,
  resolveActiveRegistryApplicationsDocument,
  type RegistryApplicationsDocument,
} from "@/lib/registry-application-payload-shared";

const SYNTHETIC = syntheticPayload as RegistryApplicationsDocument;
const corpus = JSON.parse(
  readFileSync(join(process.cwd(), "src/data/fixtures/registry-2012-applications.payload.json"), "utf8"),
) as Registry2012ApplicationsDocument;

let applicationPayload: Historical2012PayloadResolution;
let structuralSummary: Historical2012StructuralSummary;

function renderCommandCenter(presentation?: "pre-reveal" | "rehearsal", view?: "command" | "explore") {
  return render(
    <HubHistorical2012Provider
      applicationPayload={applicationPayload}
      confirmedPortfolios={{ status: "not-loaded", reason: "not-configured", errorMessage: "not configured" }}
      structuralSummary={structuralSummary}
    >
      <CommandCenter presentation={presentation} view={view} />
    </HubHistorical2012Provider>,
  );
}

beforeAll(() => {
  const resolution = resolveHistorical2012BrowserPayload(corpus, APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH);
  const prepared = prepareHistorical2012SharedLayout(resolution);
  if (prepared.applicationPayload.status !== "loaded" || prepared.structuralSummary === null) {
    throw new Error("2012 structural summary did not prepare");
  }
  applicationPayload = prepared.applicationPayload;
  structuralSummary = prepared.structuralSummary;
});

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("PR-6 Command Center 2012 structure", () => {
  it("19 renders the summaries when the client has no application rows", () => {
    expect(applicationPayload.status).toBe("loaded");
    if (applicationPayload.status !== "loaded") return;
    expect(applicationPayload.document.applications).toEqual([]);
    renderCommandCenter();
    expect(screen.getByTestId("historical-2012-legal-name-0")).toHaveTextContent("Charleston Road Registry Inc.");
    expect(screen.getByTestId("historical-2012-region-NA")).toHaveTextContent("911");
    expect(screen.getByTestId("historical-2012-exact-string-0")).toHaveTextContent("APP");
    expect(screen.getByTestId("historical-2012-exact-string-0")).toHaveTextContent("13 applications");
  });

  it("20 labels the section as 2012 Reveal Day and not a 2026 value", () => {
    renderCommandCenter();
    const section = screen.getByTestId("historical-2012-structure");
    expect(section).toHaveTextContent("2012 REVEAL DAY");
    expect(section).toHaveTextContent("Historical structure");
    expect(section).toHaveTextContent("2012 Reveal Day application export");
    expect(section).toHaveTextContent("not 2026 values");
    expect(section).not.toHaveTextContent("2026 ranking");
    expect(section).not.toHaveTextContent("published 2026");
  });

  it("21 labels applicant legal name, states the denominator, and does not say organization ranking", () => {
    renderCommandCenter();
    const card = screen.getByTestId("historical-2012-legal-names");
    expect(within(card).getByText("Applicant legal name")).toBeInTheDocument();
    expect(card).toHaveTextContent("1154 applicant legal names across 1930 applications");
    expect(card).toHaveTextContent("101 of 1930");
    expect(card).toHaveTextContent("76 of 1930");
    expect(card).toHaveTextContent("Not a resolved organization");
    expect(card).not.toHaveTextContent("Organization ranking");
    expect(card).not.toHaveTextContent(/organization ranking/i);
    expect(within(card).queryByText("Organization")).not.toBeInTheDocument();
    const source = readFileSync(join(process.cwd(), "src/components/registry/historical-2012-structure-section.tsx"), "utf8");
    expect(source).not.toContain("Organization ranking");
    expect(source).not.toContain("Charleston Road");
    expect(source).not.toMatch(/\b911\b/);
  });

  it("22 shows ICANN region codes and the Location field without geography relabeling", () => {
    renderCommandCenter();
    const card = screen.getByTestId("historical-2012-geography");
    expect(card).toHaveTextContent("Location and ICANN region");
    expect(card).toHaveTextContent("Location and Region fields");
    expect(screen.getByTestId("historical-2012-location-count")).toHaveTextContent("60");
    expect(screen.getByTestId("historical-2012-region-sum")).toHaveTextContent("1930");
    expect(screen.getByTestId("historical-2012-region-NA")).toHaveTextContent("NA");
    expect(screen.getByTestId("historical-2012-region-NA")).toHaveTextContent("911");
    expect(screen.getByTestId("historical-2012-region-EUR")).toHaveTextContent("675");
    expect(screen.getByTestId("historical-2012-region-AP")).toHaveTextContent("303");
    expect(screen.getByTestId("historical-2012-region-LAC")).toHaveTextContent("24");
    expect(screen.getByTestId("historical-2012-region-AF")).toHaveTextContent("17");
    for (const label of ["headquarters", "incorporation", "operating geography", "North America", "Latin America", "Middle East", "Europe", "Asia Pacific", "Africa"]) {
      expect(card).not.toHaveTextContent(label);
    }
  });

  it("23 calls the module exact-string competition and withholds a set total", () => {
    renderCommandCenter();
    const card = screen.getByTestId("historical-2012-exact-strings");
    expect(card).toHaveAttribute("data-set-count-shown", "false");
    expect(within(card).getByText("Exact-string competition")).toBeInTheDocument();
    expect(card).toHaveTextContent("not the official contention-set count");
    expect(card).toHaveTextContent("No contention-set total is shown");
    expect(card).toHaveTextContent("No extra trim, case-fold, or IDN fold");
    expect(screen.getByTestId("historical-2012-exact-string-largest")).toHaveTextContent("Largest group: APP · 13 applications");
    expect(screen.getByTestId("historical-2012-exact-string-1")).toHaveTextContent("HOME");
    expect(screen.getByTestId("historical-2012-exact-string-2")).toHaveTextContent("INC");
    expect(card).not.toHaveTextContent("contention sets");
    expect(card).not.toHaveTextContent(/\b230\b/);
    expect(card).not.toHaveTextContent(/\b751\b/);
  });

  it("24 does not show 232 or 234 as a set total", () => {
    renderCommandCenter();
    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/\b232\b/);
    expect(text).not.toMatch(/\b234\b/);
    expect(screen.getByTestId("contention-set-count-unavailable")).toHaveAttribute("data-set-count-available", "false");
  });

  it("25 keeps 754 as contention-publication membership", () => {
    renderCommandCenter();
    expect(screen.getByRole("button", { name: `View intelligence for Applications in initial contention: ${APPROVED_2012_BASELINE.contentionMembershipApplications}` })).toBeInTheDocument();
    expect(APPROVED_2012_BASELINE.contentionMembershipApplications).toBe(754);
    expect(screen.getByTestId("historical-contention-membership")).toHaveTextContent("754");
    expect(screen.getByTestId("contention-set-count-unavailable")).toHaveTextContent("Contention-set count is unavailable");
  });

  it("26 keeps rehearsal names off the default visible page", () => {
    renderCommandCenter();
    const text = document.body.textContent ?? "";
    for (const name of ["Atlas Digital", "Kizuna Registry", "Northstar Group", ".atlas", ".secure"]) {
      expect(text).not.toContain(name);
    }
    expect(screen.queryByTestId("applicant-concentration")).not.toBeInTheDocument();
    expect(screen.queryByTestId("organization-label-counts")).not.toBeInTheDocument();
  });

  it("27 keeps the 2026 waiting state obvious", () => {
    renderCommandCenter();
    expect(screen.getByTestId("presentation-mode-banner")).toHaveTextContent("Pre-Reveal — 2026 public application data has not been promoted");
    expect(screen.getByTestId("publication-state-summary")).toHaveTextContent("2026 Reveal Day data is not promoted yet");
    expect(screen.getByTestId("pre-reveal-waiting")).toHaveTextContent("2026 rankings are waiting for publication");
    expect(screen.getByRole("textbox", { name: "2026 application search" })).toBeDisabled();
    expect(screen.getByTestId("pre-reveal-search-note")).toBeInTheDocument();
  });

  it("28 does not fill rehearsal or promoted rankings with 2012 legal names", () => {
    renderCommandCenter("rehearsal");
    const rehearsalCard = screen.getByTestId("applicant-concentration");
    expect(rehearsalCard).toHaveTextContent("Atlas Digital Registry LLC");
    expect(rehearsalCard).not.toHaveTextContent("Charleston Road Registry Inc.");
    const historicalCard = screen.getByTestId("historical-2012-legal-names");
    expect(historicalCard).toHaveTextContent("Charleston Road Registry Inc.");
    expect(historicalCard).not.toHaveTextContent("Atlas Digital");
    cleanup();

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
    const resolution = resolveActiveRegistryApplicationsDocument(claim, SYNTHETIC);
    render(
      <HubClaimActualityProvider claimActualityState={claimActualityAssertedForBrowser(claim, resolution)}>
        <HubRegistryDataProvider resolution={resolution}>
          <HubHistorical2012Provider
            applicationPayload={applicationPayload}
            confirmedPortfolios={{ status: "not-loaded", reason: "not-configured", errorMessage: "not configured" }}
            structuralSummary={structuralSummary}
          >
            <CommandCenter presentation="rehearsal" />
          </HubHistorical2012Provider>
        </HubRegistryDataProvider>
      </HubClaimActualityProvider>,
    );
    const promotedCard = screen.getByTestId("applicant-concentration");
    expect(promotedCard).toHaveTextContent("Synthetic Legal Name Alpha");
    expect(promotedCard).not.toHaveTextContent("Charleston Road Registry Inc.");
    expect(screen.getByTestId("historical-2012-legal-names")).toHaveTextContent("Charleston Road Registry Inc.");
    expect(screen.queryByTestId("presentation-mode-banner")).not.toBeInTheDocument();
  });

  it("29 does not present returning, confidence, category, brand, or portfolio inference", () => {
    renderCommandCenter();
    const section = screen.getByTestId("historical-2012-structure");
    expect(section).not.toHaveTextContent(/confidence/i);
    expect(section).not.toHaveTextContent(/returning/i);
    expect(section).not.toHaveTextContent(/\bBrand\b/);
    expect(section).not.toHaveTextContent(/\bRSP\b/);
    expect(section).not.toHaveTextContent(/market share/i);
    expect(section).not.toHaveTextContent(/confirmed portfolio/i);
    expect(section).not.toHaveTextContent("Technology");
    expect(CONFIRMED_2012_PORTFOLIO_COUNT).toBe(17);
    expect(CONFIRMED_2012_MAPPED_APPLICATION_COUNT).toBe(467);
    expect(OFFLINE_2012_ORG_UNRESOLVED_APPLICATIONS).toBe(1428);
    expect(screen.getByTestId("category-mix-comparison")).toHaveTextContent("Category comparison unavailable");
    expect(screen.queryByText(/biggest change/i)).not.toBeInTheDocument();
  });

  it("30 does not duplicate the structure charts on Explore", () => {
    renderCommandCenter("pre-reveal", "explore");
    expect(screen.queryByTestId("historical-2012-structure")).not.toBeInTheDocument();
    expect(screen.getByText("2026 Explore is waiting for publication")).toBeInTheDocument();
    const source = readFileSync(join(process.cwd(), "src/components/registry/historical-2012-structure-section.tsx"), "utf8");
    expect(source).not.toContain("registry-2012-applications.payload.json");
    expect(source).not.toContain("buildBiggestChanges");
  });
});
