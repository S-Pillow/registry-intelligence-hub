"use client";

import { Badge } from "@/components/ui/badge";
import {
  ORGANIZATION_MAPPING_EXPLANATIONS,
  organizationMappingLabel,
} from "@/lib/rsp-opportunity-intelligence";
import type { OrganizationResolutionOverlayStatus } from "@/lib/participant-intelligence";

export function OrganizationMappingBadge({
  status,
  name,
}: {
  status: OrganizationResolutionOverlayStatus | string;
  name: string | null;
}) {
  const typed = status as OrganizationResolutionOverlayStatus;
  const label = organizationMappingLabel(typed, name);
  if (typed === "CONFIRMED" && name) {
    return (
      <Badge variant="outline" className="bg-emerald-100 text-[#006a56]" data-testid="org-confirmed-badge">
        {label}
      </Badge>
    );
  }
  if (typed === "CANDIDATE") {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-900" data-testid="org-candidate-badge">
        {label}
      </Badge>
    );
  }
  if (typed === "AMBIGUOUS") {
    return (
      <Badge variant="outline" className="bg-orange-50 text-orange-900" data-testid="org-ambiguous-badge">
        {label}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-slate-100 text-slate-700" data-testid="org-unresolved-badge">
      {label}
    </Badge>
  );
}

export function OrganizationMappingExplainer() {
  return (
    <details
      className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
      data-testid="org-mapping-explainer"
    >
      <summary className="cursor-pointer font-semibold text-slate-900">
        What do organization mappings mean?
      </summary>
      <p className="mt-2 text-slate-700">{ORGANIZATION_MAPPING_EXPLANATIONS.preamble}</p>
      <dl className="mt-2 space-y-2 text-slate-700">
        <div>
          <dt className="font-medium text-slate-900">Confirmed · Organization</dt>
          <dd>{ORGANIZATION_MAPPING_EXPLANATIONS.CONFIRMED}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Candidate match</dt>
          <dd>{ORGANIZATION_MAPPING_EXPLANATIONS.CANDIDATE}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Identity ambiguous</dt>
          <dd>{ORGANIZATION_MAPPING_EXPLANATIONS.AMBIGUOUS}</dd>
        </div>
        <div>
          <dt className="font-medium text-slate-900">Not yet resolved</dt>
          <dd>{ORGANIZATION_MAPPING_EXPLANATIONS.UNRESOLVED}</dd>
        </div>
      </dl>
    </details>
  );
}

export type ApplicantIdentityEvidenceProps = {
  applicantLegalName: string;
  organizationStatus: OrganizationResolutionOverlayStatus | string;
  confirmedOrganizationName: string | null;
  applicantWebsiteHost: string | null;
  applicantWebsiteUrl: string | null;
  directParentLegalName: string | null;
  ultimateParentLegalName: string | null;
  ultimateControlLegalName: string | null;
  evidenceExplanationLines: string[];
  /** Supporting Brand context only — not proof of Organization ownership. */
  brandApplicationCount?: number | null;
  applicationCount?: number | null;
};

/**
 * Compact Applicant ≠ Organization identity context for investigation surfaces.
 */
export function ApplicantIdentityEvidencePanel(props: ApplicantIdentityEvidenceProps) {
  const {
    applicantLegalName,
    organizationStatus,
    confirmedOrganizationName,
    applicantWebsiteHost,
    applicantWebsiteUrl,
    directParentLegalName,
    ultimateParentLegalName,
    ultimateControlLegalName,
    evidenceExplanationLines,
    brandApplicationCount,
    applicationCount,
  } = props;
  const hasWebsite = Boolean(applicantWebsiteHost);
  const hasParents = Boolean(directParentLegalName || ultimateParentLegalName || ultimateControlLegalName);
  const hasExplanation = evidenceExplanationLines.length > 0;
  const hasBrandContext =
    typeof brandApplicationCount === "number" &&
    brandApplicationCount > 0 &&
    typeof applicationCount === "number" &&
    applicationCount > 0;
  if (
    !hasWebsite &&
    !hasParents &&
    !hasExplanation &&
    !hasBrandContext &&
    organizationStatus === "UNRESOLVED"
  ) {
    return null;
  }

  return (
    <div
      className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
      data-testid="applicant-identity-evidence"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Identity context</p>
      <dl className="mt-2 space-y-1.5">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-slate-500">Applicant</dt>
          <dd className="font-medium text-slate-900">{applicantLegalName}</dd>
        </div>
        {organizationStatus === "CONFIRMED" && confirmedOrganizationName ? (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-slate-500">Organization</dt>
            <dd className="font-medium text-slate-900">Confirmed · {confirmedOrganizationName}</dd>
          </div>
        ) : null}
        {hasWebsite ? (
          <div className="flex flex-wrap items-baseline gap-x-2" data-testid="applicant-website">
            <dt className="text-slate-500">Applicant Website</dt>
            <dd>
              {applicantWebsiteUrl ? (
                <a
                  href={applicantWebsiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#006a56] underline-offset-2 hover:underline"
                >
                  {applicantWebsiteHost}
                </a>
              ) : (
                <span className="font-medium text-slate-900">{applicantWebsiteHost}</span>
              )}
            </dd>
          </div>
        ) : null}
        {hasBrandContext ? (
          <div className="flex flex-wrap gap-x-2" data-testid="brand-applications-context">
            <dt className="text-slate-500">Brand applications</dt>
            <dd className="font-medium text-slate-900">
              {brandApplicationCount} of {applicationCount}
            </dd>
          </div>
        ) : null}
        {directParentLegalName ? (
          <div className="flex flex-wrap gap-x-2" data-testid="direct-parent">
            <dt className="text-slate-500">Direct parent</dt>
            <dd className="font-medium text-slate-900">{directParentLegalName}</dd>
          </div>
        ) : null}
        {ultimateParentLegalName ? (
          <div className="flex flex-wrap gap-x-2" data-testid="ultimate-parent">
            <dt className="text-slate-500">Ultimate parent</dt>
            <dd className="font-medium text-slate-900">{ultimateParentLegalName}</dd>
          </div>
        ) : null}
        {ultimateControlLegalName && ultimateControlLegalName !== ultimateParentLegalName ? (
          <div className="flex flex-wrap gap-x-2" data-testid="ultimate-control">
            <dt className="text-slate-500">Ultimate control</dt>
            <dd className="font-medium text-slate-900">{ultimateControlLegalName}</dd>
          </div>
        ) : null}
      </dl>
      {hasExplanation && organizationStatus === "CONFIRMED" ? (
        <details className="mt-2" data-testid="org-evidence-explanation">
          <summary className="cursor-pointer font-semibold text-slate-900">
            Why this Organization is confirmed
          </summary>
          <p className="mt-1 text-slate-600">Confirmed from ICANN Applicant evidence:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-700">
            {evidenceExplanationLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      ) : null}
      {organizationStatus !== "CONFIRMED" && hasWebsite ? (
        <p className="mt-2 text-xs text-slate-500">
          Applicant Website is a discovery signal — not by itself confirmation of Organization ownership.
        </p>
      ) : null}
    </div>
  );
}
