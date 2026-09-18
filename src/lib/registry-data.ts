import fixture from "@/data/fixtures/registry-applications.json";

export type Application = (typeof fixture.applications)[number];
export type HistoricalContext = typeof fixture.historicalContext;
export type EvidenceKind = "authoritative" | "calculated";

export const registryFixture = fixture;

export function uniqueCount<T>(values: T[]) {
  return new Set(values).size;
}

export function buildRoundPulse(applications: Application[], historical: HistoricalContext = fixture.historicalContext) {
  const organizations = uniqueCount(applications.map((item) => item.organization));
  return [
    { id: "applications", label: "Applications", value: applications.length, delta: `+${applications.length - historical.applications} vs 2012 cohort`, filter: "all" },
    { id: "strings", label: "Unique strings", value: uniqueCount(applications.map((item) => item.string)), delta: `+${uniqueCount(applications.map((item) => item.string)) - historical.uniqueStrings} vs 2012`, filter: "strings" },
    { id: "organizations", label: "Organizations", value: organizations, delta: `+${organizations - historical.organizations} vs 2012`, filter: "organizations" },
    { id: "regions", label: "Regions", value: uniqueCount(applications.map((item) => item.region)), delta: `${uniqueCount(applications.map((item) => item.country))} countries`, filter: "regions" },
    { id: "idn", label: "IDN applications", value: applications.filter((item) => item.idn).length, delta: `+${applications.filter((item) => item.idn).length - historical.idnApplications} vs 2012`, filter: "idn" },
    { id: "contention", label: "Initial contention sets", value: uniqueCount(applications.flatMap((item) => item.contentionSet ? [item.contentionSet] : [])), delta: `${historical.contentionSets - uniqueCount(applications.flatMap((item) => item.contentionSet ? [item.contentionSet] : []))} fewer vs 2012`, filter: "contention" }
  ] as const;
}

export function buildPortfolioRanking(applications: Application[]) {
  const grouped = new Map<string, { count: number; returning: boolean; confidence: number }>();
  for (const item of applications) {
    const current = grouped.get(item.organization) ?? { count: 0, returning: false, confidence: item.confidence };
    grouped.set(item.organization, {
      count: current.count + 1,
      returning: current.returning || item.returning,
      confidence: Math.min(current.confidence, item.confidence)
    });
  }
  return [...grouped.entries()]
    .map(([organization, values]) => ({ organization, ...values }))
    .sort((a, b) => b.count - a.count || a.organization.localeCompare(b.organization));
}

export function buildCategoryMix(applications: Application[]) {
  const counts = new Map<string, number>();
  applications.forEach((item) => counts.set(item.category, (counts.get(item.category) ?? 0) + 1));
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count, percent: Math.round((count / applications.length) * 100) }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

export function buildBiggestChanges(applications: Application[], historical: HistoricalContext = fixture.historicalContext) {
  const current = Object.fromEntries(buildCategoryMix(applications).map((item) => [item.category, item.count]));
  return Object.entries(historical.categoryCounts)
    .map(([category, previous]) => ({
      category,
      previous,
      current: current[category] ?? 0,
      change: (current[category] ?? 0) - previous,
    }))
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change) || a.category.localeCompare(b.category));
}

export function buildApplicantsToWatch(applications: Application[]) {
  return buildPortfolioRanking(applications).slice(0, 3).map((organization) => {
    const records = applications.filter((item) => item.organization === organization.organization);
    const categories = uniqueCount(records.map((item) => item.category));
    const contention = records.filter((item) => item.contentionSet).length;
    const idn = records.filter((item) => item.idn).length;
    const reasons = [
      organization.count > 1 ? `${organization.count}-application portfolio` : null,
      categories > 1 ? `${categories} categories` : null,
      contention ? `${contention} application${contention > 1 ? "s" : ""} in initial contention` : null,
      idn ? `${idn} IDN application${idn > 1 ? "s" : ""}` : null,
      organization.returning ? "returning participant" : "new participant",
    ].filter((reason): reason is string => Boolean(reason));
    return { ...organization, records, reasons };
  });
}

export const roundPulse = buildRoundPulse(fixture.applications);
export const portfolioRanking = buildPortfolioRanking(fixture.applications);
export const categoryMix = buildCategoryMix(fixture.applications);
export const biggestChanges = buildBiggestChanges(fixture.applications);
export const applicantsToWatch = buildApplicantsToWatch(fixture.applications);

export const standoutInsights = [
  {
    id: "portfolio-concentration",
    eyebrow: "PORTFOLIO CONCENTRATION",
    title: "Atlas Digital holds the rehearsal fixture’s largest portfolio",
    body: "Three applications span technology and media, making it the only organization represented in more than one category.",
    confidence: "High",
    coverage: "12 of 12 applications",
    method: "portfolio-ranking/1.0.0",
    records: fixture.applications.filter((item) => item.organization === "Atlas Digital")
  },
  {
    id: "idn-shift",
    eyebrow: "LANGUAGE & SCRIPT",
    title: "IDN interest reaches two regions and two scripts",
    body: "Arabic and Japanese rehearsal records account for 17% of applications. This is an observation, not a forecast.",
    confidence: "High",
    coverage: "12 of 12 applications",
    method: "idn-share/1.0.0",
    records: fixture.applications.filter((item) => item.idn)
  },
  {
    id: "contention-concentration",
    eyebrow: "INITIAL CONTENTION",
    title: "Identity and technology each contain an identical-string set",
    body: "Four applications are grouped into two initial identical-string contention sets; later contention may differ.",
    confidence: "High",
    coverage: "12 of 12 applications",
    method: "initial-contention/1.0.0",
    records: fixture.applications.filter((item) => item.contentionSet)
  }
] as const;
