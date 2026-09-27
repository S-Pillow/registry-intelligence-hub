import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Historical2012StructuralSummary } from "@/historical-2012/structural-summary";

function shareWidth(count: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (count / denominator) * 100;
}

export function Historical2012StructureSection({ summary }: { summary: Historical2012StructuralSummary }) {
  const largestLegalNameCount = summary.legalNames.ranked[0]?.count ?? 0;
  const largestRegionCount = summary.geography.regions[0]?.applicationCount ?? 0;

  return (
    <section
      className="mb-5 min-w-0"
      data-testid="historical-2012-structure"
      aria-label="2012 Reveal Day structural intelligence"
    >
      <p className="text-xs font-bold tracking-[0.14em] text-[#007d65]">2012 REVEAL DAY</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight text-[#004c3d] sm:text-2xl">Historical structure</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
        Observations from the 2012 Reveal Day application export ({summary.applicationCount} applications).
        These are not 2026 values.
      </p>
      <div className="mt-4 grid min-w-0 gap-5 lg:grid-cols-2">
        <Card className="min-w-0 border-slate-300 shadow-sm" data-testid="historical-2012-legal-names" data-grain="applicant-legal-name">
          <CardHeader>
            <p className="text-xs font-bold tracking-wider text-[#006a56]">APPLICANT LEGAL NAME</p>
            <CardTitle className="mt-1 text-xl">Applicant legal name</CardTitle>
            <p className="text-sm text-slate-600">Counted from the applicant legal name on every 2012 Reveal Day application.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-5 text-slate-700" data-testid="historical-2012-legal-name-disclosure">
              {summary.legalNames.distinctApplicantLegalNames} applicant legal names across {summary.legalNames.eligibleApplicationCount} applications.
              Each count is out of {summary.legalNames.shareDenominator}.
              Equal counts are ordered A to Z by applicant legal name.
              Not a resolved organization.
            </p>
            <div className="space-y-2">
              {summary.legalNames.ranked.map((item, index) => (
                <div key={item.applicantLegalName} className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 rounded-lg px-1 py-1">
                  <span className="font-mono text-xs text-slate-600">0{index + 1}</span>
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <strong className="min-w-0 text-sm break-words" data-testid={`historical-2012-legal-name-${index}`}>{item.applicantLegalName}</strong>
                      <strong className="text-sm whitespace-nowrap">{item.count} of {item.shareDenominator}</strong>
                    </span>
                    <span className="mt-2 block h-2 overflow-hidden rounded-full bg-slate-200">
                      <span
                        className="block h-full rounded-full bg-[#007d65]"
                        style={{ width: `${shareWidth(item.count, largestLegalNameCount)}%` }}
                      />
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600">
              Showing {summary.legalNames.ranked.length} of {summary.legalNames.distinctApplicantLegalNames} applicant legal names.
              Bar length is relative to the largest legal name. The count is the share of {summary.legalNames.shareDenominator} applications.
            </p>
          </CardContent>
        </Card>

        <Card className="min-w-0 border-slate-300 shadow-sm" data-testid="historical-2012-geography">
          <CardHeader>
            <p className="text-xs font-bold tracking-wider text-[#006a56]">2012 LOCATION</p>
            <CardTitle className="mt-1 text-xl">Location and ICANN region</CardTitle>
            <p className="text-sm text-slate-600">Location and Region fields on the 2012 Reveal Day export.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-5 text-slate-700" data-testid="historical-2012-geography-disclosure">
              <span data-testid="historical-2012-location-count">{summary.geography.distinctLocations}</span> distinct Location values.
              {" "}
              {summary.geography.regionCount} ICANN region codes.
              Region counts sum to <span data-testid="historical-2012-region-sum">{summary.geography.applicationCount}</span> applications.
            </p>
            <div className="space-y-2">
              {summary.geography.regions.map((region) => (
                <div
                  key={region.regionCode}
                  className="grid grid-cols-[3.25rem_3.5rem_minmax(0,1fr)] items-center gap-2"
                  data-testid={`historical-2012-region-${region.regionCode}`}
                >
                  <strong className="font-mono text-sm">{region.regionCode}</strong>
                  <strong className="text-right text-sm tabular-nums">{region.applicationCount}</strong>
                  <span className="block h-2 overflow-hidden rounded-full bg-slate-200">
                    <span
                      className="block h-full rounded-full bg-[#007d65]"
                      style={{ width: `${shareWidth(region.applicationCount, largestRegionCount)}%` }}
                    />
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card
          className="min-w-0 border-slate-300 shadow-sm lg:col-span-2"
          data-testid="historical-2012-exact-strings"
          data-set-count-shown="false"
        >
          <CardHeader>
            <p className="text-xs font-bold tracking-wider text-[#006a56]">EXACT-STRING COMPETITION</p>
            <CardTitle className="mt-1 text-xl">Exact-string competition</CardTitle>
            <p className="text-sm text-slate-600">Repeated exact applied-for strings. This is not the official contention-set count.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs leading-5 text-slate-700" data-testid="historical-2012-exact-string-disclosure">
              Exact applied-for string equality ({summary.exactStrings.method}). No extra trim, case-fold, or IDN fold.
              Equal counts are ordered A to Z by the applied-for string.
              No contention-set total is shown.
            </p>
            {summary.exactStrings.largestGroup ? (
              <p className="text-sm font-medium text-slate-900" data-testid="historical-2012-exact-string-largest">
                Largest group: {summary.exactStrings.largestGroup.appliedForString} · {summary.exactStrings.largestGroup.applicationCount} applications
              </p>
            ) : (
              <p className="text-sm text-slate-700">No applied-for string is repeated.</p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {summary.exactStrings.repeated.map((group, index) => (
                <div key={group.appliedForString} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border border-slate-200 px-3 py-3" data-testid={`historical-2012-exact-string-${index}`}>
                  <strong className="min-w-0 break-all font-mono text-sm">{group.appliedForString}</strong>
                  <span className="text-sm font-semibold whitespace-nowrap">{group.applicationCount} applications</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
