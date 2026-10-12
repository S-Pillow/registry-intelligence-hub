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
  });
});
