/** Pinned steward-confirmed portfolio slice — verified via `organization-promotion.test.ts` / CLI report. */
export const CONFIRMED_2012_PORTFOLIO_COUNT = 17;
export const CONFIRMED_2012_MAPPED_APPLICATION_COUNT = 467;
export const OFFLINE_2012_ORG_CANDIDATE_APPLICATIONS = 18;
export const OFFLINE_2012_ORG_CANDIDATE_ORGANIZATIONS = 2;
export const OFFLINE_2012_ORG_AMBIGUOUS_APPLICATIONS = 17;
export const OFFLINE_2012_ORG_AMBIGUOUS_ORGANIZATIONS = 1;
export const OFFLINE_2012_ORG_UNRESOLVED_APPLICATIONS = 1428;
export const OFFLINE_2012_ORG_PROMOTED_APPLICATIONS_TOTAL = 502;
export const OFFLINE_2012_ORG_PROMOTED_ORGANIZATIONS_TOTAL = 20;

export const REGISTRY_BROWSER_2012_CONFIRMED_PORTFOLIOS_VERSION =
  "registry-browser-2012-confirmed-portfolios/1.0.0";

/** Exact Explore results summary for confirmed portfolio browse (Steven-approved). */
export const HISTORICAL_2012_CONFIRMED_PORTFOLIO_RESULTS_SUMMARY =
  `${CONFIRMED_2012_PORTFOLIO_COUNT} confirmed portfolio results · ${CONFIRMED_2012_MAPPED_APPLICATION_COUNT} confirmed mapped applications`;

/** Exact coverage banner for confirmed portfolio browse (Steven-approved). */
export const HISTORICAL_2012_CONFIRMED_PORTFOLIO_COVERAGE_BANNER =
  "Partial organization coverage. This view contains 17 steward-confirmed portfolios covering 467 of 1,930 applications (24.2%). The remaining 1,463 applications are not included in the confirmed portfolio slice; some have candidate or ambiguous mappings, while 1,428 remain unresolved.";

export const HISTORICAL_2012_APPLICANT_LEGAL_NAMES_DISCLOSURE =
  "Applicant legal names from the Reveal Day CSV — not steward organization resolution. For confirmed portfolios, switch to Confirmed portfolios.";

export const HISTORICAL_2012_APPLICANT_FIELD_DISCLOSURE =
  "Applicant legal name is the Reveal Day CSV field. It is not resolved organization ownership. Confirmed organizations come only from the steward-confirmed portfolio sidecar; every other application stays unresolved.";

export const HISTORICAL_2012_CONFIRMED_PORTFOLIO_TRUST_BADGE =
  "Steward confirmed · organization-promotion/1.0.0";

/** Intelligence drawer classification for steward-confirmed portfolio rows (D2.4B). */
export const HISTORICAL_2012_CONFIRMED_PORTFOLIO_DRAWER_CLASSIFICATION =
  "Steward-confirmed historical portfolio";

/** Drawer copy — CSV/browser payload provenance is for member applications only. */
export const HISTORICAL_2012_CONFIRMED_PORTFOLIO_MEMBER_APPLICATION_PROVENANCE_NOTE =
  "Reveal Day CSV browser payload — member application string, applicant, region, and application ID. Does not establish steward-confirmed portfolio identity.";
