// @vitest-environment happy-dom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HubClaimActualityProvider } from "@/components/registry/hub-claim-actuality-provider";
import { HubRegistryDataProvider } from "@/components/registry/hub-registry-data-provider";
import { CommandCenter } from "@/components/registry/command-center";
import { presentPromotedCrossRoundCount } from "@/comparison/cross-round-count-comparison";
import {
  APPLICATION_PAYLOAD_JSON_ENV,
  APPLICATION_PAYLOAD_PATH_ENV,
  loadConfiguredApplicationPayload,
} from "@/lib/registry-application-payload-server";
import {
  CLAIM_ACTUALITY_STATE_PATH_ENV,
  loadPromotedClaimActualityState,
} from "@/lib/claim-actuality-server";
import { buildDataHealthSnapshot } from "@/lib/data-health-report";
import { describeBriefingScope, generateEditionContent } from "@/lib/briefing-data";
import { loadHubRegistryData } from "@/lib/hub-registry-data-server";
import { resolveHubMetricEligibility } from "@/lib/hub-metric-eligibility";
import {
  buildApplicantLegalNameConcentration,
  buildExactAppliedStringCompetition,
  listEntityOptions,
} from "@/lib/registry-data";
import {
  claimActualityAssertedForBrowser,
  rehearsalRegistryApplicationsDocument,
  resolveActiveRegistryApplicationsDocument,
  type RegistryApplicationsDocument,
} from "@/lib/registry-application-payload-shared";
import { DEFAULT_CLAIM_ACTUALITY_STATE } from "@/reveal-day-2026/claim-actuality";
import syntheticPayload from "@/data/fixtures/synthetic-promote-1-not-a-publication.payload.json";

const SYNTHETIC = syntheticPayload as RegistryApplicationsDocument;
const BLOCKED_METRIC_IDS = [
  "organization-round-count",
  "portfolio-concentration-round-wide",
  "category-mix",
  "distinct-regions",
  "contention-set-count",
  "contention-membership-exposure",
  "historical-market-demand",
] as const;

const BROWSER_SURFACES = [
  "src/app/layout.tsx",
  "src/components/registry/command-center.tsx",
  "src/components/registry/saved-content.tsx",
  "src/components/registry/briefing-content.tsx",
  "src/components/registry/data-health-content.tsx",
];

function matchingClaim() {
  return {
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
}

function withEnv(name: string, value: string | undefined, run: () => Promise<void>) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  return run().finally(() => {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  });
}

afterEach(() => {
  cleanup();
});

describe("promoted 2026 application snapshot consumption", () => {
  it("1 — default rehearsal mode stays the 12-row fixture and NOT_PUBLISHED", () => {
    const resolution = resolveActiveRegistryApplicationsDocument(DEFAULT_CLAIM_ACTUALITY_STATE, null);
    const asserted = claimActualityAssertedForBrowser(DEFAULT_CLAIM_ACTUALITY_STATE, resolution);
    expect(resolution.mode).toBe("rehearsal");
    expect(resolution.document.applications).toHaveLength(12);
    expect(resolution.document.applications[0]?.id).toBe("APP-26001");
    expect(resolution.document.payloadMode).toBe("rehearsal");
    expect(asserted.round2026ApplicationActuality).toBe("NOT_PUBLISHED");
    expect(resolveHubMetricEligibility("application-count", asserted)?.comparisonAllowed).toBe(false);
    expect(presentPromotedCrossRoundCount("application-count", resolution.document.applications, asserted, {
      payloadMode: resolution.mode,
      snapshotId: resolution.document.snapshotId,
    })).toBeNull();
  });

  it("2 — a matching synthetic payload switches the active application population", async () => {
    const claim = matchingClaim();
    await withEnv(APPLICATION_PAYLOAD_JSON_ENV, undefined, () =>
      withEnv(APPLICATION_PAYLOAD_PATH_ENV, "src/data/fixtures/synthetic-promote-1-not-a-publication.payload.json", async () => {
        const resolution = await loadHubRegistryData(claim);
        expect(resolution.selectionReason).toBe("promoted-active");
        expect(resolution.mode).toBe("promoted-2026");
        expect(resolution.document.snapshotId).toBe("snap-synthetic-promote-1-not-a-publication");
        expect(resolution.document.applications.map((row) => row.id)).toEqual([
          "SYNTH-NOT-A-PUBLICATION-001",
          "SYNTH-NOT-A-PUBLICATION-002",
          "SYNTH-NOT-A-PUBLICATION-003",
        ]);
        expect(claimActualityAssertedForBrowser(claim, resolution).round2026ApplicationActuality).toBe("REAL_SOURCE_READY");
      }),
    );
  });

  it("3 — a configured payload path that cannot be read fails closed", async () => {
    await withEnv(APPLICATION_PAYLOAD_JSON_ENV, undefined, () =>
      withEnv(APPLICATION_PAYLOAD_PATH_ENV, "src/data/fixtures/missing-synthetic-promote-1.json", async () => {
        await expect(loadConfiguredApplicationPayload()).rejects.toThrow(/could not be read/);
      }),
    );
  });

  it("4 — malformed payload JSON fails closed", async () => {
    await withEnv(APPLICATION_PAYLOAD_JSON_ENV, "{not-json", async () => {
      await expect(loadConfiguredApplicationPayload()).rejects.toThrow();
    });
  });

  it("5 — promotion or actuality absent keeps rehearsal rows and does not assert publication", () => {
    const resolution = resolveActiveRegistryApplicationsDocument(DEFAULT_CLAIM_ACTUALITY_STATE, SYNTHETIC);
    const asserted = claimActualityAssertedForBrowser(DEFAULT_CLAIM_ACTUALITY_STATE, resolution);
    expect(resolution.selectionReason).toBe("claim-not-promoted");
    expect(resolution.mode).toBe("rehearsal");
    expect(resolution.document.applications).toHaveLength(12);
    expect(asserted.round2026ApplicationActuality).toBe("NOT_PUBLISHED");
    expect(resolution.document.applications.some((row) => row.id.startsWith("SYNTH-"))).toBe(false);
  });

  it("5b — a configured claim-state path that cannot be read fails closed", async () => {
    await withEnv(CLAIM_ACTUALITY_STATE_PATH_ENV, "src/data/fixtures/missing-claim-actuality.json", async () => {
      await expect(loadPromotedClaimActualityState()).rejects.toThrow(/could not be read/);
    });
  });

  it("6-8 — application, unique-string, and IDN counts recompute from loaded rows", () => {
    const claim = matchingClaim();
    const resolution = resolveActiveRegistryApplicationsDocument(claim, SYNTHETIC);
    const asserted = claimActualityAssertedForBrowser(claim, resolution);
    const apps = resolution.document.applications;
    const applications = presentPromotedCrossRoundCount("application-count", apps, asserted, {
      payloadMode: resolution.mode,
      snapshotId: resolution.document.snapshotId,
    });
    const strings = presentPromotedCrossRoundCount("unique-applied-strings", apps, asserted, {
      payloadMode: resolution.mode,
      snapshotId: resolution.document.snapshotId,
    });
    const idn = presentPromotedCrossRoundCount("idn-applications", apps, asserted, {
      payloadMode: resolution.mode,
      snapshotId: resolution.document.snapshotId,
    });
    expect(applications?.active2026).toBe(3);
    expect(applications?.baseline2012).toBe(1930);
    expect(strings?.active2026).toBe(2);
    expect(strings?.baseline2012).toBe(1409);
    expect(idn?.active2026).toBe(1);
    expect(idn?.baseline2012).toBe(116);
    expect(applications?.numericDelta).toBe(true);
  });

  it("9 — applicant legal-name concentration recomputes and stays legal-name grain", () => {
    const concentration = buildApplicantLegalNameConcentration(SYNTHETIC.applications);
    expect(concentration.distinctApplicantLegalNames).toBe(2);
    expect(concentration.ranked[0]).toMatchObject({ applicantLegalName: "Synthetic Legal Name Alpha", count: 2 });
    expect(concentration.ranked[1]).toMatchObject({ applicantLegalName: "Synthetic Legal Name Beta", count: 1 });
    expect(concentration.method).toBe("applicant-legal-name-count/1.0.0");
  });

  it("10 — exact applied-for string groups recompute and are not contention sets", () => {
    const competition = buildExactAppliedStringCompetition(SYNTHETIC.applications);
    expect(competition.grain).toBe("exact-applied-for-string");
    expect(competition.competingGroupCount).toBe(1);
    expect(competition.competingGroups[0]).toMatchObject({
      appliedForString: "synthetic-not-a-2026-publication-alpha",
      applicationCount: 2,
    });
    expect(SYNTHETIC.applications.every((row) => row.contentionSet === null)).toBe(true);
  });

  it("11-12 — Explore and Compare options use the same promoted population", () => {
    const resolution = resolveActiveRegistryApplicationsDocument(matchingClaim(), SYNTHETIC);
    expect(resolution.document.applications).toHaveLength(3);
    const organizations = listEntityOptions("organizations", resolution.document.applications);
    expect(organizations.map((option) => option.key).sort()).toEqual([
      "Synthetic Org Label Alpha",
      "Synthetic Org Label Beta",
    ]);
    expect(organizations.some((option) => option.key === "Atlas Digital")).toBe(false);
  });

  it("13 — blocked comparison metrics stay blocked after a valid promotion", () => {
    const asserted = claimActualityAssertedForBrowser(
      matchingClaim(),
      resolveActiveRegistryApplicationsDocument(matchingClaim(), SYNTHETIC),
    );
    for (const metricId of BLOCKED_METRIC_IDS) {
      const resolved = resolveHubMetricEligibility(metricId, asserted);
      expect(resolved?.comparisonAllowed).toBe(false);
    }
    expect(resolveHubMetricEligibility("application-count", asserted)?.comparisonAllowed).toBe(true);
    expect(resolveHubMetricEligibility("unique-applied-strings", asserted)?.comparisonAllowed).toBe(true);
    expect(resolveHubMetricEligibility("idn-applications", asserted)?.comparisonAllowed).toBe(true);
  });

  it("14-15 — Data Health and provenance follow the active snapshot, and a pin mismatch does not look published", () => {
    const claim = matchingClaim();
    const active = resolveActiveRegistryApplicationsDocument(claim, SYNTHETIC);
    const promotedHealth = buildDataHealthSnapshot(claim, active);
    expect(promotedHealth.browserDataState.browserEntityDataset).toMatch(/3-record promoted 2026/);
    expect(promotedHealth.browserDataState.browserEntityDataset).toContain("synthetic-promote-1-not-a-publication");
    expect(promotedHealth.browserDataState.real2026Publication).toBe("REAL_SOURCE_READY");
    expect(promotedHealth.publicationReadiness.browserPayloadSelectionReason).toBe("promoted-active");
    expect(promotedHealth.currentStateSummary.find((row) => row.id === "2026-publication")?.primary).toMatch(/promoted/i);

    const rejected = resolveActiveRegistryApplicationsDocument(
      { ...claim, snapshotContentHash: "wrong-pin" },
      SYNTHETIC,
    );
    const rejectedHealth = buildDataHealthSnapshot(claim, rejected);
    expect(rejected.mode).toBe("rehearsal");
    expect(rejected.document.snapshotId).toBe(rehearsalRegistryApplicationsDocument().snapshotId);
    expect(claimActualityAssertedForBrowser(claim, rejected).round2026ApplicationActuality).toBe("NOT_PUBLISHED");
    expect(rejectedHealth.browserDataState.real2026Publication).toMatch(/Not published/);
    expect(rejectedHealth.browserDataState.real2026Publication).toMatch(/rejected/);
    expect(rejectedHealth.currentStateSummary.find((row) => row.id === "2026-publication")?.primary).not.toMatch(/Real 2026/);
    expect(rejectedHealth.intelligenceReadiness.find((row) => row.metricId === "application-count")?.comparisonAllowed).toBe(false);
    expect(rejectedHealth.publicationReadiness.checklist.find((item) => item.id === "browser-payload")?.status).toBe("warning");
  });

  it("16-18 — briefings use the active snapshot, round-wide stand-outs stay empty, and retired findings stay out", () => {
    const claim = matchingClaim();
    const resolution = resolveActiveRegistryApplicationsDocument(claim, SYNTHETIC);
    const edition = generateEditionContent({
      scope: { kind: "round-wide" },
      emphasis: "all",
      detailLevel: "standard",
      sectionsWanted: ["headline-metrics", "what-stands-out", "limitations"],
      claimActualityState: claimActualityAssertedForBrowser(claim, resolution),
      registryDocument: resolution.document,
    });
    expect(edition.snapshotId).toBe("snap-synthetic-promote-1-not-a-publication");
    const standout = edition.sections.find((section) => section.id === "what-stands-out");
    expect(standout?.claims).toEqual([]);
    const serialized = edition.sections.flatMap((section) => section.claims.map((claimRow) => claimRow.text)).join("\n");
    expect(serialized).not.toMatch(/what you should know/i);
    expect(serialized).toContain("Applications: 3");
    expect(serialized).toContain("Unique strings: 2");
    expect(serialized).toContain("IDN applications: 1");
    expect(serialized).not.toContain("APP-26001");
    expect(describeBriefingScope({ kind: "round-wide" }, resolution.document)).toMatch(/active promoted application snapshot/);
  });

  it("renders Explore and Compare from the promoted snapshot without rehearsal rows", () => {
    const claim = matchingClaim();
    const resolution = resolveActiveRegistryApplicationsDocument(claim, SYNTHETIC);
    const asserted = claimActualityAssertedForBrowser(claim, resolution);
    render(
      <HubClaimActualityProvider claimActualityState={asserted}>
        <HubRegistryDataProvider resolution={resolution}>
          <CommandCenter view="explore" />
        </HubRegistryDataProvider>
      </HubClaimActualityProvider>,
    );
    expect(screen.getAllByText(/synthetic-not-a-2026-publication-alpha/).length).toBeGreaterThan(0);
    expect(screen.getByText("Promoted 2026 application snapshot")).toBeInTheDocument();
    expect(screen.queryByText("APP-26001")).not.toBeInTheDocument();
    cleanup();

    render(
      <HubClaimActualityProvider claimActualityState={asserted}>
        <HubRegistryDataProvider resolution={resolution}>
          <CommandCenter
            view="compare"
            compareParams={{ type: "organizations", ids: "Synthetic Org Label Alpha,Synthetic Org Label Beta" }}
          />
        </HubRegistryDataProvider>
      </HubClaimActualityProvider>,
    );
    expect(screen.getByText("Promoted snapshot comparison.")).toBeInTheDocument();
    expect(screen.getAllByText("Synthetic Org Label Alpha").length).toBeGreaterThan(0);
    expect(screen.queryByText("Atlas Digital")).not.toBeInTheDocument();
  });

  it("does not let browser surfaces hardwire the rehearsal fixture", () => {
    for (const relativePath of BROWSER_SURFACES) {
      const source = readFileSync(join(process.cwd(), relativePath), "utf8");
      expect(source).not.toContain("registry-applications.json");
    }
    const briefing = readFileSync(join(process.cwd(), "src/components/registry/briefing-content.tsx"), "utf8");
    expect(briefing).toContain("listEntityOptions(entityType, registryDocument.applications)");
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toContain("claimActualityAssertedForBrowser");
    const identity = readFileSync(join(process.cwd(), "src/cross-round-identity/method-1.0.0.ts"), "utf8");
    expect(identity).toContain("registry-applications.json");
  });
});
