/** Pinned steward-confirmed portfolio slice — verified via `organization-promotion.test.ts` / CLI report. */
export const CONFIRMED_2012_PORTFOLIO_COUNT = 16;
export const CONFIRMED_2012_MAPPED_APPLICATION_COUNT = 466;
export const OFFLINE_2012_ORG_CANDIDATE_APPLICATIONS = 18;
export const OFFLINE_2012_ORG_CANDIDATE_ORGANIZATIONS = 2;
export const OFFLINE_2012_ORG_AMBIGUOUS_APPLICATIONS = 17;
export const OFFLINE_2012_ORG_AMBIGUOUS_ORGANIZATIONS = 1;
export const OFFLINE_2012_ORG_UNRESOLVED_APPLICATIONS = 1429;
export const OFFLINE_2012_ORG_PROMOTED_APPLICATIONS_TOTAL = 501;
export const OFFLINE_2012_ORG_PROMOTED_ORGANIZATIONS_TOTAL = 19;

export const REGISTRY_BROWSER_2012_CONFIRMED_PORTFOLIOS_VERSION =
  "registry-browser-2012-confirmed-portfolios/1.0.0";

/** Exact Explore results summary for confirmed portfolio browse (Steven-approved). */
export const HISTORICAL_2012_CONFIRMED_PORTFOLIO_RESULTS_SUMMARY =
  `${CONFIRMED_2012_PORTFOLIO_COUNT} confirmed portfolio results · ${CONFIRMED_2012_MAPPED_APPLICATION_COUNT} confirmed mapped applications`;

/** Exact coverage banner for confirmed portfolio browse (Steven-approved). */
export const HISTORICAL_2012_CONFIRMED_PORTFOLIO_COVERAGE_BANNER =
  "Partial organization coverage. This view contains 16 steward-confirmed portfolios covering 466 of 1,930 applications (24.1%). The remaining 1,464 applications are not included in the confirmed portfolio slice; some have candidate or ambiguous mappings, while 1,429 remain unresolved.";

export const HISTORICAL_2012_APPLICANT_LEGAL_NAMES_DISCLOSURE =
  "Applicant legal names from the Reveal Day CSV — not steward organization resolution. For confirmed portfolios, switch to Confirmed portfolios.";

export const HISTORICAL_2012_CONFIRMED_PORTFOLIO_TRUST_BADGE =
  "Steward confirmed · organization-promotion/1.0.0";
