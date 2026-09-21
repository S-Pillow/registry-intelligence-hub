import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH } from "@/historical-2012/approved-corpus-hash";
import { buildRegistry2012ConfirmedPortfoliosDocument } from "@/historical-2012/build-confirmed-organization-portfolios";
import {
  CONFIRMED_2012_MAPPED_APPLICATION_COUNT,
  CONFIRMED_2012_PORTFOLIO_COUNT,
} from "@/historical-2012/confirmed-portfolios-constants";
import { isRegistry2012ConfirmedPortfoliosDocument } from "@/historical-2012/confirmed-portfolios-sidecar-document";
import { resolveConfirmedPortfoliosSidecar } from "@/historical-2012/confirmed-portfolios-sidecar-shared";
import { parse2012ApplicationPayloadJson } from "@/historical-2012/payload-server";
import { filterHistorical2012ConfirmedPortfolioRows } from "@/historical-2012/explore-historical-organizations";
import { exploreFiltersFor2012Historical } from "@/historical-2012/explore-historical-table";

const workspaceRoot = join(import.meta.dirname, "..", "..");

describe("confirmed organization portfolios sidecar (D2.4)", () => {
  it("builds pinned steward-confirmed portfolio slice from promotion registry", async () => {
    const document = await buildRegistry2012ConfirmedPortfoliosDocument(workspaceRoot);
    expect(document.confirmedPortfolioCount).toBe(CONFIRMED_2012_PORTFOLIO_COUNT);
    expect(document.confirmedMappedApplicationCount).toBe(CONFIRMED_2012_MAPPED_APPLICATION_COUNT);
    expect(document.baseApplicationPayloadCorpusContentHash).toBe(APPROVED_2012_BROWSER_CORPUS_CONTENT_HASH);
    expect(document.portfolios).toHaveLength(CONFIRMED_2012_PORTFOLIO_COUNT);
    expect(document.portfolios.every((row) => row.promotionState === "CONFIRMED")).toBe(true);
    const mapped = document.portfolios.reduce((sum, row) => sum + row.memberApplicationIds.length, 0);
    expect(mapped).toBe(CONFIRMED_2012_MAPPED_APPLICATION_COUNT);
  });

  it("loads committed fixture and resolves against base application payload", async () => {
    const sidecarText = await readFile(
      join(workspaceRoot, "src/data/fixtures/registry-2012-confirmed-organizations.payload.json"),
      "utf8",
    );
    const sidecar = JSON.parse(sidecarText);
    expect(isRegistry2012ConfirmedPortfoliosDocument(sidecar)).toBe(true);

    const payloadText = await readFile(
      join(workspaceRoot, "src/data/fixtures/registry-2012-applications.payload.json"),
      "utf8",
    );
    const payload = parse2012ApplicationPayloadJson(payloadText);
    const resolution = resolveConfirmedPortfoliosSidecar(sidecar, payload);
    expect(resolution.status).toBe("loaded");
  });

  it("fail-closes when sidecar base corpus hash disagrees with application payload", async () => {
    const document = await buildRegistry2012ConfirmedPortfoliosDocument(workspaceRoot);
    const payloadText = await readFile(
      join(workspaceRoot, "src/data/fixtures/registry-2012-applications.payload.json"),
      "utf8",
    );
    const payload = parse2012ApplicationPayloadJson(payloadText);
    const badSidecar = {
      ...document,
      baseApplicationPayloadCorpusContentHash: "deadbeef",
    };
    const resolution = resolveConfirmedPortfoliosSidecar(badSidecar, payload);
    expect(resolution.status).toBe("not-loaded");
    expect(resolution.reason).toBe("base-corpus-hash-mismatch");
  });

  it("filters 16 portfolio rows from sidecar without candidate or ambiguous ops", async () => {
    const sidecarText = await readFile(
      join(workspaceRoot, "src/data/fixtures/registry-2012-confirmed-organizations.payload.json"),
      "utf8",
    );
    const sidecar = JSON.parse(sidecarText);
    const payloadText = await readFile(
      join(workspaceRoot, "src/data/fixtures/registry-2012-applications.payload.json"),
      "utf8",
    );
    const payload = parse2012ApplicationPayloadJson(payloadText);
    const filters = exploreFiltersFor2012Historical(
      {
        q: "",
        category: "all",
        region: "all",
        status: "all",
        contention: "all",
        idn: "all",
        ids: "",
        sort: "applications-desc",
      },
      { browseEntity: "confirmed-portfolios" },
    );
    const rows = filterHistorical2012ConfirmedPortfolioRows(sidecar.portfolios, payload.applications, filters);
    expect(rows).toHaveLength(CONFIRMED_2012_PORTFOLIO_COUNT);
    expect(rows.some((row) => row.organizationKey === "gmo")).toBe(false);
    expect(rows.some((row) => row.organizationKey === "fiat-chrysler")).toBe(false);
  });
});
