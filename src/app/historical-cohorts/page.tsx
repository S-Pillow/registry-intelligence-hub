import type { Metadata } from "next";
import { HistoricalCohortContent } from "@/components/registry/historical-cohort-content";
import { loadCommitted2012ApplicationPayload } from "@/historical-2012/payload-server";
import { buildHistoricalApplicantPortfolioCohorts } from "@/lib/historical-cohort-intelligence";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "2012 Applicant portfolio structure",
};

/**
 * HIST-COHORT-1 — server-derives aggregates from the committed 2012 fixture.
 * The client receives bands / concentration / top-N only — never the 1930-row corpus.
 */
export default async function HistoricalCohortsPage() {
  const document = await loadCommitted2012ApplicationPayload();
  const intelligence = buildHistoricalApplicantPortfolioCohorts(document.applications);
  return <HistoricalCohortContent intelligence={intelligence} />;
}
