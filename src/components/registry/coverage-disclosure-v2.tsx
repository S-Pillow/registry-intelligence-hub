"use client";

import Link from "next/link";
import {
  coverageDisclosureForDocumentV2,
} from "@/lib/registry-application-payload-v2";
import type { RegistryApplicationsDocumentV2 } from "@/lib/registry-applications-document-v2";

/** Compact coverage disclosure for active 2.x Search/Explore lists. */
export function CoverageDisclosureV2({
  document,
  matchingObservedRecords,
}: {
  document: RegistryApplicationsDocumentV2;
  matchingObservedRecords?: number;
}) {
  const disclosure = coverageDisclosureForDocumentV2(document);
  const excluded = disclosure.knownExcludedApplicationIds;
  const excludedSentence =
    excluded.length === 1
      ? "One administrative-check record is not a normal Application row."
      : `${excluded.length} known-excluded records are not normal Application rows.`;

  return (
    <aside
      data-testid="coverage-disclosure-v2"
      className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700"
      aria-label="Publication coverage disclosure"
    >
      <p>
        RIH currently represents{" "}
        <strong data-testid="disclosure-observed-records">
          {disclosure.observedApplicationRecords.toLocaleString("en-US")}
        </strong>{" "}
        of ICANN&apos;s{" "}
        <strong data-testid="disclosure-official-applications">
          {disclosure.officialApplications.toLocaleString("en-US")}
        </strong>{" "}
        reported Applications. {excludedSentence}{" "}
        <span className="text-slate-500">
          Coverage:{" "}
          <strong data-testid="disclosure-completeness">{disclosure.completeness}</strong>
        </span>
      </p>
      {matchingObservedRecords !== undefined ? (
        <p className="mt-1 text-slate-600" data-testid="disclosure-local-result-count">
          Current list matches: {matchingObservedRecords.toLocaleString("en-US")} represented
          records (not the official round total).
        </p>
      ) : null}
      <p className="mt-1.5">
        <Link
          href="/data-health"
          className="font-semibold text-[#006a56] underline underline-offset-2"
          data-testid="disclosure-data-methodology-link"
        >
          Data &amp; methodology
        </Link>
      </p>
    </aside>
  );
}
