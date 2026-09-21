import type { Application, ExploreFilterState } from "@/lib/registry-data";
import { historical2012ApplicationMatchesExploreQuery } from "@/historical-2012/explore-historical-table";

export type Historical2012PortfolioExploreFilters = ExploreFilterState & { sort?: string };
import type { ConfirmedPortfolioSidecarEntry } from "@/historical-2012/confirmed-portfolios-sidecar-types";

export const HISTORICAL_2012_CONFIRMED_PORTFOLIO_EXPLORE_ENTITY = "confirmed-portfolios" as const;
export const HISTORICAL_2012_APPLICANT_LEGAL_NAMES_EXPLORE_ENTITY = "applicant-legal-names" as const;

export const HISTORICAL_2012_CONFIRMED_PORTFOLIO_COLUMN_HEADERS = [
  "Organization",
  "Confirmed applications",
  "Legal applicants",
  "Regions",
  "Contention",
  "IDN",
  "Trust / source",
  "Actions",
] as const;

export function isHistorical2012ConfirmedPortfolioBrowse(
  datasetIs2012Historical: boolean,
  browseEntity: string,
): boolean {
  return datasetIs2012Historical && browseEntity === HISTORICAL_2012_CONFIRMED_PORTFOLIO_EXPLORE_ENTITY;
}

export function isHistorical2012ApplicantLegalNameBrowse(
  datasetIs2012Historical: boolean,
  browseEntity: string,
): boolean {
  return datasetIs2012Historical && browseEntity === HISTORICAL_2012_APPLICANT_LEGAL_NAMES_EXPLORE_ENTITY;
}

export type Historical2012ConfirmedPortfolioRow = {
  organizationKey: string;
  canonicalOrganizationName: string;
  portfolio: ConfirmedPortfolioSidecarEntry;
  records: Application[];
};

export function joinConfirmedPortfolioMembers(
  portfolio: ConfirmedPortfolioSidecarEntry,
  applicationsById: ReadonlyMap<string, Application>,
): Application[] {
  return portfolio.memberApplicationIds
    .map((id) => applicationsById.get(id))
    .filter((record): record is Application => Boolean(record))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function historical2012LegalApplicantsSummary(records: readonly Application[], maxShown = 2): string {
  const names = [...new Set(records.map((record) => record.applicant))].sort();
  if (names.length === 0) return "—";
  if (names.length <= maxShown) return names.join(", ");
  const shown = names.slice(0, maxShown).join(", ");
  return `${shown} · +${names.length - maxShown} more`;
}

export function historical2012PortfolioIdnSummary(records: readonly Application[]): string {
  const idnCount = records.filter((record) => record.idn).length;
  if (idnCount === 0) return "Non-IDN only";
  if (idnCount === records.length) return `${idnCount} IDN`;
  return `${idnCount} IDN · ${records.length - idnCount} non-IDN`;
}

function portfolioMatchesExploreFilters(
  row: Historical2012ConfirmedPortfolioRow,
  filters: Historical2012PortfolioExploreFilters,
): boolean {
  const { records, portfolio } = row;
  const selectedIds = new Set(filters.ids.split(",").filter(Boolean));
  if (selectedIds.size && !records.some((item) => selectedIds.has(item.id))) return false;

  if (filters.region !== "all" && !records.some((item) => item.region === filters.region)) return false;
  if (filters.contention !== "all") {
    const wantInContention = filters.contention === "in";
    if (!records.some((item) => (wantInContention ? Boolean(item.contentionSet) : !item.contentionSet))) {
      return false;
    }
  }
  if (filters.idn !== "all") {
    const wantIdn = filters.idn === "idn";
    if (!records.some((item) => (wantIdn ? item.idn : !item.idn))) return false;
  }
  if (filters.q.trim()) {
    const needle = filters.q.toLowerCase();
    if (
      portfolio.canonicalOrganizationName.toLowerCase().includes(needle)
      || portfolio.organizationKey.toLowerCase().includes(needle)
    ) {
      return true;
    }
    return records.some((item) => historical2012ApplicationMatchesExploreQuery(item, filters.q));
  }
  return true;
}

export function filterHistorical2012ConfirmedPortfolioRows(
  portfolios: readonly ConfirmedPortfolioSidecarEntry[],
  applications: readonly Application[],
  filters: Historical2012PortfolioExploreFilters,
): Historical2012ConfirmedPortfolioRow[] {
  const applicationsById = new Map(applications.map((app) => [app.id, app]));
  const rows = portfolios.map((portfolio) => {
    const records = joinConfirmedPortfolioMembers(portfolio, applicationsById);
    return {
      organizationKey: portfolio.organizationKey,
      canonicalOrganizationName: portfolio.canonicalOrganizationName,
      portfolio,
      records,
    };
  });

  return rows
    .filter((row) => portfolioMatchesExploreFilters(row, filters))
    .sort((a, b) => {
      if (filters.sort === "name-asc") {
        return a.canonicalOrganizationName.localeCompare(b.canonicalOrganizationName);
      }
      if (filters.sort === "contention-desc") {
        const aContention = a.records.filter((item) => item.contentionSet).length;
        const bContention = b.records.filter((item) => item.contentionSet).length;
        return bContention - aContention || a.canonicalOrganizationName.localeCompare(b.canonicalOrganizationName);
      }
      return b.records.length - a.records.length || a.canonicalOrganizationName.localeCompare(b.canonicalOrganizationName);
    });
}

export function confirmedMappedApplicationsInPortfolioRows(
  rows: readonly Historical2012ConfirmedPortfolioRow[],
): number {
  return rows.reduce((sum, row) => sum + row.records.length, 0);
}

