"use client";

import {
  coverageDisclosureForDocumentV2,
} from "@/lib/registry-application-payload-v2";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";

/** Persistent truthful coverage disclosure for active 2.x Search/Explore lists. */
export function CoverageDisclosureV2({
  document,
  matchingObservedRecords,
}: {
  document: RegistryApplicationsDocumentV2;
  matchingObservedRecords?: number;
}) {
  const disclosure = coverageDisclosureForDocumentV2(document);
  const excluded = disclosure.knownExcludedApplicationIds;
  const excludedLabel =
    excluded.length === 1
      ? `one administrative-check record (${excluded[0]})`
      : `${excluded.length} known-excluded records`;

  return (
    <aside
      data-testid="coverage-disclosure-v2"
      className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-950"
      aria-label="Publication coverage disclosure"
    >
      <p className="font-semibold">Coverage disclosure (not interchangeable totals)</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        <li>
          ICANN official applications:{" "}
          <strong data-testid="disclosure-official-applications">
            {disclosure.officialApplications}
          </strong>
        </li>
        <li>
          RIH normalized application records available:{" "}
          <strong data-testid="disclosure-observed-records">
            {disclosure.observedApplicationRecords}
          </strong>
        </li>
        <li>
          Coverage:{" "}
          <strong data-testid="disclosure-completeness">{disclosure.completeness}</strong>
        </li>
        <li>
          Known excluded: {excludedLabel}. WDO remains metadata, not a normal Application row.
        </li>
        {matchingObservedRecords !== undefined ? (
          <li data-testid="disclosure-local-result-count">
            Local list/search matches: {matchingObservedRecords} RIH observed records (not the
            official round total).
          </li>
        ) : null}
      </ul>
    </aside>
  );
}
