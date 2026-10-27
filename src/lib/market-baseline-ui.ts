/** Serializable Registry Market UI models — publication facts only. */

export type RegistryMarketOverviewStatus =
  | "READY"
  | "PUBLICATION_ABSENT"
  | "PUBLICATION_INVALID";

export type RegistryMarketDetailStatus =
  | "READY"
  | "PUBLICATION_ABSENT"
  | "PUBLICATION_INVALID"
  | "TLD_NOT_FOUND"
  | "TLD_SHARD_INVALID"
  | "MISSING_CURRENT_REPORT";

export type OptionalMetricView = {
  available: boolean;
  value: number | null;
  reason: string | null;
};

export type RegistryMarketRankingRow = {
  rank: number;
  tldAsciiLabel: string;
  displayLabel: string;
  href: string;
  totalDomains: number;
  monthOverMonthGrowth: OptionalMetricView | null;
};

export type RegistryMarketGrowthRankingRow = {
  rank: number;
  tldAsciiLabel: string;
  displayLabel: string;
  href: string;
  monthOverMonthGrowth: number;
  totalDomains: number;
};

export type RegistryMarketCurrentRow = {
  tldAsciiLabel: string;
  displayLabel: string;
  href: string;
  availability: "AVAILABLE" | "MISSING";
  dataStateLabel: "Available" | "Report unavailable";
  totalDomains: number | null;
  monthOverMonthGrowth: OptionalMetricView | null;
  yearOverYearGrowth: OptionalMetricView | null;
  registrarBreadth: number | null;
  topRegistrarShare: OptionalMetricView | null;
};

export type RegistryMarketOverviewModel = {
  status: RegistryMarketOverviewStatus;
  userMessage: string;
  sourceReportingPeriod: string | null;
  sourcePeriodLabel: string | null;
  sourceSystemLabel: string;
  publicationContentSha256: string | null;
  publicationShaShort: string | null;
  coverage: {
    tldCountInPublication: number;
    availableAtSourcePeriod: number;
    missingAtSourcePeriod: number;
  } | null;
  domainBaseRanking: RegistryMarketRankingRow[];
  monthOverMonthGrowthRanking: RegistryMarketGrowthRankingRow[];
  currentPeriodRows: RegistryMarketCurrentRow[];
};

export type RegistryMarketHistoryRow = {
  reportingPeriod: string;
  periodLabel: string;
  availability: "AVAILABLE" | "MISSING";
  dataStateLabel: "Available" | "Report unavailable";
  totalDomains: number | null;
  monthOverMonthGrowth: OptionalMetricView | null;
  yearOverYearGrowth: OptionalMetricView | null;
  netAddsCount: number | null;
  deleteCount: number | null;
  registrarBreadth: number | null;
};

export type RegistryMarketRegistrarRow = {
  registrarName: string;
  ianaRegistrarId: string;
  totalDomains: number;
  shareOfTldTotal: OptionalMetricView;
};

export type RegistryMarketProvenanceView = {
  sourceSystem: string;
  reportingPeriod: string;
  sourceUrl: string;
  rawSha256: string;
  rawShaShort: string;
  normalizedContentSha256: string;
  normalizedShaShort: string;
  publicationContentSha256: string;
  publicationShaShort: string;
};

export type RegistryMarketDetailModel = {
  status: RegistryMarketDetailStatus;
  userMessage: string;
  tldAsciiLabel: string | null;
  displayLabel: string | null;
  sourceReportingPeriod: string | null;
  sourcePeriodLabel: string | null;
  sourceSystemLabel: string;
  publicationContentSha256: string | null;
  dataStateLabel: "Available" | "Report unavailable" | null;
  currentAvailability: "AVAILABLE" | "MISSING" | null;
  metrics: {
    totalDomains: number | null;
    monthOverMonthGrowth: OptionalMetricView | null;
    yearOverYearGrowth: OptionalMetricView | null;
    registrarBreadth: number | null;
    topRegistrarShare: OptionalMetricView | null;
    top5RegistrarShare: OptionalMetricView | null;
    accreditedRegistrarDomains: number | null;
    specialOrSystemDomains: number | null;
    netAddsCount: number | null;
    netRenewCount: number | null;
    deleteCount: number | null;
    transferGainingCount: number | null;
    transferLosingCount: number | null;
  } | null;
  historyRows: RegistryMarketHistoryRow[];
  historyNote: string | null;
  topAccreditedRegistrars: RegistryMarketRegistrarRow[];
  specialSystemNote: string | null;
  provenance: RegistryMarketProvenanceView | null;
};

export const REGISTRY_MARKET_SOURCE_SYSTEM_LABEL =
  "ICANN Monthly Registry Reports — Transactions";

export const DATA_METHODOLOGY_HREF = "/data-health";

export function formatTldDisplayLabel(tldAsciiLabel: string): string {
  return `.${tldAsciiLabel}`;
}

export function marketTldHref(tldAsciiLabel: string): string {
  return `/market/${encodeURIComponent(tldAsciiLabel)}`;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Format YYYY-MM as "June 2026". */
export function formatReportingPeriodLabel(period: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return period;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return period;
  return `${MONTH_NAMES[month - 1]} ${m[1]}`;
}

export function shortenSha(sha: string, head = 12): string {
  if (sha.length <= head) return sha;
  return `${sha.slice(0, head)}…`;
}

export function optionalMetricView(
  metric: { available: boolean; value?: number; reason?: string } | null | undefined,
): OptionalMetricView | null {
  if (!metric) return null;
  if (metric.available) {
    return { available: true, value: metric.value ?? null, reason: null };
  }
  return {
    available: false,
    value: null,
    reason: metric.reason ?? "unavailable",
  };
}

export function formatOptionalMetric(
  metric: OptionalMetricView | null | undefined,
  opts?: { percent?: boolean; digits?: number },
): string {
  if (!metric) return "—";
  if (!metric.available || metric.value === null) return "Unavailable";
  if (opts?.percent) {
    const digits = opts.digits ?? 2;
    return `${(metric.value * 100).toFixed(digits)}%`;
  }
  return formatInteger(metric.value);
}

export function formatInteger(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatGrowthRatio(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function absentOverviewModel(message?: string): RegistryMarketOverviewModel {
  return {
    status: "PUBLICATION_ABSENT",
    userMessage:
      message
      ?? "Registry Market unavailable. The accepted market publication is not available in this runtime.",
    sourceReportingPeriod: null,
    sourcePeriodLabel: null,
    sourceSystemLabel: REGISTRY_MARKET_SOURCE_SYSTEM_LABEL,
    publicationContentSha256: null,
    publicationShaShort: null,
    coverage: null,
    domainBaseRanking: [],
    monthOverMonthGrowthRanking: [],
    currentPeriodRows: [],
  };
}

export function invalidOverviewModel(message?: string): RegistryMarketOverviewModel {
  return {
    ...absentOverviewModel(
      message
        ?? "Registry Market unavailable. The market publication failed integrity verification.",
    ),
    status: "PUBLICATION_INVALID",
  };
}

export function absentDetailModel(message?: string): RegistryMarketDetailModel {
  return {
    status: "PUBLICATION_ABSENT",
    userMessage:
      message
      ?? "Registry Market unavailable. The accepted market publication is not available in this runtime.",
    tldAsciiLabel: null,
    displayLabel: null,
    sourceReportingPeriod: null,
    sourcePeriodLabel: null,
    sourceSystemLabel: REGISTRY_MARKET_SOURCE_SYSTEM_LABEL,
    publicationContentSha256: null,
    dataStateLabel: null,
    currentAvailability: null,
    metrics: null,
    historyRows: [],
    historyNote: null,
    topAccreditedRegistrars: [],
    specialSystemNote: null,
    provenance: null,
  };
}
