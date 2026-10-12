// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HistoricalCohortContent } from "@/components/registry/historical-cohort-content";
import type { Registry2012ApplicationsDocument } from "@/historical-2012/browser-payload-document";
import { buildHistoricalApplicantPortfolioCohorts } from "@/lib/historical-cohort-intelligence";

afterEach(() => cleanup());

const payload = JSON.parse(
  readFileSync(join(process.cwd(), "src/data/fixtures/registry-2012-applications.payload.json"), "utf8"),
) as Registry2012ApplicationsDocument;
const intelligence = buildHistoricalApplicantPortfolioCohorts(payload.applications);

describe("HistoricalCohortContent", () => {
  it("renders 2012-only portfolio structure with pinned facts", () => {
    render(<HistoricalCohortContent intelligence={intelligence} />);

    expect(screen.getByTestId("historical-cohorts-page")).toBeInTheDocument();
    expect(screen.getByTestId("cohort-year-badge")).toHaveTextContent(/2012 only/i);
    expect(screen.getByTestId("cohort-title")).toHaveTextContent("2012 Applicant portfolio structure");
    expect(screen.getByTestId("cohort-app-denominator")).toHaveTextContent("1,930");
    expect(screen.getByTestId("cohort-applicant-denominator")).toHaveTextContent("1,154");

    expect(screen.getByTestId("cohort-band-1-apps")).toHaveTextContent("964");
    expect(screen.getByTestId("cohort-band-25+-apps")).toHaveTextContent("353");
    expect(screen.getByTestId("cohort-primary-story")).toHaveTextContent(/about half/i);
    expect(screen.getByTestId("cohort-one-off-apps")).toHaveTextContent("964");
    expect(screen.getByTestId("cohort-multi-apps")).toHaveTextContent("966");

    expect(screen.getByTestId("cohort-concentration-top-5-apps")).toHaveTextContent("327");
    expect(screen.getByTestId("cohort-concentration-top-50-apps")).toHaveTextContent("643");
    expect(screen.getByTestId("cohort-concentration")).toHaveTextContent(/not economic market share/i);

    const charleston = screen.getByTestId("cohort-largest-1");
    expect(charleston).toHaveAttribute("data-applicant-legal-name", "Charleston Road Registry Inc.");
    expect(within(charleston).getByTestId("cohort-largest-1-apps")).toHaveTextContent("101");

    const largestSection = screen.getByTestId("cohort-largest");
    const afilias = within(largestSection).getByText("Afilias Limited").closest("tr")!;
    const united = within(largestSection).getByText("United TLD Holdco Ltd.").closest("tr")!;
    expect(within(afilias).getByText("26")).toBeInTheDocument();
    expect(within(united).getByText("26")).toBeInTheDocument();

    expect(screen.getByTestId("cohort-explore-1")).toHaveAttribute(
      "href",
      expect.stringContaining("dataset=2012-historical"),
    );
    expect(screen.getByTestId("cohort-explore-1").getAttribute("href")).not.toContain("/applicant?");
    expect(screen.getByTestId("cohort-methodology")).toHaveTextContent(/Applicant legal name/i);
    expect(screen.getByTestId("cohort-exclusions")).toHaveTextContent(/Preliminary contention/i);
    expect(screen.queryByText(/market dominance/i)).not.toBeInTheDocument();

    expect(screen.getByTestId("cohort-exact-string")).toBeInTheDocument();
    expect(screen.getByTestId("cohort-exact-string-applicants")).toHaveTextContent("452");
    expect(screen.getByTestId("cohort-exact-string-apps")).toHaveTextContent("751");
    expect(screen.getByTestId("cohort-exact-string-groups")).toHaveTextContent("230");
    expect(screen.getByTestId("cohort-exact-string-groups")).toHaveTextContent(/Not official contention sets/i);
    expect(screen.getByTestId("cohort-exact-string-contention-note")).toHaveTextContent(/748/);
    expect(screen.getByTestId("cohort-exact-string-contention-note")).toHaveTextContent(
      /keeps the two historical concepts separate/i,
    );

    const charlestonExact = screen.getByTestId("cohort-exact-string-row-1");
    expect(charlestonExact).toHaveAttribute(
      "data-applicant-legal-name",
      "Charleston Road Registry Inc.",
    );
    expect(screen.getByTestId("cohort-exact-string-exposed-1")).toHaveTextContent("58");
    const exactSection = screen.getByTestId("cohort-exact-string");
    expect(within(exactSection).getByText("NU DOT CO LLC").closest("tr")).toHaveTextContent("13");
    expect(screen.getByTestId("cohort-exact-string-explore-1")).toHaveAttribute(
      "href",
      expect.stringContaining("dataset=2012-historical"),
    );
    expect(exactSection).not.toHaveTextContent(/official contention memberships/i);

    // HIST-COHORT-2B — after exact-string
    const pageHtml = screen.getByTestId("historical-cohorts-page").innerHTML;
    expect(pageHtml.indexOf('data-testid="cohort-exact-string"')).toBeLessThan(
      pageHtml.indexOf('data-testid="cohort-regional"'),
    );
    expect(pageHtml.indexOf('data-testid="cohort-bands"')).toBeLessThan(
      pageHtml.indexOf('data-testid="cohort-exact-string"'),
    );

    expect(screen.getByRole("heading", { name: "2012 Applicant regional structure" })).toBeInTheDocument();
    expect(screen.getByTestId("cohort-regional")).toHaveAttribute("id", "regional-applicant-structure");
    expect(screen.getByTestId("cohort-header-regional")).toHaveAttribute(
      "href",
      "#regional-applicant-structure",
    );
    expect(screen.getByTestId("cohort-regional-table").querySelectorAll("tbody tr")).toHaveLength(5);
    expect(screen.getByTestId("cohort-regional-code-NA")).toHaveTextContent("NA");
    expect(screen.getByTestId("cohort-regional-applicants-NA")).toHaveTextContent("606");
    expect(screen.getByTestId("cohort-regional-apps-NA")).toHaveTextContent("911");
    expect(screen.getByTestId("cohort-regional-applicant-share-NA")).toHaveTextContent("52.51%");
    expect(screen.getByTestId("cohort-regional-app-share-NA")).toHaveTextContent("47.20%");
    expect(screen.getByTestId("cohort-regional-applicants-EUR")).toHaveTextContent("304");
    expect(screen.getByTestId("cohort-regional-apps-EUR")).toHaveTextContent("675");
    expect(screen.getByTestId("cohort-regional-applicant-share-EUR")).toHaveTextContent("26.34%");
    expect(screen.getByTestId("cohort-regional-app-share-EUR")).toHaveTextContent("34.97%");
    expect(screen.getByTestId("cohort-regional-applicants-AP")).toHaveTextContent("220");
    expect(screen.getByTestId("cohort-regional-apps-AP")).toHaveTextContent("303");
    expect(screen.getByTestId("cohort-regional-footer")).toHaveTextContent(/1,154 Applicant legal names/);
    expect(screen.getByTestId("cohort-regional-footer")).toHaveTextContent(/1,930 Applications/);
    expect(screen.getByTestId("cohort-regional-methodology")).toHaveTextContent(
      /not the Geographic Application designation/i,
    );
    expect(screen.getByTestId("cohort-regional")).toHaveTextContent(/not a market/i);
    expect(screen.getByTestId("cohort-regional")).not.toHaveTextContent(
      /North American market|European market|Asia-Pacific market|regional market/i,
    );
    expect(screen.getByTestId("cohort-regional")).not.toHaveTextContent(/2012→2026|vs 2026/i);
    expect(screen.getByTestId("cohort-regional-explore-NA")).toHaveAttribute(
      "href",
      "/explore?dataset=2012-historical&entity=applications&region=NA",
    );
    expect(screen.getByTestId("cohort-regional-explore-EUR")).toHaveAttribute(
      "href",
      "/explore?dataset=2012-historical&entity=applications&region=EUR",
    );
    expect(screen.getByTestId("cohort-regional-explore-AP").getAttribute("href")).not.toMatch(
      /^https?:\/\//,
    );
  });
});
